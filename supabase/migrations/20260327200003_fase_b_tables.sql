-- ─── FASE B — Tablas de configuración adicionales ────────────────────────────
-- Módulos: 25 (Condiciones Presupuesto), 24 (Mensajes Predefinidos),
--          14 (Correos), 18 (RGPD), 28 (Auto Visitas), 17 (Centralita)

-- ── Condiciones de presupuesto ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS condiciones_presupuesto (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id  UUID        REFERENCES companias(id) ON DELETE CASCADE,
  titulo       TEXT        NOT NULL,
  contenido    TEXT        NOT NULL,
  activa       BOOLEAN     NOT NULL DEFAULT TRUE,
  orden        INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condiciones_presupuesto_compania ON condiciones_presupuesto(compania_id);
CREATE INDEX IF NOT EXISTS idx_condiciones_presupuesto_activa  ON condiciones_presupuesto(activa);

CREATE TRIGGER trg_condiciones_presupuesto_updated_at
  BEFORE UPDATE ON condiciones_presupuesto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE condiciones_presupuesto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "condiciones_presupuesto_select" ON condiciones_presupuesto FOR SELECT TO authenticated USING (true);
CREATE POLICY "condiciones_presupuesto_insert" ON condiciones_presupuesto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "condiciones_presupuesto_update" ON condiciones_presupuesto FOR UPDATE TO authenticated USING (true);
CREATE POLICY "condiciones_presupuesto_delete" ON condiciones_presupuesto FOR DELETE TO authenticated USING (true);

-- ── Mensajes predefinidos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes_predefinidos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id UUID        REFERENCES companias(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'ambos' CHECK (tipo IN ('sms', 'email', 'ambos')),
  asunto      TEXT,
  contenido   TEXT        NOT NULL,
  variables   TEXT[]      NOT NULL DEFAULT '{}',
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_predefinidos_compania ON mensajes_predefinidos(compania_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_predefinidos_tipo     ON mensajes_predefinidos(tipo);
CREATE INDEX IF NOT EXISTS idx_mensajes_predefinidos_activo   ON mensajes_predefinidos(activo);

CREATE TRIGGER trg_mensajes_predefinidos_updated_at
  BEFORE UPDATE ON mensajes_predefinidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE mensajes_predefinidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mensajes_predefinidos_select" ON mensajes_predefinidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "mensajes_predefinidos_insert" ON mensajes_predefinidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mensajes_predefinidos_update" ON mensajes_predefinidos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mensajes_predefinidos_delete" ON mensajes_predefinidos FOR DELETE TO authenticated USING (true);

-- Seed de ejemplo
INSERT INTO mensajes_predefinidos (nombre, tipo, asunto, contenido, variables) VALUES
  ('Confirmación de cita',       'sms',   NULL,                     'Hola {{nombre_asegurado}}, le confirmamos su cita para el {{fecha_cita}} a las {{hora_cita}}. Expediente: {{numero_expediente}}.', ARRAY['nombre_asegurado','fecha_cita','hora_cita','numero_expediente']),
  ('Presupuesto listo',          'email', 'Presupuesto disponible',  'Estimado/a {{nombre_asegurado}},\n\nSu presupuesto para el expediente {{numero_expediente}} ya está disponible. Puede consultarlo en su área de cliente.\n\nSaludos cordiales.', ARRAY['nombre_asegurado','numero_expediente']),
  ('Recordatorio de cita',       'sms',   NULL,                     'Recordatorio: mañana tiene cita a las {{hora_cita}} para el expediente {{numero_expediente}}. Para cambios llame al {{telefono_empresa}}.', ARRAY['hora_cita','numero_expediente','telefono_empresa']),
  ('Trabajo finalizado',         'ambos', 'Trabajo finalizado',     'Estimado/a {{nombre_asegurado}}, le informamos que el trabajo del expediente {{numero_expediente}} ha sido finalizado correctamente.', ARRAY['nombre_asegurado','numero_expediente']),
  ('Bienvenida cliente',         'email', 'Bienvenido/a a {{empresa}}', 'Estimado/a {{nombre_asegurado}},\n\nNos ponemos en contacto con usted en relación al siniestro comunicado. Quedo a su disposición para cualquier consulta.\n\nAtentamente,\n{{nombre_tramitador}}', ARRAY['nombre_asegurado','empresa','nombre_tramitador'])
ON CONFLICT DO NOTHING;

-- ── Cuentas de correo ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS correos_cuentas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id           UUID        REFERENCES companias(id) ON DELETE CASCADE,
  nombre                TEXT        NOT NULL,
  direccion             TEXT        NOT NULL,
  usuario               TEXT        NOT NULL,
  password_encrypted    TEXT,
  servidor_imap         TEXT,
  puerto_imap           INTEGER     DEFAULT 993,
  servidor_smtp         TEXT        NOT NULL,
  puerto_smtp           INTEGER     NOT NULL DEFAULT 587,
  usa_tls               BOOLEAN     NOT NULL DEFAULT TRUE,
  activa                BOOLEAN     NOT NULL DEFAULT TRUE,
  es_remitente_defecto  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correos_cuentas_compania ON correos_cuentas(compania_id);
CREATE INDEX IF NOT EXISTS idx_correos_cuentas_activa   ON correos_cuentas(activa);

CREATE TRIGGER trg_correos_cuentas_updated_at
  BEFORE UPDATE ON correos_cuentas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE correos_cuentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "correos_cuentas_select" ON correos_cuentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "correos_cuentas_insert" ON correos_cuentas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "correos_cuentas_update" ON correos_cuentas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "correos_cuentas_delete" ON correos_cuentas FOR DELETE TO authenticated USING (true);

-- ── RGPD ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rgpd_config (
  empresa_id                        UUID        PRIMARY KEY REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  dias_conservacion_expedientes     INTEGER     NOT NULL DEFAULT 365,
  dias_conservacion_comunicaciones  INTEGER     NOT NULL DEFAULT 180,
  dias_conservacion_evidencias      INTEGER     NOT NULL DEFAULT 365,
  dias_conservacion_facturas        INTEGER     NOT NULL DEFAULT 2555, -- 7 años
  texto_politica                    TEXT,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rgpd_eliminaciones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad      TEXT        NOT NULL,
  entidad_id   UUID        NOT NULL,
  motivo       TEXT,
  actor_id     UUID        REFERENCES auth.users(id),
  eliminado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rgpd_eliminaciones_entidad    ON rgpd_eliminaciones(entidad);
CREATE INDEX IF NOT EXISTS idx_rgpd_eliminaciones_entidad_id ON rgpd_eliminaciones(entidad_id);
CREATE INDEX IF NOT EXISTS idx_rgpd_eliminaciones_actor      ON rgpd_eliminaciones(actor_id);

ALTER TABLE rgpd_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rgpd_eliminaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rgpd_config_select" ON rgpd_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "rgpd_config_insert" ON rgpd_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rgpd_config_update" ON rgpd_config FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rgpd_eliminaciones_select" ON rgpd_eliminaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "rgpd_eliminaciones_insert" ON rgpd_eliminaciones FOR INSERT TO authenticated WITH CHECK (true);

-- ── Auto Visitas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_visitas_config (
  empresa_id             UUID        PRIMARY KEY REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  activo                 BOOLEAN     NOT NULL DEFAULT FALSE,
  horas_aviso_previo     INTEGER     NOT NULL DEFAULT 24,
  max_cambios_cita       INTEGER     NOT NULL DEFAULT 2,
  permitir_cancelacion   BOOLEAN     NOT NULL DEFAULT TRUE,
  horas_min_cancelacion  INTEGER     NOT NULL DEFAULT 2,
  config_operarios       JSONB       NOT NULL DEFAULT '{}',
  config_companias       JSONB       NOT NULL DEFAULT '{}',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE auto_visitas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto_visitas_select" ON auto_visitas_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "auto_visitas_insert" ON auto_visitas_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auto_visitas_update" ON auto_visitas_config FOR UPDATE TO authenticated USING (true);

-- ── Centralita ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS centralita_config (
  empresa_id UUID        PRIMARY KEY REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  proveedor  TEXT,
  config     JSONB       NOT NULL DEFAULT '{}',
  activa     BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS centralita_llamadas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id       UUID        REFERENCES companias(id),
  origen            TEXT,
  destino           TEXT,
  tipo              TEXT        CHECK (tipo IN ('entrante','saliente','perdida')),
  duracion_segundos INTEGER,
  expediente_id     UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
  usuario_id        UUID        REFERENCES auth.users(id),
  iniciada_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_centralita_llamadas_compania    ON centralita_llamadas(compania_id);
CREATE INDEX IF NOT EXISTS idx_centralita_llamadas_iniciada_at ON centralita_llamadas(iniciada_at DESC);
CREATE INDEX IF NOT EXISTS idx_centralita_llamadas_tipo        ON centralita_llamadas(tipo);
CREATE INDEX IF NOT EXISTS idx_centralita_llamadas_expediente  ON centralita_llamadas(expediente_id);

ALTER TABLE centralita_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE centralita_llamadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "centralita_config_select" ON centralita_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "centralita_config_insert" ON centralita_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "centralita_config_update" ON centralita_config FOR UPDATE TO authenticated USING (true);

CREATE POLICY "centralita_llamadas_select" ON centralita_llamadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "centralita_llamadas_insert" ON centralita_llamadas FOR INSERT TO authenticated WITH CHECK (true);
