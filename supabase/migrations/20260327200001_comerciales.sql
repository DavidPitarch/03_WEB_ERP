-- Migration: 20260327200001_comerciales
-- Tabla de comerciales (agentes de ventas / intermediarios).
-- Estructura similar a proveedores pero orientada a red comercial propia.

CREATE TABLE IF NOT EXISTS comerciales (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT        NOT NULL,
  apellidos            TEXT,
  tipo_identificacion  TEXT        NOT NULL DEFAULT 'NIF' CHECK (tipo_identificacion IN ('NIF','CIF','NIE','OTROS')),
  nif                  TEXT,
  telefono             TEXT,
  fax                  TEXT,
  email                TEXT,
  direccion            TEXT,
  codigo_postal        TEXT,
  ciudad               TEXT,
  provincia            TEXT,
  -- Acceso intranet
  usuario_intranet     TEXT,
  clave_intranet_hash  TEXT,
  email_app            TEXT,
  clave_app_hash       TEXT,
  -- Estado
  activo               BOOLEAN     NOT NULL DEFAULT TRUE,
  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER comerciales_updated_at
  BEFORE UPDATE ON comerciales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_comerciales_activo  ON comerciales (activo);
CREATE INDEX IF NOT EXISTS idx_comerciales_nombre  ON comerciales (nombre);

ALTER TABLE comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comerciales_select" ON comerciales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "comerciales_insert" ON comerciales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "comerciales_update" ON comerciales
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "comerciales_delete" ON comerciales
  FOR DELETE USING (auth.role() = 'authenticated');
