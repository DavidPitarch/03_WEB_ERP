-- =============================================================================
-- SEGUIMIENTO BLOQUE 1 — Secciones 1-5
-- S1: Presencia/bloqueo colaborativo
-- S3: Tipos de compañía dinámicos + eventos + pendiente_de
-- S5: Extensiones asegurado para comunicaciones + textos predefinidos
-- =============================================================================

-- ─── S1: Presencia / Bloqueo colaborativo ────────────────────────────────────
-- Un único registro por expediente. Se renueva con heartbeat cada 30s.
-- Si last_heartbeat > 2min → expediente liberado automáticamente.

CREATE TABLE IF NOT EXISTS expediente_presencia (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id    UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  compania_id      UUID NOT NULL,
  user_id          UUID NOT NULL,
  user_nombre      TEXT NOT NULL,
  locked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo un usuario puede tener el expediente bloqueado a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_presencia
  ON expediente_presencia (expediente_id);

CREATE INDEX IF NOT EXISTS idx_expediente_presencia_compania
  ON expediente_presencia (compania_id);

CREATE INDEX IF NOT EXISTS idx_expediente_presencia_heartbeat
  ON expediente_presencia (last_heartbeat);

ALTER TABLE expediente_presencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presencia_select" ON expediente_presencia
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "presencia_insert" ON expediente_presencia
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "presencia_update" ON expediente_presencia
  FOR UPDATE USING (
    -- El propio usuario puede renovar su heartbeat
    user_id = auth.uid()
    OR
    -- Admin/supervisor puede forzar el desbloqueo
    has_any_role(ARRAY['admin', 'supervisor'])
  );

CREATE POLICY "presencia_delete" ON expediente_presencia
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    has_any_role(ARRAY['admin', 'supervisor'])
  );

-- ─── S3: Campo operacional pendiente_de (separado del FSM estado) ─────────────
-- El FSM estado gobierna el ciclo de vida. pendiente_de es un estado operacional
-- más granular usado por los tramitadores (73 opciones vs 13 FSM).

ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS pendiente_de TEXT;

-- ─── S3: Tipos de compañía (dinámicos por compañía) ──────────────────────────
-- Sustituye los tags estáticos por tipos configurables por compañía aseguradora.
-- El modelo anterior (expediente_etiquetas) se mantiene para etiquetas libres.

CREATE TABLE IF NOT EXISTS tipos_compania (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id UUID NOT NULL,
  nombre      TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (compania_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_tipos_compania_compania
  ON tipos_compania (compania_id, activo, orden);

ALTER TABLE tipos_compania ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_compania_select" ON tipos_compania
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "tipos_compania_insert" ON tipos_compania
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "tipos_compania_update" ON tipos_compania
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "tipos_compania_delete" ON tipos_compania
  FOR DELETE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- Tabla de unión: tipos activos para un expediente concreto
CREATE TABLE IF NOT EXISTS expediente_tipos_compania (
  expediente_id  UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  tipo_id        UUID NOT NULL REFERENCES tipos_compania(id) ON DELETE CASCADE,
  compania_id    UUID NOT NULL,
  activado_por   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (expediente_id, tipo_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_tipos_compania_exp
  ON expediente_tipos_compania (expediente_id);

CREATE INDEX IF NOT EXISTS idx_exp_tipos_compania_cia
  ON expediente_tipos_compania (compania_id);

ALTER TABLE expediente_tipos_compania ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exp_tipos_select" ON expediente_tipos_compania
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "exp_tipos_insert" ON expediente_tipos_compania
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "exp_tipos_delete" ON expediente_tipos_compania
  FOR DELETE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- ─── S3: Eventos configurados por compañía ────────────────────────────────────
-- Botones de acción automática configurados por la compañía aseguradora.
-- Al ejecutar un evento se puede: cambiar estado, crear cita, enviar notificación, etc.

CREATE TABLE IF NOT EXISTS eventos_compania (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id    UUID NOT NULL,
  nombre         TEXT NOT NULL,
  tipo_evento    TEXT NOT NULL
    CHECK (tipo_evento IN ('autovisita','notificacion','cambio_estado','cambio_pendiente_de','tarea')),
  configuracion  JSONB NOT NULL DEFAULT '{}',
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  orden          INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_compania_cia
  ON eventos_compania (compania_id, activo, orden);

ALTER TABLE eventos_compania ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_compania_select" ON eventos_compania
  FOR SELECT USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "eventos_compania_insert" ON eventos_compania
  FOR INSERT WITH CHECK (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "eventos_compania_update" ON eventos_compania
  FOR UPDATE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "eventos_compania_delete" ON eventos_compania
  FOR DELETE USING (
    has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- ─── S5: Extensiones de asegurados para panel de comunicaciones ───────────────

ALTER TABLE asegurados
  ADD COLUMN IF NOT EXISTS telefono_movil     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telefono2_movil    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telefono3          TEXT,
  ADD COLUMN IF NOT EXISTS telefono3_desc     TEXT,
  ADD COLUMN IF NOT EXISTS telefono3_movil    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telefono_prioridad INTEGER DEFAULT 1 CHECK (telefono_prioridad IN (1,2,3)),
  ADD COLUMN IF NOT EXISTS consentimiento_tipo TEXT DEFAULT 'sms'
    CHECK (consentimiento_tipo IN ('sms','email','ambos'));

-- Rellenar consentimiento_tipo para registros existentes donde consentimiento_com = 'acepta'
UPDATE asegurados
SET consentimiento_tipo = 'sms'
WHERE consentimiento_tipo IS NULL;

-- ─── S5: Textos predefinidos SMS/email ────────────────────────────────────────
-- compania_id NULL = global (disponible para todas las compañías).

CREATE TABLE IF NOT EXISTS textos_predefinidos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id UUID,                -- NULL = global
  tipo        TEXT NOT NULL CHECK (tipo IN ('sms','email')),
  nombre      TEXT NOT NULL,
  asunto      TEXT,                -- solo para email
  cuerpo      TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textos_pred_tipo
  ON textos_predefinidos (tipo, activo);

CREATE INDEX IF NOT EXISTS idx_textos_pred_compania
  ON textos_predefinidos (compania_id);

ALTER TABLE textos_predefinidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "textos_pred_select" ON textos_predefinidos
  FOR SELECT USING (
    compania_id IS NULL
    OR has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "textos_pred_insert" ON textos_predefinidos
  FOR INSERT WITH CHECK (
    compania_id IS NULL
    OR has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "textos_pred_update" ON textos_predefinidos
  FOR UPDATE USING (
    compania_id IS NULL
    OR has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

CREATE POLICY "textos_pred_delete" ON textos_predefinidos
  FOR DELETE USING (
    compania_id IS NULL
    OR has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
  );

-- Textos predefinidos globales (seed)
INSERT INTO textos_predefinidos (tipo, nombre, asunto, cuerpo, orden)
VALUES
  ('email','CONFORME TRABAJOS MAIL','Conformidad trabajos realizados',
   'Estimado cliente, le confirmamos que los trabajos realizados en su domicilio han sido completados satisfactoriamente. Rogamos confirme su conformidad respondiendo a este correo.',1),
  ('email','CONFORMIDAD ABONO, RENUNCIA EXTRAS','Conformidad abono y renuncia extras',
   'Estimado cliente, adjuntamos documentación de conformidad para el abono y renuncia de trabajos extra pendientes.',2),
  ('email','ENLACE RESEÑA GOOGLE','Su opinión es importante',
   'Estimado cliente, agradeceríamos mucho que nos dejara una reseña en Google sobre el servicio recibido. Su opinión nos ayuda a mejorar continuamente.',3),
  ('email','Envío Factura','Factura expediente',
   'Estimado cliente, le adjuntamos la factura correspondiente a los trabajos realizados en su domicilio. Quedo a su disposición para cualquier consulta.',4),
  ('sms','CONFORME TRABAJOS, NO PENDIENTES', NULL,
   'Estimado cliente, confirmamos finalización de trabajos en su domicilio. Si tiene cualquier incidencia, contacte con nosotros.',1),
  ('sms','Envío cita planning Aseg./Perj.', NULL,
   'Le informamos que tiene una cita programada para revisión en su domicilio. Le contactaremos para confirmar.',2),
  ('sms','Envío cita planning Operario', NULL,
   'Tiene asignada una visita técnica. El operario se pondrá en contacto con usted para confirmar el horario.',3),
  ('sms','ILOCALIZABLE', NULL,
   'Hemos intentado contactar con usted sin éxito. Por favor, contacte con nosotros a la mayor brevedad posible.',4),
  ('sms','Incidencia Luz', NULL,
   'Le informamos que hemos tramitado la incidencia relacionada con el suministro eléctrico de su domicilio.',5),
  ('sms','MARCA/MODELO LOZA SANITARIA', NULL,
   'Para tramitar la reparación de su loza sanitaria, necesitamos que nos indique marca y modelo del elemento dañado.',6)
ON CONFLICT DO NOTHING;
