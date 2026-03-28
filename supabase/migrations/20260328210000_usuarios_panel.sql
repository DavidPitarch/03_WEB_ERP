BEGIN;

-- ============================================================
-- Panel de Usuarios — Extensión de tramitadores + log actividad
-- ============================================================

-- 1. Ampliar constraint de nivel
ALTER TABLE tramitadores DROP CONSTRAINT IF EXISTS tramitadores_nivel_check;

-- Migrar valores previos
UPDATE tramitadores SET nivel = 'administracion'      WHERE nivel = 'administrador';
UPDATE tramitadores SET nivel = 'super_administracion' WHERE nivel = 'super_administrador';

ALTER TABLE tramitadores ADD CONSTRAINT tramitadores_nivel_check
  CHECK (nivel IN (
    'tramitador', 'gestion', 'tecnico', 'administracion', 'super_administracion',
    'redes', 'facturacion', 'perito', 'operario', 'suboperario'
  ));

-- 2. Nuevos campos en tramitadores
ALTER TABLE tramitadores
  ADD COLUMN IF NOT EXISTS apellido1            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS apellido2            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contrato_horas_dia   NUMERIC(4,2)  DEFAULT 8,
  ADD COLUMN IF NOT EXISTS jornada_laboral      VARCHAR(20)   DEFAULT 'completa',
  ADD COLUMN IF NOT EXISTS horario_texto        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS notas_usuario        TEXT,
  ADD COLUMN IF NOT EXISTS tipo_usuario         VARCHAR(20)   NOT NULL DEFAULT 'tramitador',
  ADD COLUMN IF NOT EXISTS pct_carga_trabajo    NUMERIC(5,2)  DEFAULT 100,
  ADD COLUMN IF NOT EXISTS jornada_pct          NUMERIC(5,2)  DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ultima_sesion_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_sesion_fin    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sesion_activa        BOOLEAN       NOT NULL DEFAULT FALSE;

-- Constraints adicionales con IF NOT EXISTS via DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tramitadores_jornada_laboral_check'
  ) THEN
    ALTER TABLE tramitadores ADD CONSTRAINT tramitadores_jornada_laboral_check
      CHECK (jornada_laboral IN ('completa', 'media_jornada', 'partida'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tramitadores_tipo_usuario_check'
  ) THEN
    ALTER TABLE tramitadores ADD CONSTRAINT tramitadores_tipo_usuario_check
      CHECK (tipo_usuario IN ('tramitador', 'operario'));
  END IF;
END$$;

-- Poblar apellido1 desde apellidos existentes
UPDATE tramitadores
  SET apellido1 = apellidos
WHERE apellido1 IS NULL AND apellidos IS NOT NULL AND apellidos <> '';

-- 3. Recrear v_carga_tramitadores con nuevos campos + join user_profiles
DROP MATERIALIZED VIEW IF EXISTS v_carga_tramitadores CASCADE;

CREATE MATERIALIZED VIEW v_carga_tramitadores AS
SELECT
  t.id                                                        AS tramitador_id,
  t.user_id,
  COALESCE(t.nombre, '') || ' ' ||
    COALESCE(t.apellido1, t.apellidos, '') ||
    CASE WHEN COALESCE(t.apellido2, '') <> ''
         THEN ' ' || t.apellido2 ELSE '' END                 AS nombre_completo,
  t.nombre,
  t.apellidos,
  t.apellido1,
  t.apellido2,
  t.email,
  t.empresa_facturadora_id,
  t.activo,
  t.ausente,
  t.nivel,
  t.tipo_usuario,
  t.max_expedientes_activos,
  t.max_urgentes,
  t.umbral_alerta_pct,
  t.fecha_alta,
  t.fecha_baja,
  t.jornada_pct,
  t.pct_carga_trabajo,
  t.contrato_horas_dia,
  t.jornada_laboral,
  t.horario_texto,
  t.notas_usuario,
  t.ultima_sesion_inicio,
  t.ultima_sesion_fin,
  t.sesion_activa,
  -- user_profiles (nif, extension)
  up.nif,
  up.extension,
  -- Totales expedientes
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
  )                                                           AS total_activos,
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      AND e.prioridad = 'urgente'
  )                                                           AS total_urgentes,
  COUNT(e.id) FILTER (
    WHERE e.fecha_limite_sla < NOW()
      AND e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
  )                                                           AS total_sla_vencidos,
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      AND NOT EXISTS (
        SELECT 1 FROM citas c
        WHERE c.expediente_id = e.id
          AND c.estado IN ('programada', 'confirmada')
      )
  )                                                           AS total_sin_cita,
  COUNT(e.id) FILTER (
    WHERE e.estado::TEXT LIKE 'PENDIENTE%'
  )                                                           AS total_bloqueados,
  -- Cerrados hoy (para ratio activos)
  COUNT(e.id) FILTER (
    WHERE e.estado IN ('CERRADO', 'COBRADO', 'CANCELADO')
      AND e.updated_at >= CURRENT_DATE
  )                                                           AS cerrados_hoy,
  -- Porcentaje de carga
  ROUND(
    COUNT(e.id) FILTER (
      WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
    )::NUMERIC / NULLIF(t.max_expedientes_activos, 0) * 100,
    1
  )                                                           AS porcentaje_carga,
  -- Semáforo
  CASE
    WHEN COUNT(e.id) FILTER (
      WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
    ) >= t.max_expedientes_activos THEN 'rojo'
    WHEN ROUND(
      COUNT(e.id) FILTER (
        WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      )::NUMERIC / NULLIF(t.max_expedientes_activos, 0) * 100,
      1
    ) >= t.umbral_alerta_pct       THEN 'amarillo'
    ELSE 'verde'
  END                                                         AS semaforo,
  NOW()                                                       AS last_refresh
FROM tramitadores t
LEFT JOIN user_profiles up ON up.id = t.user_id
LEFT JOIN expedientes e ON e.tramitador_id = t.id
GROUP BY
  t.id, t.user_id, t.nombre, t.apellidos, t.apellido1, t.apellido2,
  t.email, t.empresa_facturadora_id, t.activo, t.ausente, t.nivel,
  t.tipo_usuario, t.max_expedientes_activos, t.max_urgentes, t.umbral_alerta_pct,
  t.fecha_alta, t.fecha_baja, t.jornada_pct, t.pct_carga_trabajo,
  t.contrato_horas_dia, t.jornada_laboral, t.horario_texto, t.notas_usuario,
  t.ultima_sesion_inicio, t.ultima_sesion_fin, t.sesion_activa,
  up.nif, up.extension;

CREATE UNIQUE INDEX idx_v_carga_tramitador ON v_carga_tramitadores(tramitador_id);
CREATE INDEX idx_v_carga_empresa          ON v_carga_tramitadores(empresa_facturadora_id);
CREATE INDEX idx_v_carga_semaforo         ON v_carga_tramitadores(semaforo, activo);
CREATE INDEX idx_v_carga_user_id          ON v_carga_tramitadores(user_id);

-- 4. Tabla de log de actividad de usuarios
CREATE TABLE IF NOT EXISTS user_activity_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tramitador_id     UUID        REFERENCES tramitadores(id)  ON DELETE SET NULL,
  user_id           UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  accion            TEXT        NOT NULL,
  expediente_id     UUID        REFERENCES expedientes(id)   ON DELETE SET NULL,
  expediente_numero TEXT,
  descripcion       TEXT        NOT NULL,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ual_tramitador ON user_activity_log(tramitador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_expediente ON user_activity_log(expediente_id)
  WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ual_created    ON user_activity_log(created_at DESC);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_activity_log" ON user_activity_log
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "service_insert_activity_log" ON user_activity_log
  FOR INSERT WITH CHECK (TRUE);

COMMIT;
