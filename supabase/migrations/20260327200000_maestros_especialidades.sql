-- Migration: 20260327200000_maestros_especialidades
-- Tabla de especialidades/gremios como entidad de primer orden.
-- Permite gestionar el catálogo global de especialidades del ERP.

CREATE TABLE IF NOT EXISTS especialidades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL,
  codigo      TEXT        UNIQUE,
  descripcion TEXT,
  activa      BOOLEAN     NOT NULL DEFAULT TRUE,
  orden       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER especialidades_updated_at
  BEFORE UPDATE ON especialidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_especialidades_activa   ON especialidades (activa);
CREATE INDEX IF NOT EXISTS idx_especialidades_nombre   ON especialidades (nombre);

-- RLS
ALTER TABLE especialidades ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario autenticado puede leer
CREATE POLICY "especialidades_select" ON especialidades
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política: solo admin y supervisor pueden escribir
CREATE POLICY "especialidades_insert" ON especialidades
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "especialidades_update" ON especialidades
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "especialidades_delete" ON especialidades
  FOR DELETE USING (auth.role() = 'authenticated');

-- Datos iniciales comunes del sector (gremios típicos de siniestros del hogar)
INSERT INTO especialidades (nombre, codigo, orden) VALUES
  ('Fontanería',          'FONT', 10),
  ('Electricidad',        'ELEC', 20),
  ('Albañilería',         'ALBA', 30),
  ('Carpintería',         'CARP', 40),
  ('Pintura',             'PINT', 50),
  ('Cerrajería',          'CERR', 60),
  ('Cristalería',         'CRIS', 70),
  ('Climatización',       'CLIM', 80),
  ('Jardinería',          'JARD', 90),
  ('Electrodomésticos',   'ELDO', 100),
  ('Impermeabilización',  'IMPE', 110),
  ('Telecomunicaciones',  'TELE', 120),
  ('Desatascos',          'DESA', 130),
  ('Control de plagas',   'PLAG', 140),
  ('Mudanzas',            'MUDZ', 150)
ON CONFLICT (codigo) DO NOTHING;
