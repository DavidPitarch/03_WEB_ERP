-- Migration: 20260328190000_compania_tipos_siniestro
-- Tipos de siniestro configurables por compañía.
-- Reemplaza los tipos globales anteriores por los 8 tipos estándar del sector.
-- Crea tabla junction compania_tipos_siniestro y pre-seed para todas las compañías.

-- ─── 1. Reemplazar tipos de siniestro por los estándar del sector ─────────────

TRUNCATE tipos_siniestro CASCADE;

INSERT INTO tipos_siniestro (nombre, color, orden) VALUES
  ('Daños Agua',              '#3b82f6',  10),
  ('Daños Eléctricos',        '#eab308',  20),
  ('Rotura de Loza',          '#06b6d4',  30),
  ('Fenómenos Atmosféricos',  '#64748b',  40),
  ('Incendio',                '#ef4444',  50),
  ('Siniestro Grave',         '#dc2626',  60),
  ('Asistencia',              '#10b981',  70),
  ('Bricolaje',               '#8b5cf6',  80);

-- ─── 2. Tabla junction compania_tipos_siniestro ───────────────────────────────

CREATE TABLE IF NOT EXISTS compania_tipos_siniestro (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id       UUID        NOT NULL REFERENCES companias(id) ON DELETE CASCADE,
  tipo_siniestro_id UUID        NOT NULL REFERENCES tipos_siniestro(id) ON DELETE CASCADE,
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  orden             INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compania_id, tipo_siniestro_id)
);

CREATE INDEX IF NOT EXISTS idx_cts_compania  ON compania_tipos_siniestro (compania_id);
CREATE INDEX IF NOT EXISTS idx_cts_tipo      ON compania_tipos_siniestro (tipo_siniestro_id);

ALTER TABLE compania_tipos_siniestro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cts_select" ON compania_tipos_siniestro
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "cts_insert" ON compania_tipos_siniestro
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "cts_update" ON compania_tipos_siniestro
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "cts_delete" ON compania_tipos_siniestro
  FOR DELETE USING (auth.role() = 'authenticated');

-- ─── 3. Seed: asignar todos los tipos a todas las compañías existentes ────────

INSERT INTO compania_tipos_siniestro (compania_id, tipo_siniestro_id, orden)
SELECT c.id, ts.id, ts.orden
FROM companias c
CROSS JOIN tipos_siniestro ts
ON CONFLICT (compania_id, tipo_siniestro_id) DO NOTHING;

-- ─── 4. Trigger: auto-seed para nuevas compañías ─────────────────────────────

CREATE OR REPLACE FUNCTION seed_tipos_siniestro_for_compania()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO compania_tipos_siniestro (compania_id, tipo_siniestro_id, orden)
  SELECT NEW.id, ts.id, ts.orden
  FROM tipos_siniestro ts
  WHERE ts.activo = TRUE
  ON CONFLICT (compania_id, tipo_siniestro_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_tipos_siniestro_compania
  AFTER INSERT ON companias
  FOR EACH ROW EXECUTE FUNCTION seed_tipos_siniestro_for_compania();
