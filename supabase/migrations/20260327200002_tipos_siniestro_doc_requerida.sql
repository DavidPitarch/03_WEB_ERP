-- Migration: 20260327200002_tipos_siniestro_doc_requerida
-- Tipos/etiquetas de siniestro y documentación requerida a operarios.

-- ─── Tipos de siniestro (etiquetas/clasificaciones) ─────────────────────────
CREATE TABLE IF NOT EXISTS tipos_siniestro (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#6b7280',
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  orden      INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tipos_siniestro_updated_at
  BEFORE UPDATE ON tipos_siniestro
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tipos_siniestro_activo ON tipos_siniestro (activo);

ALTER TABLE tipos_siniestro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_siniestro_select" ON tipos_siniestro
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tipos_siniestro_insert" ON tipos_siniestro
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tipos_siniestro_update" ON tipos_siniestro
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "tipos_siniestro_delete" ON tipos_siniestro
  FOR DELETE USING (auth.role() = 'authenticated');

-- Datos iniciales comunes
INSERT INTO tipos_siniestro (nombre, color, orden) VALUES
  ('Agua',              '#3b82f6', 10),
  ('Incendio',          '#ef4444', 20),
  ('Robo',              '#8b5cf6', 30),
  ('Responsabilidad Civil', '#f59e0b', 40),
  ('Cristales',         '#06b6d4', 50),
  ('Daños eléctricos',  '#eab308', 60),
  ('Lluvia / Inundación','#64748b', 70)
ON CONFLICT DO NOTHING;

-- ─── Documentación requerida a operarios ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_requerida_tipos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  descripcion    TEXT,
  dias_vigencia  INTEGER,
  obligatorio    BOOLEAN     NOT NULL DEFAULT TRUE,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  orden          INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER doc_requerida_tipos_updated_at
  BEFORE UPDATE ON doc_requerida_tipos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_doc_requerida_tipos_activo ON doc_requerida_tipos (activo);

ALTER TABLE doc_requerida_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_requerida_tipos_select" ON doc_requerida_tipos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "doc_requerida_tipos_insert" ON doc_requerida_tipos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "doc_requerida_tipos_update" ON doc_requerida_tipos
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "doc_requerida_tipos_delete" ON doc_requerida_tipos
  FOR DELETE USING (auth.role() = 'authenticated');

-- Documentos habituales del sector
INSERT INTO doc_requerida_tipos (nombre, dias_vigencia, obligatorio, orden) VALUES
  ('DNI / NIE vigente',                 365,  TRUE,   10),
  ('Alta en Hacienda (036/037)',         NULL, TRUE,   20),
  ('Alta en Seguridad Social',          NULL, TRUE,   30),
  ('Certificado corriente pago SS',      90,  TRUE,   40),
  ('Certificado corriente pago AEAT',    90,  TRUE,   50),
  ('Póliza Responsabilidad Civil',      365,  TRUE,   60),
  ('Póliza de Accidentes',              365,  TRUE,   70),
  ('Contrato de prestación de servicios', NULL, TRUE,  80),
  ('Tarjeta profesional gremio',        365,  FALSE,  90),
  ('Carnet de conducir',               365,  FALSE, 100),
  ('Ficha técnica vehículo',           365,  FALSE, 110),
  ('Seguro vehículo',                  365,  FALSE, 120),
  ('ITV vehículo',                     365,  FALSE, 130),
  ('Certificado habilitación eléctrica', 730, FALSE, 140),
  ('Certificado habilitación gas',      730,  FALSE, 150),
  ('Carnet manipulador de alimentos',   730,  FALSE, 160)
ON CONFLICT DO NOTHING;
