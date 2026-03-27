-- ─── FASE C — Tablas para módulos complejos ──────────────────────────────────
-- Módulos: 10 (Líneas Facturación), 11 (Eventos/Automatizaciones),
--          12 (Encuestas), 15 (Plantillas Documentos), 16 (Campos Personalizados)

-- ── Líneas de facturación (conceptos reutilizables) ───────────────────────────
CREATE TABLE IF NOT EXISTS lineas_facturacion (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id  UUID        REFERENCES companias(id) ON DELETE CASCADE,
  codigo       TEXT        UNIQUE,
  descripcion  TEXT        NOT NULL,
  unidad       TEXT        NOT NULL DEFAULT 'ud',
  precio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo_iva     TEXT        NOT NULL DEFAULT 'general' CHECK (tipo_iva IN ('general','reducido','superreducido','exento')),
  porcentaje_iva NUMERIC(5,2) NOT NULL DEFAULT 21,
  activa       BOOLEAN     NOT NULL DEFAULT TRUE,
  orden        INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineas_facturacion_compania ON lineas_facturacion(compania_id);
CREATE INDEX IF NOT EXISTS idx_lineas_facturacion_activa   ON lineas_facturacion(activa);

CREATE TRIGGER trg_lineas_facturacion_updated_at
  BEFORE UPDATE ON lineas_facturacion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lineas_facturacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lineas_facturacion_select" ON lineas_facturacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "lineas_facturacion_insert" ON lineas_facturacion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lineas_facturacion_update" ON lineas_facturacion FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lineas_facturacion_delete" ON lineas_facturacion FOR DELETE TO authenticated USING (true);

-- Seed de líneas comunes
INSERT INTO lineas_facturacion (codigo, descripcion, unidad, precio, tipo_iva, porcentaje_iva) VALUES
  ('VISITA',   'Visita de inspección',       'visita', 0.00,  'general',      21),
  ('INFORME',  'Elaboración de informe',     'informe', 0.00, 'general',      21),
  ('MANO_OBR', 'Mano de obra',               'h',       0.00, 'general',      21),
  ('DESPLA',   'Desplazamiento',             'km',      0.00, 'general',      21),
  ('MATERIA',  'Material',                   'ud',      0.00, 'general',      21),
  ('URGENCIA', 'Suplemento urgencia',        'ud',      0.00, 'general',      21),
  ('NOCHE',    'Suplemento nocturno/festivo','ud',      0.00, 'general',      21)
ON CONFLICT (codigo) DO NOTHING;

-- ── Reglas de automatización (Eventos) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reglas_automatizacion (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id   UUID        REFERENCES companias(id) ON DELETE CASCADE,
  nombre        TEXT        NOT NULL,
  descripcion   TEXT,
  trigger_tipo  TEXT        NOT NULL CHECK (trigger_tipo IN ('campo_cambia','tiempo_transcurrido','creacion','cierre','asignacion')),
  trigger_config JSONB      NOT NULL DEFAULT '{}',
  accion_tipo   TEXT        NOT NULL CHECK (accion_tipo IN ('enviar_sms','enviar_email','crear_tarea','webhook','notificacion')),
  accion_config JSONB       NOT NULL DEFAULT '{}',
  activa        BOOLEAN     NOT NULL DEFAULT TRUE,
  orden         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reglas_automatizacion_activa ON reglas_automatizacion(activa);

CREATE TRIGGER trg_reglas_automatizacion_updated_at
  BEFORE UPDATE ON reglas_automatizacion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE reglas_automatizacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglas_automatizacion_select" ON reglas_automatizacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "reglas_automatizacion_insert" ON reglas_automatizacion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reglas_automatizacion_update" ON reglas_automatizacion FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reglas_automatizacion_delete" ON reglas_automatizacion FOR DELETE TO authenticated USING (true);

-- ── Encuestas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id  UUID        REFERENCES companias(id) ON DELETE CASCADE,
  titulo       TEXT        NOT NULL,
  descripcion  TEXT,
  tipo         TEXT        NOT NULL DEFAULT 'satisfaccion' CHECK (tipo IN ('satisfaccion','nps','personalizada')),
  activa       BOOLEAN     NOT NULL DEFAULT TRUE,
  envio_auto   BOOLEAN     NOT NULL DEFAULT FALSE,
  dias_espera  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preguntas_encuesta (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id UUID        NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  texto       TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'escala' CHECK (tipo IN ('escala','nps','texto','opcion_multiple','si_no')),
  opciones    TEXT[]      NOT NULL DEFAULT '{}',
  obligatoria BOOLEAN     NOT NULL DEFAULT TRUE,
  orden       INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS respuestas_encuesta (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id UUID        NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  expediente_id UUID      REFERENCES expedientes(id) ON DELETE SET NULL,
  asegurado_id  UUID,
  respuestas  JSONB       NOT NULL DEFAULT '{}',
  score_nps   INTEGER,
  completada  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_encuesta_encuesta ON preguntas_encuesta(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_encuesta ON respuestas_encuesta(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_expediente ON respuestas_encuesta(expediente_id);

CREATE TRIGGER trg_encuestas_updated_at
  BEFORE UPDATE ON encuestas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE encuestas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas_encuesta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_encuesta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encuestas_select" ON encuestas FOR SELECT TO authenticated USING (true);
CREATE POLICY "encuestas_insert" ON encuestas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "encuestas_update" ON encuestas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "encuestas_delete" ON encuestas FOR DELETE TO authenticated USING (true);

CREATE POLICY "preguntas_encuesta_select" ON preguntas_encuesta FOR SELECT TO authenticated USING (true);
CREATE POLICY "preguntas_encuesta_insert" ON preguntas_encuesta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "preguntas_encuesta_update" ON preguntas_encuesta FOR UPDATE TO authenticated USING (true);
CREATE POLICY "preguntas_encuesta_delete" ON preguntas_encuesta FOR DELETE TO authenticated USING (true);

CREATE POLICY "respuestas_encuesta_select" ON respuestas_encuesta FOR SELECT TO authenticated USING (true);
CREATE POLICY "respuestas_encuesta_insert" ON respuestas_encuesta FOR INSERT TO authenticated WITH CHECK (true);

-- ── Plantillas de documentos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plantillas_documento (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id               UUID        REFERENCES companias(id) ON DELETE CASCADE,
  nombre                    TEXT        NOT NULL,
  seccion                   TEXT,
  fichero_url               TEXT,
  palabras_clave            TEXT[]      NOT NULL DEFAULT '{}',
  requiere_firma_operario   BOOLEAN     NOT NULL DEFAULT FALSE,
  requiere_firma_asegurado  BOOLEAN     NOT NULL DEFAULT FALSE,
  activa                    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_documento_compania ON plantillas_documento(compania_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_documento_activa   ON plantillas_documento(activa);

CREATE TRIGGER trg_plantillas_documento_updated_at
  BEFORE UPDATE ON plantillas_documento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE plantillas_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plantillas_documento_select" ON plantillas_documento FOR SELECT TO authenticated USING (true);
CREATE POLICY "plantillas_documento_insert" ON plantillas_documento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "plantillas_documento_update" ON plantillas_documento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "plantillas_documento_delete" ON plantillas_documento FOR DELETE TO authenticated USING (true);

-- ── Grupos y campos personalizados ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos_campos (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id  UUID    REFERENCES companias(id) ON DELETE CASCADE,
  nombre       TEXT    NOT NULL,
  entidad      TEXT    NOT NULL DEFAULT 'expediente',
  orden        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campos_personalizados (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    UUID    NOT NULL REFERENCES grupos_campos(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  tipo        TEXT    NOT NULL DEFAULT 'text' CHECK (tipo IN ('text','number','date','select','checkbox','textarea')),
  opciones    TEXT[]  NOT NULL DEFAULT '{}',
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  orden       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_grupos_campos_compania ON grupos_campos(compania_id);
CREATE INDEX IF NOT EXISTS idx_campos_personalizados_grupo ON campos_personalizados(grupo_id);

ALTER TABLE grupos_campos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_campos_select" ON grupos_campos FOR SELECT TO authenticated USING (true);
CREATE POLICY "grupos_campos_insert" ON grupos_campos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "grupos_campos_update" ON grupos_campos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "grupos_campos_delete" ON grupos_campos FOR DELETE TO authenticated USING (true);

CREATE POLICY "campos_personalizados_select" ON campos_personalizados FOR SELECT TO authenticated USING (true);
CREATE POLICY "campos_personalizados_insert" ON campos_personalizados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campos_personalizados_update" ON campos_personalizados FOR UPDATE TO authenticated USING (true);
CREATE POLICY "campos_personalizados_delete" ON campos_personalizados FOR DELETE TO authenticated USING (true);
