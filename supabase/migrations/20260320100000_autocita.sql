BEGIN;

-- ═══════════════════════════════════════════════════════════════
--  MÓDULO: AUTOCITA
--  Permite al cliente seleccionar/confirmar citas via enlace seguro.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. TOKENS DE AUTOCITA ──────────────────────────────────────────────────
-- Token específico para autocita con scope y vínculo a la cita origen.

CREATE TABLE IF NOT EXISTS autocita_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id    UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  cita_id_origen   UUID REFERENCES citas(id) ON DELETE SET NULL,
  compania_id      UUID REFERENCES companias(id) ON DELETE SET NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  scope            TEXT NOT NULL DEFAULT 'ambos'
    CHECK (scope IN ('confirmar', 'seleccionar', 'ambos')),
  estado           TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'usado', 'expirado', 'revocado')),
  expires_at       TIMESTAMPTZ NOT NULL,
  max_uses         INTEGER NOT NULL DEFAULT 3,
  uso_count        INTEGER NOT NULL DEFAULT 0,
  last_used_at     TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revoked_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason    TEXT,
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. SELECCIONES DE AUTOCITA ─────────────────────────────────────────────
-- Trazabilidad de cada acción que el cliente realiza via autocita.

CREATE TABLE IF NOT EXISTS autocita_selecciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id         UUID NOT NULL REFERENCES autocita_tokens(id) ON DELETE CASCADE,
  expediente_id    UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  cita_id          UUID REFERENCES citas(id) ON DELETE SET NULL,
  accion           TEXT NOT NULL
    CHECK (accion IN ('confirmacion_propuesta', 'seleccion_hueco', 'cambio_solicitado', 'slot_no_disponible')),
  slot_fecha       DATE,
  slot_franja_inicio TIME,
  slot_franja_fin    TIME,
  ip_cliente       TEXT,
  user_agent       TEXT,
  detalle          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. ÍNDICES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_autocita_tokens_expediente
  ON autocita_tokens(expediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autocita_tokens_hash
  ON autocita_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_autocita_tokens_expires
  ON autocita_tokens(expires_at) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_autocita_selecciones_expediente
  ON autocita_selecciones(expediente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autocita_selecciones_token
  ON autocita_selecciones(token_id, created_at DESC);

-- ─── 4. TRIGGER updated_at ──────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_autocita_tokens_updated_at') THEN
      CREATE TRIGGER trg_autocita_tokens_updated_at
        BEFORE UPDATE ON autocita_tokens
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

-- ─── 5. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE autocita_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE autocita_selecciones ENABLE ROW LEVEL SECURITY;

-- Staff puede leer y gestionar tokens
DROP POLICY IF EXISTS autocita_tokens_staff_select ON autocita_tokens;
DROP POLICY IF EXISTS autocita_tokens_staff_manage ON autocita_tokens;
DROP POLICY IF EXISTS autocita_selecciones_staff_select ON autocita_selecciones;
DROP POLICY IF EXISTS autocita_selecciones_staff_insert ON autocita_selecciones;

CREATE POLICY autocita_tokens_staff_select ON autocita_tokens FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY autocita_tokens_staff_manage ON autocita_tokens FOR ALL
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY autocita_selecciones_staff_select ON autocita_selecciones FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

CREATE POLICY autocita_selecciones_staff_insert ON autocita_selecciones FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'direccion']));

-- ─── 6. VISTA: RESUMEN DE CAMBIOS POR EXPEDIENTE ────────────────────────────
-- Usada por el motor para verificar el límite de cambios.

CREATE OR REPLACE VIEW v_autocita_cambios AS
SELECT
  expediente_id,
  COUNT(*) FILTER (WHERE accion IN ('seleccion_hueco', 'cambio_solicitado')) AS cambios_count,
  MAX(created_at) AS ultima_accion_at
FROM autocita_selecciones
GROUP BY expediente_id;

COMMIT;
