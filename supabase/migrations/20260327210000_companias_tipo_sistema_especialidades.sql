-- Migration: 20260327210000_companias_tipo_sistema_especialidades
-- Extiende la tabla companias con tipo de entidad y sistema de integración.
-- Crea la tabla pivot compania_especialidades con días de caducidad por especialidad.

-- ─── 1. Tipo de entidad ───────────────────────────────────────────────────────
-- Tres tipos: compañía aseguradora, correduría de seguros, administrador de fincas

ALTER TABLE companias
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'compania'
    CHECK (tipo IN ('compania', 'correduria', 'administrador_fincas'));

-- ─── 2. Sistema de integración ────────────────────────────────────────────────
-- Canal/protocolo por el que la compañía envía encargos al ERP

ALTER TABLE companias
  ADD COLUMN IF NOT EXISTS sistema_integracion TEXT
    CHECK (sistema_integracion IN (
      'ADMINISTRADOR_FINCA', 'ASITUR', 'FAMAEX', 'FUNCIONA', 'GENERALI',
      'IMA', 'RNET_EMAIL', 'LAGUNARO', 'LDWEB', 'MULTIASISTENCIA_WS',
      'MUTUA', 'NINGUNO', 'PAP', 'PELAYO', 'SICI', 'VERYFICA'
    ));

CREATE INDEX IF NOT EXISTS idx_companias_tipo               ON companias (tipo);
CREATE INDEX IF NOT EXISTS idx_companias_sistema_integracion ON companias (sistema_integracion);

-- ─── 3. Tabla pivot compania_especialidades ───────────────────────────────────
-- Asigna especialidades a una compañía con sus plazos propios de caducidad.

CREATE TABLE IF NOT EXISTS compania_especialidades (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compania_id              UUID        NOT NULL REFERENCES companias(id)       ON DELETE CASCADE,
  especialidad_id          UUID        NOT NULL REFERENCES especialidades(id)  ON DELETE CASCADE,
  dias_caducidad           INTEGER     NOT NULL DEFAULT 0
                             CHECK (dias_caducidad >= 0),
  dias_caducidad_confirmar INTEGER     NOT NULL DEFAULT 0
                             CHECK (dias_caducidad_confirmar >= 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compania_id, especialidad_id)
);

-- Trigger updated_at (la función fue creada en la migración de especialidades)
CREATE TRIGGER compania_especialidades_updated_at
  BEFORE UPDATE ON compania_especialidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_compania_especialidades_compania
  ON compania_especialidades (compania_id);
CREATE INDEX IF NOT EXISTS idx_compania_especialidades_especialidad
  ON compania_especialidades (especialidad_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE compania_especialidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compania_esp_select" ON compania_especialidades
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "compania_esp_insert" ON compania_especialidades
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "compania_esp_update" ON compania_especialidades
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "compania_esp_delete" ON compania_especialidades
  FOR DELETE USING (auth.role() = 'authenticated');
