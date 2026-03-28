-- ─── MÓDULO SINIESTROS — Columnas operativas y tablas de soporte ─────────────
-- Este módulo añade las columnas y tablas necesarias para las vistas operativas
-- de Siniestros (Activos / Finalizados / Seguimiento).
-- Todas las tablas existentes (expedientes, citas, facturas, pedidos_material,
-- comunicaciones, presupuestos, evidencias) ya cubren el modelo core.
-- Este migration añade únicamente lo que falta para el workflow operativo.

-- ─── 1. Columnas operativas en expedientes ───────────────────────────────────

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS pausado              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vip                  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_espera         DATE,
  ADD COLUMN IF NOT EXISTS notas                TEXT,
  ADD COLUMN IF NOT EXISTS fecha_alta_asegurado DATE;     -- fecha de entrada del encargo (≈ fecha_encargo pero en formato date)
-- Nota: dias_sin_actualizar se calcula en la capa de aplicación (now() no es inmutable en columnas GENERATED)

COMMENT ON COLUMN expedientes.pausado              IS 'Expediente pausado temporalmente por el tramitador';
COMMENT ON COLUMN expedientes.vip                  IS 'Expediente marcado como VIP (cliente especial)';
COMMENT ON COLUMN expedientes.fecha_espera         IS 'Fecha límite de próxima acción requerida (semáforo rojo/verde en activos)';
COMMENT ON COLUMN expedientes.notas                IS 'Notas internas del tramitador';
COMMENT ON COLUMN expedientes.fecha_alta_asegurado IS 'Fecha de alta / ingreso del expediente por parte del asegurado';

-- ─── 2. Índices para los nuevos filtros ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_expedientes_pausado
  ON expedientes (pausado) WHERE pausado = TRUE;

CREATE INDEX IF NOT EXISTS idx_expedientes_vip
  ON expedientes (vip) WHERE vip = TRUE;

CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_espera
  ON expedientes (fecha_espera) WHERE fecha_espera IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_alta_asegurado
  ON expedientes (fecha_alta_asegurado);

-- ─── 3. Etiquetas del expediente (checkboxes de tipo: Calidad, FRAUDE, etc.) ─

CREATE TABLE IF NOT EXISTS expediente_etiquetas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id    UUID NOT NULL,
  etiqueta       TEXT NOT NULL,
  valor          TEXT,                         -- para etiquetas con valor (rev economica [usuario])
  creado_por     UUID,                         -- user_id del tramitador que la añadió
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (expediente_id, etiqueta)
);

COMMENT ON TABLE expediente_etiquetas IS
  'Etiquetas operativas del expediente: Calidad, FRAUDE, Urgente, VIP, DANA VALENCIA, Ilocalizable, etc.';

CREATE INDEX IF NOT EXISTS idx_exp_etiquetas_expediente
  ON expediente_etiquetas (expediente_id);

CREATE INDEX IF NOT EXISTS idx_exp_etiquetas_compania
  ON expediente_etiquetas (compania_id);

CREATE INDEX IF NOT EXISTS idx_exp_etiquetas_etiqueta
  ON expediente_etiquetas (etiqueta);

-- ─── 4. Incidencias del expediente ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expediente_incidencias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id    UUID NOT NULL,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now(),
  origen         TEXT,
  tipologia      TEXT,
  texto          TEXT NOT NULL,
  nivel_rga      TEXT,
  imputada_a     TEXT,
  procedente     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por     UUID,                         -- user_id
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE expediente_incidencias IS
  'Registro de incidencias operativas vinculadas al expediente.';

CREATE INDEX IF NOT EXISTS idx_exp_incidencias_expediente
  ON expediente_incidencias (expediente_id);

CREATE INDEX IF NOT EXISTS idx_exp_incidencias_compania
  ON expediente_incidencias (compania_id);

CREATE INDEX IF NOT EXISTS idx_exp_incidencias_fecha
  ON expediente_incidencias (fecha DESC);

-- ─── 5. RLS — expediente_etiquetas ───────────────────────────────────────────

ALTER TABLE expediente_etiquetas ENABLE ROW LEVEL SECURITY;

-- Política de lectura: solo expedientes de la propia compañía
CREATE POLICY "siniestros_etiquetas_select" ON expediente_etiquetas
  FOR SELECT
  USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- Política de escritura: tramitador y roles de oficina
CREATE POLICY "siniestros_etiquetas_insert" ON expediente_etiquetas
  FOR INSERT
  WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "siniestros_etiquetas_delete" ON expediente_etiquetas
  FOR DELETE
  USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- ─── 6. RLS — expediente_incidencias ─────────────────────────────────────────

ALTER TABLE expediente_incidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "siniestros_incidencias_select" ON expediente_incidencias
  FOR SELECT
  USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "siniestros_incidencias_insert" ON expediente_incidencias
  FOR INSERT
  WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "siniestros_incidencias_delete" ON expediente_incidencias
  FOR DELETE
  USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- ─── 7. Vista de apoyo para contadores rápidos en activos ────────────────────
-- Usada por el endpoint GET /siniestros/activos/stats para los contadores
-- de "estados pendiente" del filtro desplegable.

CREATE OR REPLACE VIEW v_siniestros_activos_estados AS
SELECT
  e.compania_id,
  e.estado,
  COUNT(*) AS total
FROM expedientes e
WHERE e.estado NOT IN ('FACTURADO', 'COBRADO', 'CERRADO', 'CANCELADO')
GROUP BY e.compania_id, e.estado;

-- ─── 8. Función helper para calcular días de apertura ────────────────────────

CREATE OR REPLACE FUNCTION dias_apertura_expediente(p_fecha DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((CURRENT_DATE - p_fecha), 0)
$$;
