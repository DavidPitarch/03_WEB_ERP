BEGIN;

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_reschedule_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_reschedule_requested_slot TEXT,
  ADD COLUMN IF NOT EXISTS customer_reschedule_motivo TEXT,
  ADD COLUMN IF NOT EXISTS customer_reschedule_status TEXT
    CHECK (customer_reschedule_status IS NULL OR customer_reschedule_status IN ('pendiente', 'gestionado', 'rechazado', 'aceptado'));

CREATE TABLE IF NOT EXISTS customer_tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 25,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  issued_to TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tracking_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES customer_tracking_tokens(id) ON DELETE SET NULL,
  expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL,
  cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('emitir_link', 'view', 'confirmar_cita', 'solicitar_cambio')),
  ok BOOLEAN NOT NULL DEFAULT true,
  ip TEXT,
  user_agent TEXT,
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_tracking_tokens_expediente ON customer_tracking_tokens(expediente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_tokens_expires ON customer_tracking_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_tracking_access_logs_expediente ON customer_tracking_access_logs(expediente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_tracking_access_logs_token ON customer_tracking_access_logs(token_id, created_at DESC);

ALTER TABLE customer_tracking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tracking_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_tracking_tokens_staff_select ON customer_tracking_tokens;
DROP POLICY IF EXISTS customer_tracking_tokens_staff_manage ON customer_tracking_tokens;
DROP POLICY IF EXISTS customer_tracking_access_logs_staff_select ON customer_tracking_access_logs;
DROP POLICY IF EXISTS customer_tracking_access_logs_staff_insert ON customer_tracking_access_logs;

CREATE POLICY customer_tracking_tokens_staff_select ON customer_tracking_tokens FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY customer_tracking_tokens_staff_manage ON customer_tracking_tokens FOR ALL
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY customer_tracking_access_logs_staff_select ON customer_tracking_access_logs FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY customer_tracking_access_logs_staff_insert ON customer_tracking_access_logs FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_tracking_tokens_updated_at') THEN
      CREATE TRIGGER trg_customer_tracking_tokens_updated_at
        BEFORE UPDATE ON customer_tracking_tokens
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

COMMIT;
