-- EP-11b: Videoperitación — Sprint 1 (vertical slice)
-- Migration: 00012_ep11b_videoperitacion.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════

-- ─── vp_videoperitaciones (main case) ───
CREATE TABLE IF NOT EXISTS vp_videoperitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES expedientes(id),
  perito_id uuid REFERENCES peritos(id),
  numero_caso text UNIQUE NOT NULL,  -- VP-YYYY-NNNNN
  estado text NOT NULL DEFAULT 'encargo_recibido'
    CHECK (estado IN (
      'encargo_recibido','pendiente_contacto','contactado','agendado',
      'link_enviado','sesion_programada','sesion_en_curso','sesion_finalizada',
      'pendiente_informe','informe_borrador','informe_validado',
      'valoracion_calculada','facturado','enviado','cerrado',
      'cancelado','sesion_fallida','cliente_ausente'
    )),
  prioridad text DEFAULT 'media'
    CHECK (prioridad IN ('baja','media','alta','urgente')),
  motivo_tecnico text,
  origen text DEFAULT 'manual'
    CHECK (origen IN ('manual','api','webhook','compania')),
  referencia_externa text,
  deadline timestamptz,
  cancelado_at timestamptz,
  cancelado_motivo text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_encargos (order intake + claim declaration) ───
CREATE TABLE IF NOT EXISTS vp_encargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('hoja_encargo','declaracion_siniestro')),
  contenido text NOT NULL,
  datos_estructurados jsonb,
  adjuntos_refs text[] DEFAULT '{}',
  registrado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_comunicaciones (case communications) ───
CREATE TABLE IF NOT EXISTS vp_comunicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  tipo text NOT NULL
    CHECK (tipo IN ('llamada_entrante','llamada_saliente','email_entrante','email_saliente','nota_interna','sistema')),
  emisor_tipo text
    CHECK (emisor_tipo IN ('oficina','cliente','compania','perito')),
  resultado text
    CHECK (resultado IN ('contactado','no_contesta','buzon_voz','ocupado','email_enviado','email_rebotado','email_leido')),
  asunto text,
  contenido text NOT NULL,
  adjuntos_refs text[] DEFAULT '{}',
  actor_id uuid NOT NULL,
  actor_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_intentos_contacto (contact attempts) ───
CREATE TABLE IF NOT EXISTS vp_intentos_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  intento_numero integer NOT NULL DEFAULT 1,
  canal text NOT NULL
    CHECK (canal IN ('telefono','email','sms')),
  resultado text NOT NULL
    CHECK (resultado IN ('contactado','no_contesta','buzon_voz','ocupado','no_disponible','email_enviado')),
  notas text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_agenda (appointment scheduling) ───
CREATE TABLE IF NOT EXISTS vp_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  estado text NOT NULL DEFAULT 'programada'
    CHECK (estado IN ('programada','confirmada','realizada','cancelada','no_show','reprogramada')),
  motivo_cancelacion text,
  motivo_reprogramacion text,
  link_externo text,
  link_token text,
  link_expira_at timestamptz,
  link_enviado_at timestamptz,
  link_reenvios integer DEFAULT 0,
  notas text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_sesiones (stub for Sprint 2 webhooks) ───
CREATE TABLE IF NOT EXISTS vp_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  agenda_id uuid REFERENCES vp_agenda(id),
  external_session_id text,
  estado text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','creada','iniciada','finalizada','fallida')),
  iniciada_at timestamptz,
  finalizada_at timestamptz,
  duracion_segundos integer,
  participantes_conectados integer DEFAULT 0,
  incidencias text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_consentimientos (consent tracking) ───
CREATE TABLE IF NOT EXISTS vp_consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  tipo text NOT NULL
    CHECK (tipo IN ('videoperitacion','grabacion_video','grabacion_audio','transcripcion')),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','otorgado','denegado','revocado')),
  otorgado_por text,
  otorgado_at timestamptz,
  canal text
    CHECK (canal IN ('verbal','email','plataforma','formulario')),
  ip text,
  evidencia_ref text,
  base_legal text DEFAULT 'RGPD Art. 6.1.b',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_webhook_logs (external webhook idempotency) ───
CREATE TABLE IF NOT EXISTS vp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ─── vp_artefactos (stub for Sprint 2 artifacts) ───
CREATE TABLE IF NOT EXISTS vp_artefactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid NOT NULL REFERENCES vp_videoperitaciones(id),
  sesion_id uuid REFERENCES vp_sesiones(id),
  tipo text NOT NULL
    CHECK (tipo IN ('foto','documento','captura','adjunto_cliente','adjunto_perito','adjunto_compania','hoja_encargo','declaracion')),
  storage_path text,
  nombre_original text,
  mime_type text,
  tamano_bytes bigint,
  clasificacion text,
  notas text,
  subido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_vp_videoperitaciones_expediente ON vp_videoperitaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_vp_videoperitaciones_perito ON vp_videoperitaciones(perito_id);
CREATE INDEX IF NOT EXISTS idx_vp_videoperitaciones_estado ON vp_videoperitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_vp_videoperitaciones_numero_caso ON vp_videoperitaciones(numero_caso);
CREATE INDEX IF NOT EXISTS idx_vp_comunicaciones_vp ON vp_comunicaciones(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_agenda_vp ON vp_agenda(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_agenda_fecha ON vp_agenda(fecha);
CREATE INDEX IF NOT EXISTS idx_vp_sesiones_vp ON vp_sesiones(videoperitacion_id);
CREATE INDEX IF NOT EXISTS idx_vp_webhook_logs_event ON vp_webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_vp_artefactos_vp ON vp_artefactos(videoperitacion_id);

-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Pending-contact queue
CREATE OR REPLACE VIEW v_vp_pendientes_contacto AS
SELECT
  vp.id,
  vp.numero_caso,
  vp.estado,
  vp.prioridad,
  vp.deadline,
  vp.created_at,
  e.numero_expediente,
  e.tipo_siniestro,
  a.nombre   AS asegurado_nombre,
  a.apellidos AS asegurado_apellidos,
  a.telefono AS asegurado_telefono,
  a.email    AS asegurado_email,
  ic.ultimo_intento_at,
  ic.total_intentos
FROM vp_videoperitaciones vp
JOIN expedientes e ON e.id = vp.expediente_id
LEFT JOIN asegurados a ON a.id = e.asegurado_id
LEFT JOIN LATERAL (
  SELECT
    MAX(created_at) AS ultimo_intento_at,
    COUNT(*)::integer AS total_intentos
  FROM vp_intentos_contacto
  WHERE videoperitacion_id = vp.id
) ic ON true
WHERE vp.estado IN ('encargo_recibido','pendiente_contacto');

-- Upcoming VP appointments
CREATE OR REPLACE VIEW v_vp_agenda AS
SELECT
  ag.id AS agenda_id,
  ag.fecha,
  ag.hora_inicio,
  ag.hora_fin,
  ag.estado AS agenda_estado,
  ag.link_externo,
  ag.link_enviado_at,
  vp.id AS videoperitacion_id,
  vp.numero_caso,
  vp.estado AS vp_estado,
  vp.prioridad,
  e.numero_expediente,
  e.tipo_siniestro,
  a.nombre   AS asegurado_nombre,
  a.apellidos AS asegurado_apellidos,
  a.telefono AS asegurado_telefono,
  p.nombre   AS perito_nombre,
  p.apellidos AS perito_apellidos
FROM vp_agenda ag
JOIN vp_videoperitaciones vp ON vp.id = ag.videoperitacion_id
JOIN expedientes e ON e.id = vp.expediente_id
LEFT JOIN asegurados a ON a.id = e.asegurado_id
LEFT JOIN peritos p ON p.id = vp.perito_id
WHERE ag.estado NOT IN ('cancelada')
  AND ag.fecha >= CURRENT_DATE;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vp_videoperitaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_encargos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_comunicaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_intentos_contacto    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_agenda               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_sesiones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_consentimientos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_webhook_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_artefactos           ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user has an office role
-- (avoids repeating the same subquery in every policy)

-- ── Office roles: full access on all vp_* tables ──

DO $$ BEGIN

-- vp_videoperitaciones
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_videoperitaciones_office_select') THEN
  CREATE POLICY vp_videoperitaciones_office_select ON vp_videoperitaciones FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_videoperitaciones_office_insert') THEN
  CREATE POLICY vp_videoperitaciones_office_insert ON vp_videoperitaciones FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_videoperitaciones_office_update') THEN
  CREATE POLICY vp_videoperitaciones_office_update ON vp_videoperitaciones FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_encargos
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_encargos_office_all') THEN
  CREATE POLICY vp_encargos_office_all ON vp_encargos FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_comunicaciones
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_comunicaciones_office_all') THEN
  CREATE POLICY vp_comunicaciones_office_all ON vp_comunicaciones FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_intentos_contacto
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_intentos_contacto_office_all') THEN
  CREATE POLICY vp_intentos_contacto_office_all ON vp_intentos_contacto FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_agenda
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_agenda_office_all') THEN
  CREATE POLICY vp_agenda_office_all ON vp_agenda FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_sesiones
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_sesiones_office_all') THEN
  CREATE POLICY vp_sesiones_office_all ON vp_sesiones FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_consentimientos
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_consentimientos_office_all') THEN
  CREATE POLICY vp_consentimientos_office_all ON vp_consentimientos FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- vp_webhook_logs
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_webhook_logs_office_all') THEN
  CREATE POLICY vp_webhook_logs_office_all ON vp_webhook_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor'))
  );
END IF;

-- vp_artefactos
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_artefactos_office_all') THEN
  CREATE POLICY vp_artefactos_office_all ON vp_artefactos FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin','supervisor','tramitador'))
  );
END IF;

-- ── Perito role: SELECT on assigned VP cases ──

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_videoperitaciones_perito_select') THEN
  CREATE POLICY vp_videoperitaciones_perito_select ON vp_videoperitaciones FOR SELECT USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_encargos_perito_select') THEN
  CREATE POLICY vp_encargos_perito_select ON vp_encargos FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_comunicaciones_perito_select') THEN
  CREATE POLICY vp_comunicaciones_perito_select ON vp_comunicaciones FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_agenda_perito_select') THEN
  CREATE POLICY vp_agenda_perito_select ON vp_agenda FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_sesiones_perito_select') THEN
  CREATE POLICY vp_sesiones_perito_select ON vp_sesiones FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_consentimientos_perito_select') THEN
  CREATE POLICY vp_consentimientos_perito_select ON vp_consentimientos FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_artefactos_perito_select') THEN
  CREATE POLICY vp_artefactos_perito_select ON vp_artefactos FOR SELECT USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

-- ── Perito role: INSERT/UPDATE on comunicaciones & artefactos for own cases ──

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_comunicaciones_perito_insert') THEN
  CREATE POLICY vp_comunicaciones_perito_insert ON vp_comunicaciones FOR INSERT WITH CHECK (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_comunicaciones_perito_update') THEN
  CREATE POLICY vp_comunicaciones_perito_update ON vp_comunicaciones FOR UPDATE USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_artefactos_perito_insert') THEN
  CREATE POLICY vp_artefactos_perito_insert ON vp_artefactos FOR INSERT WITH CHECK (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vp_artefactos_perito_update') THEN
  CREATE POLICY vp_artefactos_perito_update ON vp_artefactos FOR UPDATE USING (
    videoperitacion_id IN (
      SELECT id FROM vp_videoperitaciones WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );
END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE vp_videoperitaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE vp_comunicaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE vp_agenda;

COMMIT;
