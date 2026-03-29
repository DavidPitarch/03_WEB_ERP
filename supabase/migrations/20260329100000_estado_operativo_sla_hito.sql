-- ============================================================================
-- Estado Operativo + SLA Hito (fecha próximo hito)
-- ============================================================================
-- Añade un campo de estado operativo al expediente que representa las fases
-- del ciclo de vida operativo (independiente del estado FSM existente).
-- También añade fecha_proximo_hito para control SLA por hitos.
-- ============================================================================

-- ── 1. ENUM estado_operativo ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE estado_operativo_enum AS ENUM (
    'ASIGNACION',
    'ASEGURADO_1ER_CONTACTO',
    'PRIMERA_VISITA_COORDINADA',
    'PRIMERA_CITA_COMPLETADA',
    'VALORACION',
    'PRESUPUESTO_ACEPTADO',
    'CITA_COORDINADA',
    'REPARACION_EN_CURSO',
    'LIQUIDACION_TRABAJOS',
    'FINALIZADO',
    'FACTURADO',
    'REAPERTURA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Nuevas columnas en expedientes ───────────────────────────────────────
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS estado_operativo estado_operativo_enum DEFAULT 'ASIGNACION',
  ADD COLUMN IF NOT EXISTS fecha_proximo_hito TIMESTAMPTZ;

COMMENT ON COLUMN expedientes.estado_operativo IS 'Fase operativa del expediente (ciclo de vida visual, independiente del estado FSM)';
COMMENT ON COLUMN expedientes.fecha_proximo_hito IS 'Fecha del próximo hito/milestone SLA. Se usa para el módulo Tareas Caducadas del cockpit';

-- ── 3. Índices para consultas del cockpit ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expedientes_estado_operativo
  ON expedientes (estado_operativo);

CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_proximo_hito
  ON expedientes (fecha_proximo_hito)
  WHERE fecha_proximo_hito IS NOT NULL;

-- Índice compuesto para la query del cockpit Tareas Caducadas
-- (expedientes con hito no nulo, no cerrados/cancelados, ordenados por fecha)
CREATE INDEX IF NOT EXISTS idx_expedientes_sla_hito_cockpit
  ON expedientes (fecha_proximo_hito, estado)
  WHERE fecha_proximo_hito IS NOT NULL
    AND estado NOT IN ('CERRADO', 'CANCELADO');

-- ── 4. Tabla historial_estados_operativos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_estados_operativos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  estado_anterior estado_operativo_enum,
  estado_nuevo    estado_operativo_enum NOT NULL,
  mensaje         TEXT NOT NULL,
  actor_id        UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_est_op_expediente
  ON historial_estados_operativos (expediente_id, created_at DESC);

COMMENT ON TABLE historial_estados_operativos IS 'Historial de cambios de estado operativo de expedientes. Cada cambio requiere un mensaje.';

-- ── 5. RLS para historial_estados_operativos ────────────────────────────────
ALTER TABLE historial_estados_operativos ENABLE ROW LEVEL SECURITY;

-- SELECT: staff de oficina
CREATE POLICY hist_est_op_select ON historial_estados_operativos
  FOR SELECT TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

-- INSERT: solo via service role (el backend inserta)
CREATE POLICY hist_est_op_insert ON historial_estados_operativos
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(ARRAY['admin', 'supervisor', 'tramitador']));

-- ── 6. Auditoría: trigger updated_at para expedientes (ya existe, solo asegurar) ──
-- El trigger tr_expedientes_updated_at ya cubre updated_at en expedientes.

-- ── 7. Inicializar estado_operativo de expedientes existentes ───────────────
-- Mapear el estado FSM actual a un estado operativo razonable para datos existentes
UPDATE expedientes SET estado_operativo = CASE
  WHEN estado = 'NUEVO'              THEN 'ASIGNACION'::estado_operativo_enum
  WHEN estado = 'NO_ASIGNADO'        THEN 'ASIGNACION'::estado_operativo_enum
  WHEN estado = 'EN_PLANIFICACION'   THEN 'ASEGURADO_1ER_CONTACTO'::estado_operativo_enum
  WHEN estado = 'EN_CURSO'           THEN 'REPARACION_EN_CURSO'::estado_operativo_enum
  WHEN estado = 'PENDIENTE'          THEN 'REPARACION_EN_CURSO'::estado_operativo_enum
  WHEN estado = 'PENDIENTE_MATERIAL' THEN 'REPARACION_EN_CURSO'::estado_operativo_enum
  WHEN estado = 'PENDIENTE_PERITO'   THEN 'VALORACION'::estado_operativo_enum
  WHEN estado = 'PENDIENTE_CLIENTE'  THEN 'ASEGURADO_1ER_CONTACTO'::estado_operativo_enum
  WHEN estado = 'FINALIZADO'         THEN 'FINALIZADO'::estado_operativo_enum
  WHEN estado = 'FACTURADO'          THEN 'FACTURADO'::estado_operativo_enum
  WHEN estado = 'COBRADO'            THEN 'FACTURADO'::estado_operativo_enum
  WHEN estado = 'CERRADO'            THEN 'FACTURADO'::estado_operativo_enum
  WHEN estado = 'CANCELADO'          THEN 'ASIGNACION'::estado_operativo_enum
  ELSE 'ASIGNACION'::estado_operativo_enum
END
WHERE estado_operativo IS NULL;
