-- EP-11b: Videoperitación — Sprint 3 (cockpit pericial y resultado técnico)
-- Migration: 00014_ep11b_sprint3_cockpit_pericial.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. vp_dictamenes — Expert assessment / technical resolution
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vp_dictamenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  expediente_id uuid NOT NULL REFERENCES expedientes(id),
  perito_id uuid NOT NULL REFERENCES peritos(id),
  sesion_id uuid REFERENCES vp_sesiones(id),
  version integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','emitido','validado','rechazado','requiere_mas_informacion')),
  tipo_resolucion text
    CHECK (tipo_resolucion IN ('aprobacion','rechazo','solicitud_informacion','instruccion_tecnica','cierre_revision')),
  conclusiones text,
  observaciones text,
  hallazgos jsonb,  -- structured findings: [{zona, dano, gravedad, descripcion}]
  recomendaciones text,
  motivo_rechazo text,
  informacion_solicitada text,
  instruccion_tecnica text,
  impacto_expediente text
    CHECK (impacto_expediente IN ('mantener_pendiente','reactivar','redirigir','cerrar','sin_impacto')),
  expediente_estado_previo text,
  expediente_estado_nuevo text,
  artefactos_revisados uuid[] DEFAULT '{}',  -- references to vp_artefactos reviewed
  sesiones_revisadas uuid[] DEFAULT '{}',    -- references to vp_sesiones reviewed
  emitido_at timestamptz,
  validado_at timestamptz,
  validado_por uuid,
  rechazado_at timestamptz,
  rechazado_por uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. vp_dictamen_versiones — Version history for dictamenes
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vp_dictamen_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dictamen_id uuid NOT NULL REFERENCES vp_dictamenes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  estado text NOT NULL,
  conclusiones text,
  observaciones text,
  hallazgos jsonb,
  recomendaciones text,
  motivo_rechazo text,
  informacion_solicitada text,
  instruccion_tecnica text,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_by uuid NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 3. vp_instrucciones — Explicit instructions from perito to office
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vp_instrucciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  dictamen_id uuid REFERENCES vp_dictamenes(id),
  expediente_id uuid NOT NULL REFERENCES expedientes(id),
  perito_id uuid NOT NULL REFERENCES peritos(id),
  tipo text NOT NULL
    CHECK (tipo IN ('continuidad','redireccion','suspension','ampliacion','cierre')),
  descripcion text NOT NULL,
  prioridad text DEFAULT 'media'
    CHECK (prioridad IN ('baja','media','alta','urgente')),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aceptada','rechazada','ejecutada')),
  respuesta_oficina text,
  respondido_por uuid,
  respondido_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 4. Add pendiente_informe to VP estado if not exists (already in Sprint 1)
-- Add 'pendiente_perito' and 'revision_pericial' to VP estados
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_videoperitaciones DROP CONSTRAINT IF EXISTS vp_videoperitaciones_estado_check;
ALTER TABLE vp_videoperitaciones ADD CONSTRAINT vp_videoperitaciones_estado_check
  CHECK (estado IN (
    'encargo_recibido','pendiente_contacto','contactado','agendado',
    'link_enviado','sesion_programada','sesion_en_curso','sesion_finalizada',
    'pendiente_perito','revision_pericial',
    'pendiente_informe','informe_borrador','informe_validado',
    'valoracion_calculada','facturado','enviado','cerrado',
    'cancelado','sesion_fallida','cliente_ausente'
  ));

-- ═══════════════════════════════════════════════════════════════
-- 5. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_vp_dictamenes_vp ON vp_dictamenes(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_dictamenes_expediente ON vp_dictamenes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_vp_dictamenes_perito ON vp_dictamenes(perito_id);
CREATE INDEX IF NOT EXISTS idx_vp_dictamenes_estado ON vp_dictamenes(estado);
CREATE INDEX IF NOT EXISTS idx_vp_dictamen_versiones_dictamen ON vp_dictamen_versiones(dictamen_id);
CREATE INDEX IF NOT EXISTS idx_vp_instrucciones_vp ON vp_instrucciones(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_instrucciones_expediente ON vp_instrucciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_vp_instrucciones_estado ON vp_instrucciones(estado);

-- ═══════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_dictamenes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_dictamen_versiones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_instrucciones       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN

-- vp_dictamenes: office full access
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamenes_office_all') THEN
  CREATE POLICY vp_dictamenes_office_all ON vp_dictamenes FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_dictamenes: perito SELECT + INSERT + UPDATE on own VP cases
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamenes_perito_select') THEN
  CREATE POLICY vp_dictamenes_perito_select ON vp_dictamenes FOR SELECT USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamenes_perito_insert') THEN
  CREATE POLICY vp_dictamenes_perito_insert ON vp_dictamenes FOR INSERT WITH CHECK (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamenes_perito_update') THEN
  CREATE POLICY vp_dictamenes_perito_update ON vp_dictamenes FOR UPDATE USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;

-- vp_dictamen_versiones: office full access, perito read on own
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamen_versiones_office_all') THEN
  CREATE POLICY vp_dictamen_versiones_office_all ON vp_dictamen_versiones FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_dictamen_versiones_perito_select') THEN
  CREATE POLICY vp_dictamen_versiones_perito_select ON vp_dictamen_versiones FOR SELECT USING (
    dictamen_id IN (SELECT id FROM vp_dictamenes WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid()))
  );
END IF;

-- vp_instrucciones: office full access
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_instrucciones_office_all') THEN
  CREATE POLICY vp_instrucciones_office_all ON vp_instrucciones FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_instrucciones: perito SELECT + INSERT on own
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_instrucciones_perito_select') THEN
  CREATE POLICY vp_instrucciones_perito_select ON vp_instrucciones FOR SELECT USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_instrucciones_perito_insert') THEN
  CREATE POLICY vp_instrucciones_perito_insert ON vp_instrucciones FOR INSERT WITH CHECK (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════
-- 7. REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE vp_dictamenes;
ALTER PUBLICATION supabase_realtime ADD TABLE vp_instrucciones;

-- ═══════════════════════════════════════════════════════════════
-- 8. Webhook hardening: add schema_version and validated columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS schema_version text DEFAULT '1.0';
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS payload_validated boolean DEFAULT false;
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz;
ALTER TABLE vp_webhook_logs ADD COLUMN IF NOT EXISTS reprocess_count integer DEFAULT 0;

COMMIT;
