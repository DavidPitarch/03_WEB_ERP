-- =============================================================================
-- SEGUIMIENTO BLOQUE 4 — Sección 16
-- S16: Email al operario / asegurado (log de envíos)
-- =============================================================================

-- ─── S16: emails_expediente ───────────────────────────────────────────────────
-- Registra cada envío de email al operario/asegurado desde el módulo S16

CREATE TABLE IF NOT EXISTS emails_expediente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id     UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id       UUID NOT NULL,
  email_destino     TEXT NOT NULL,
  email_libre       TEXT,
  nombre_destino    TEXT,
  asunto            TEXT,
  cuerpo            TEXT NOT NULL,
  enviado_por       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_expediente_exp
  ON emails_expediente (expediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emails_expediente_compania
  ON emails_expediente (compania_id);

ALTER TABLE emails_expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emails_expediente_select" ON emails_expediente
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "emails_expediente_insert" ON emails_expediente
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );
