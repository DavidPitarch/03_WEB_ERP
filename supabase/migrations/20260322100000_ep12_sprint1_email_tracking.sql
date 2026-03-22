BEGIN;

-- ─── EP-12 Sprint 1: Email tracking en customer_tracking_tokens ───────────────
--
-- Añade columnas para registrar el intento de envío de email al cliente,
-- el resultado (sent | dry_run | failed | no_email) y la URL completa
-- del enlace que se emitió, que el backoffice puede copiar manualmente
-- si el cliente no tiene email.

ALTER TABLE customer_tracking_tokens
  ADD COLUMN IF NOT EXISTS email_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status   TEXT
    CHECK (email_status IS NULL
        OR email_status IN ('sent', 'dry_run', 'failed', 'no_email')),
  ADD COLUMN IF NOT EXISTS email_error    TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url  TEXT;

-- Índice para consultas de soporte ("¿a quién enviamos el email hoy?")
CREATE INDEX IF NOT EXISTS idx_ctt_email_status
  ON customer_tracking_tokens(email_status)
  WHERE email_status IS NOT NULL;

COMMIT;
