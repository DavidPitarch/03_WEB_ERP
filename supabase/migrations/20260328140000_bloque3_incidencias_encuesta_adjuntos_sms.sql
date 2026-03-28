-- =============================================================================
-- SEGUIMIENTO BLOQUE 3 — Secciones 11-15
-- S11: Incidencias extendidas (tipo, plataforma, interna, proc)
-- S12: Encuesta de satisfacción (sólo audit)
-- S13: Informe fotográfico / campos adicionales (82-89)
-- S14: Adjuntos y email (usa tabla evidencias existente)
-- S15: SMS programados
-- =============================================================================

-- ─── S11: Extensión de expediente_incidencias ─────────────────────────────────

ALTER TABLE expediente_incidencias
  ADD COLUMN IF NOT EXISTS tipo_incidencia           TEXT
    CHECK (tipo_incidencia IN ('Operario', 'Tramitador', 'Compañía')),
  ADD COLUMN IF NOT EXISTS plataforma_usuario_id     UUID,
  ADD COLUMN IF NOT EXISTS plataforma_usuario_nombre TEXT,
  ADD COLUMN IF NOT EXISTS interna                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proc_incidencia           TEXT
    CHECK (proc_incidencia IN ('Procedente', 'No procedente', 'No procede'));

-- ─── S13: Campos adicionales para informe fotográfico ─────────────────────────
-- campo_82: Material    campo_83: Marca/Modelo   campo_84: Medidas
-- campo_85: Entrada     campo_86: Salida         campo_87: Nombre quien recoge
-- campo_88: DNI / Fecha recogida                 campo_89: Delegación

CREATE TABLE IF NOT EXISTS campos_adicionales_expediente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id     UUID NOT NULL,
  campo_82        TEXT,
  campo_83        TEXT,
  campo_84        TEXT,
  campo_85        TEXT,
  campo_86        TEXT,
  campo_87        TEXT,
  campo_88        TEXT,
  campo_89        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(expediente_id)
);

CREATE INDEX IF NOT EXISTS idx_campos_adicionales_exp
  ON campos_adicionales_expediente (expediente_id);

CREATE INDEX IF NOT EXISTS idx_campos_adicionales_compania
  ON campos_adicionales_expediente (compania_id);

ALTER TABLE campos_adicionales_expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_adicionales_select" ON campos_adicionales_expediente
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "campos_adicionales_insert" ON campos_adicionales_expediente
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "campos_adicionales_update" ON campos_adicionales_expediente
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE OR REPLACE FUNCTION update_campos_adicionales_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campos_adicionales_updated_at
  BEFORE UPDATE ON campos_adicionales_expediente
  FOR EACH ROW EXECUTE FUNCTION update_campos_adicionales_updated_at();

-- ─── S15: SMS programados ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sms_programados (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id       UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id         UUID NOT NULL,
  destinatario_nombre TEXT NOT NULL,
  numero              TEXT NOT NULL,
  texto               TEXT NOT NULL,
  fecha_programada    TIMESTAMPTZ,
  estado              TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'cancelado')),
  enviado_at          TIMESTAMPTZ,
  creado_por          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_programados_expediente
  ON sms_programados (expediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_programados_compania
  ON sms_programados (compania_id);

CREATE INDEX IF NOT EXISTS idx_sms_pendientes
  ON sms_programados (fecha_programada, estado)
  WHERE estado = 'pendiente';

ALTER TABLE sms_programados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_programados_select" ON sms_programados
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "sms_programados_insert" ON sms_programados
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "sms_programados_update" ON sms_programados
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );
