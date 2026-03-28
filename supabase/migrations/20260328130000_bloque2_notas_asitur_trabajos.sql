-- =============================================================================
-- SEGUIMIENTO BLOQUE 2 — Secciones 6-10
-- S7:  Pedidos inline (pedido_expediente_estados extensión)
-- S8:  Trabajos por expediente con estado No iniciado/Subsanado
-- S9:  Comunicaciones ASITUR/INTERPWGS
-- S10: Notas internas (tramitadores + operarios, con alarmas)
-- =============================================================================

-- ─── S8.4: Trabajos por expediente (estado No iniciado / Subsanado) ────────────
-- Tabla ligera que rastrea el estado de seguimiento de cada trabajo
-- vinculado a un expediente. Independiente del presupuesto/parte.

CREATE TABLE IF NOT EXISTS trabajos_expediente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id     UUID NOT NULL,
  operario_id     UUID,
  operario_nombre TEXT,
  especialidad    TEXT,
  descripcion     TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'No iniciado'
    CHECK (estado IN ('No iniciado', 'Subsanado')),
  fecha_asignacion DATE,
  fecha_cita       DATE,
  fecha_finalizacion DATE,
  orden           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trabajos_exp_expediente
  ON trabajos_expediente (expediente_id, orden);

CREATE INDEX IF NOT EXISTS idx_trabajos_exp_operario
  ON trabajos_expediente (operario_id);

CREATE INDEX IF NOT EXISTS idx_trabajos_exp_compania
  ON trabajos_expediente (compania_id);

ALTER TABLE trabajos_expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trabajos_exp_select" ON trabajos_expediente
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "trabajos_exp_insert" ON trabajos_expediente
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "trabajos_exp_update" ON trabajos_expediente
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "trabajos_exp_delete" ON trabajos_expediente
  FOR DELETE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_trabajos_exp_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trabajos_exp_updated_at
  BEFORE UPDATE ON trabajos_expediente
  FOR EACH ROW EXECUTE FUNCTION update_trabajos_exp_updated_at();


-- ─── S9: Comunicaciones ASITUR / INTERPWGS ────────────────────────────────────
-- Canal bidireccional estructurado con la compañía aseguradora.
-- Separado de la tabla comunicaciones (contacto asegurado) para no mezclar
-- el canal operativo con el canal de gestión con la aseguradora.

CREATE TABLE IF NOT EXISTS comunicaciones_asitur (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id     UUID NOT NULL,
  tipo_mensaje    TEXT NOT NULL CHECK (tipo_mensaje IN (
    'INFOGENERALENVIAR',
    'INFOGENERALRECIBIR',
    'Relato',
    'Peticion_intervencion_perito',
    'Peticion_intervencion_proveedor',
    'Solicitud_instrucciones_cobertura',
    'Recibidas_instrucciones_periciales',
    'Recibidas_instrucciones_asegurado',
    'Informacion_solicitada_ASITUR',
    'Solicitud_instrucciones_ASITUR',
    'Enviar_presupuesto',
    'TERMINAR'
  )),
  contenido       TEXT NOT NULL,
  adjunto_path    TEXT,                    -- Supabase Storage path
  adjunto_nombre  TEXT,                    -- nombre original del archivo
  direccion       TEXT NOT NULL DEFAULT 'saliente'
    CHECK (direccion IN ('entrante', 'saliente')),
  actor_id        UUID,
  actor_nombre    TEXT NOT NULL DEFAULT 'Sistema',
  leido           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_com_asitur_expediente
  ON comunicaciones_asitur (expediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_com_asitur_compania
  ON comunicaciones_asitur (compania_id);

CREATE INDEX IF NOT EXISTS idx_com_asitur_tipo
  ON comunicaciones_asitur (tipo_mensaje);

ALTER TABLE comunicaciones_asitur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "com_asitur_select" ON comunicaciones_asitur
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "com_asitur_insert" ON comunicaciones_asitur
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "com_asitur_update" ON comunicaciones_asitur
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "com_asitur_delete" ON comunicaciones_asitur
  FOR DELETE USING (
    has_any_role(ARRAY['admin', 'supervisor'])
  );


-- ─── S10: Notas internas (tramitadores y operarios) ───────────────────────────
-- Sistema de notas bidireccional interno: tramitadores ↔ operarios.
-- Las notas pueden tener alarmas programadas con fecha y usuario destinatario.

CREATE TABLE IF NOT EXISTS notas_internas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id       UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id         UUID NOT NULL,
  tipo                TEXT NOT NULL CHECK (tipo IN ('tramitador', 'operario')),
  texto               TEXT NOT NULL,
  autor_id            UUID,
  autor_nombre        TEXT NOT NULL,
  -- Alarma/recordatorio opcional
  alarma_fecha        TIMESTAMPTZ,
  alarma_usuario_id   UUID,
  alarma_usuario_nombre TEXT,
  alarma_tipo         TEXT,                 -- 'H' = Hito
  alarma_estado       TEXT NOT NULL DEFAULT 'Desactivada'
    CHECK (alarma_estado IN ('Activada', 'Desactivada')),
  realizado           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_internas_expediente
  ON notas_internas (expediente_id, tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notas_internas_compania
  ON notas_internas (compania_id);

CREATE INDEX IF NOT EXISTS idx_notas_internas_alarma
  ON notas_internas (alarma_fecha, alarma_estado)
  WHERE alarma_fecha IS NOT NULL;

ALTER TABLE notas_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_internas_select" ON notas_internas
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "notas_internas_insert" ON notas_internas
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "notas_internas_update" ON notas_internas
  FOR UPDATE USING (
    -- El autor puede editar/marcar realizado
    autor_id = auth.uid()
    OR
    has_any_role(ARRAY['admin', 'supervisor'])
  );

CREATE POLICY "notas_internas_delete" ON notas_internas
  FOR DELETE USING (
    autor_id = auth.uid()
    OR
    has_any_role(ARRAY['admin', 'supervisor'])
  );


-- ─── S7: Extensión del modelo de pedidos ─────────────────────────────────────
-- Los pedidos ya tienen tabla (pedidos_material / pedidos) desde migraciones
-- anteriores. Aquí añadimos el campo expediente_id si no estaba ya.
-- La creación inline desde seguimiento usa el endpoint POST /siniestros/:id/pedidos

-- Verificamos si la tabla se llama pedidos_material o pedidos y añadimos
-- columna notas_internas si falta (columna para texto libre del tramitador)
ALTER TABLE pedidos_material ADD COLUMN IF NOT EXISTS notas_tramitador TEXT;
