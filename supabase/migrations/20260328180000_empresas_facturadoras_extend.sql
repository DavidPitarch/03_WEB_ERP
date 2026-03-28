-- Extiende empresas_facturadoras con campos necesarios para el módulo completo
-- de gestión de sociedades facturadoras.

ALTER TABLE empresas_facturadoras
  ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(200),
  ADD COLUMN IF NOT EXISTS prefijo_facturas  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS prefijo_abonos    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Trigger para mantener updated_at actualizado automáticamente
CREATE OR REPLACE FUNCTION update_empresas_facturadoras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_empresas_facturadoras_updated_at ON empresas_facturadoras;
CREATE TRIGGER trg_empresas_facturadoras_updated_at
  BEFORE UPDATE ON empresas_facturadoras
  FOR EACH ROW EXECUTE FUNCTION update_empresas_facturadoras_updated_at();
