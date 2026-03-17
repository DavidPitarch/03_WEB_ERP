-- EP-11b: Videoperitación — Sprint 2 (webhooks, sessions, artifacts)
-- Migration: 00013_ep11b_sprint2_webhooks_sesiones.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. ALTER vp_sesiones
-- ═══════════════════════════════════════════════════════════════

-- Drop old estado CHECK and recreate with new values
ALTER TABLE vp_sesiones DROP CONSTRAINT IF EXISTS vp_sesiones_estado_check;
ALTER TABLE vp_sesiones ADD CONSTRAINT vp_sesiones_estado_check
  CHECK (estado IN ('pendiente','creada','iniciada','finalizada','fallida','ausente','cancelada'));

-- Add new columns
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS room_url text;
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS participantes jsonb;
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS source_event_id text;
ALTER TABLE vp_sesiones ADD COLUMN IF NOT EXISTS cancel_reason text;

-- ═══════════════════════════════════════════════════════════════
-- 2. ALTER vp_artefactos
-- ═══════════════════════════════════════════════════════════════

-- Drop old tipo CHECK and recreate with Sprint 2 values
ALTER TABLE vp_artefactos DROP CONSTRAINT IF EXISTS vp_artefactos_tipo_check;
ALTER TABLE vp_artefactos ADD CONSTRAINT vp_artefactos_tipo_check
  CHECK (tipo IN (
    'recording','audio','transcript','screenshot','document','evidence',
    'foto','adjunto_cliente','adjunto_perito','adjunto_compania','hoja_encargo','declaracion'
  ));

-- Add new columns
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS expediente_id uuid REFERENCES expedientes(id);
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS origen text
  CHECK (origen IN ('webhook','manual','perito','sistema'));
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS provider_url text;
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS duracion_segundos integer;
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS estado_disponibilidad text DEFAULT 'disponible'
  CHECK (estado_disponibilidad IN ('pendiente','disponible','expirado','eliminado'));
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS politica_retencion text DEFAULT '365d';
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS visibility_scope text DEFAULT 'office'
  CHECK (visibility_scope IN ('office','perito','all'));
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS source_event_id text;
ALTER TABLE vp_artefactos ADD COLUMN IF NOT EXISTS created_by uuid;

-- ═══════════════════════════════════════════════════════════════
-- 3. ALTER vp_webhook_logs
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS causation_id text;
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES vp_sesiones(id);
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS videoperitacion_id uuid REFERENCES vp_videoperitaciones(id);
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS processing_error_detail text;

-- ═══════════════════════════════════════════════════════════════
-- 4. CREATE TABLE vp_accesos_artefacto
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vp_accesos_artefacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artefacto_id uuid NOT NULL REFERENCES vp_artefactos(id),
  user_id uuid NOT NULL,
  user_role text NOT NULL,
  access_type text NOT NULL CHECK (access_type IN ('view','download','stream')),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 5. CREATE TABLE vp_transcripciones
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vp_transcripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artefacto_id uuid NOT NULL REFERENCES vp_artefactos(id),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  sesion_id uuid REFERENCES vp_sesiones(id),
  idioma text DEFAULT 'es',
  texto_completo text NOT NULL,
  resumen text,
  highlights text[],
  segmentos jsonb,
  proveedor text,
  source_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 6. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_vp_sesiones_external ON vp_sesiones(external_session_id);
CREATE INDEX IF NOT EXISTS idx_vp_artefactos_sesion ON vp_artefactos(sesion_id);
CREATE INDEX IF NOT EXISTS idx_vp_artefactos_tipo ON vp_artefactos(tipo);
CREATE INDEX IF NOT EXISTS idx_vp_artefactos_expediente ON vp_artefactos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_vp_webhook_logs_type ON vp_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_vp_webhook_logs_session ON vp_webhook_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_vp_accesos_artefacto ON vp_accesos_artefacto(artefacto_id);
CREATE INDEX IF NOT EXISTS idx_vp_transcripciones_vp ON vp_transcripciones(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_transcripciones_search ON vp_transcripciones USING gin(to_tsvector('spanish', texto_completo));

-- ═══════════════════════════════════════════════════════════════
-- 7. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_accesos_artefacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_transcripciones   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN

-- vp_accesos_artefacto: admin/supervisor only (SELECT/INSERT)
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_accesos_artefacto_admin_select') THEN
  CREATE POLICY vp_accesos_artefacto_admin_select ON vp_accesos_artefacto FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor'))
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_accesos_artefacto_admin_insert') THEN
  CREATE POLICY vp_accesos_artefacto_admin_insert ON vp_accesos_artefacto FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor'))
  );
END IF;

-- vp_transcripciones: office roles full access
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_transcripciones_office_all') THEN
  CREATE POLICY vp_transcripciones_office_all ON vp_transcripciones FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_transcripciones: perito SELECT on own VP cases
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_transcripciones_perito_select') THEN
  CREATE POLICY vp_transcripciones_perito_select ON vp_transcripciones FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════
-- 8. REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE vp_sesiones;
ALTER PUBLICATION supabase_realtime ADD TABLE vp_artefactos;

COMMIT;
