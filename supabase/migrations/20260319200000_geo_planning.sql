-- ════════════════════════════════════════════════════════════════
-- Migración: Módulo Planning Geográfico
-- Fecha: 2026-03-19
-- Descripción: Añade capacidades geoespaciales al ERP de siniestros.
--   · Extensión PostGIS
--   · geo_point en expedientes y geo_base en operarios
--   · Tabla geo_cache para evitar re-geocodificaciones
--   · Tabla operario_positions para tracking en tiempo real (desacoplado)
--   · Vista v_geo_expedientes y v_operario_carga para el mapa
--   · RLS en tablas nuevas
-- ════════════════════════════════════════════════════════════════

-- ─── PostGIS ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Columnas en expedientes ───────────────────────────────────
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS geo_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (geo_status IN ('pending', 'ok', 'failed', 'manual'));

-- Índice espacial mediante columna computada (Supabase / PG 14+)
-- Usamos lat/lng separadas para compatibilidad con el cliente JS
CREATE INDEX IF NOT EXISTS idx_expedientes_geo_lat_lng
  ON expedientes (geo_lat, geo_lng)
  WHERE geo_status = 'ok';

-- ─── Columnas en operarios ─────────────────────────────────────
ALTER TABLE operarios
  ADD COLUMN IF NOT EXISTS geo_base_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_base_lng  DOUBLE PRECISION;

-- ─── Cache de geocodificación ──────────────────────────────────
CREATE TABLE IF NOT EXISTS geo_cache (
  direccion_raw   TEXT        PRIMARY KEY,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  confidence      DECIMAL(4,3),
  source          TEXT        NOT NULL DEFAULT 'nominatim',
  geocoded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE geo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_cache_read_authenticated"
  ON geo_cache FOR SELECT TO authenticated USING (true);

-- Solo service_role puede insertar/actualizar
-- (llamadas desde edge-api con service key)

-- ─── Posiciones en tiempo real (desacoplado) ───────────────────
CREATE TABLE IF NOT EXISTS operario_positions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id  UUID        NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  accuracy_m   INTEGER,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_positions_operario
  ON operario_positions (operario_id, recorded_at DESC);

ALTER TABLE operario_positions ENABLE ROW LEVEL SECURITY;

-- Operario solo ve/inserta su propia posición;
-- admin y supervisor ven todas.
CREATE POLICY "op_positions_own_or_admin"
  ON operario_positions FOR ALL TO authenticated
  USING (
    operario_id IN (
      SELECT id FROM operarios WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    operario_id IN (
      SELECT id FROM operarios WHERE user_id = auth.uid()
    )
  );

-- ─── Vista: expedientes georreferenciados para el mapa ─────────
CREATE OR REPLACE VIEW v_geo_expedientes AS
SELECT
  e.id,
  e.numero_expediente,
  e.estado,
  e.prioridad,
  e.fecha_encargo,
  e.fecha_limite_sla,
  e.operario_id,
  e.compania_id,
  e.tipo_siniestro,
  e.direccion_siniestro,
  e.codigo_postal,
  e.localidad,
  e.provincia,
  e.geo_lat                                         AS lat,
  e.geo_lng                                         AS lng,
  e.geo_status,
  -- SLA semáforo
  CASE
    WHEN e.fecha_limite_sla IS NULL        THEN 'sin_sla'
    WHEN e.fecha_limite_sla < NOW()        THEN 'vencido'
    WHEN e.fecha_limite_sla < NOW() + INTERVAL '24 hours' THEN 'urgente'
    ELSE 'ok'
  END                                               AS sla_status,
  -- Citas activas hoy
  (
    SELECT COUNT(*)
    FROM citas c
    WHERE c.expediente_id = e.id
      AND c.fecha = CURRENT_DATE
      AND c.estado NOT IN ('cancelada', 'no_show')
  )::INT                                            AS citas_hoy,
  -- Nombre del operario asignado (para tooltip)
  (
    SELECT op.nombre || ' ' || op.apellidos
    FROM operarios op
    WHERE op.id = e.operario_id
  )                                                 AS operario_nombre,
  -- Nombre compañía (para filtro visual)
  (
    SELECT co.nombre
    FROM companias co
    WHERE co.id = e.compania_id
  )                                                 AS compania_nombre
FROM expedientes e
WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO')
  AND e.geo_status = 'ok';

-- ─── Vista: carga operario (día y semana) ──────────────────────
CREATE OR REPLACE VIEW v_operario_carga AS
SELECT
  o.id,
  o.nombre,
  o.apellidos,
  o.telefono,
  o.email,
  o.gremios,
  o.zonas_cp,
  o.activo,
  o.geo_base_lat                                    AS base_lat,
  o.geo_base_lng                                    AS base_lng,
  -- Citas hoy (no canceladas)
  COUNT(c.id) FILTER (
    WHERE c.fecha = CURRENT_DATE
      AND c.estado NOT IN ('cancelada', 'no_show')
  )::INT                                            AS citas_hoy,
  -- Citas esta semana
  COUNT(c.id) FILTER (
    WHERE c.fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
      AND c.estado NOT IN ('cancelada', 'no_show')
  )::INT                                            AS citas_semana,
  -- Última cita (para estimar posición aproximada)
  MAX(c.fecha)                                      AS ultima_cita_fecha
FROM operarios o
LEFT JOIN citas c ON c.operario_id = o.id
WHERE o.activo = TRUE
GROUP BY o.id;

-- ─── Vista KPIs logísticos ─────────────────────────────────────
CREATE OR REPLACE VIEW v_kpis_logisticos AS
SELECT
  -- Geolocalizados
  COUNT(*) FILTER (
    WHERE geo_status = 'ok'
      AND estado NOT IN ('CERRADO','CANCELADO','COBRADO','FACTURADO')
  )                                                         AS total_geolocalizados,
  COUNT(*) FILTER (
    WHERE estado NOT IN ('CERRADO','CANCELADO','COBRADO','FACTURADO')
  )                                                         AS total_activos,
  ROUND(
    COUNT(*) FILTER (
      WHERE geo_status = 'ok'
        AND estado NOT IN ('CERRADO','CANCELADO','COBRADO','FACTURADO')
    )::NUMERIC
    / NULLIF(
        COUNT(*) FILTER (
          WHERE estado NOT IN ('CERRADO','CANCELADO','COBRADO','FACTURADO')
        ),
        0
      ) * 100,
    1
  )                                                         AS pct_geolocalizados,
  -- Sin asignar
  COUNT(*) FILTER (
    WHERE estado IN ('NUEVO', 'NO_ASIGNADO')
  )                                                         AS sin_asignar,
  -- Urgentes sin asignar
  COUNT(*) FILTER (
    WHERE estado IN ('NUEVO', 'NO_ASIGNADO')
      AND prioridad = 'urgente'
  )                                                         AS urgentes_sin_asignar,
  -- SLA vencidos abiertos
  COUNT(*) FILTER (
    WHERE fecha_limite_sla < NOW()
      AND estado NOT IN ('CERRADO','CANCELADO','COBRADO','FACTURADO','FINALIZADO')
  )                                                         AS sla_vencidos_abiertos
FROM expedientes;

-- ─── Habilitar Realtime en operario_positions ──────────────────
-- Necesario para tracking en tiempo real desde PWA
ALTER PUBLICATION supabase_realtime ADD TABLE operario_positions;
