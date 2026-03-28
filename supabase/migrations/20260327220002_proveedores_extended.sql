-- Migration: Proveedores Extended
-- Fecha: 2026-03-27
-- Añade campos completos al módulo de proveedores:
-- tipo_identificacion, fax, iban_1-6, limite_dias, utiliza_panel,
-- autofactura, id_operario, acceso intranet

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS tipo_identificacion TEXT
    CHECK (tipo_identificacion IN ('N.I.F.','C.I.F.','N.I.E.','OTROS')),
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS iban_1 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_2 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_3 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_5 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_6 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS limite_dias INTEGER,
  ADD COLUMN IF NOT EXISTS utiliza_panel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS autofactura BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS id_operario UUID REFERENCES operarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario TEXT,
  ADD COLUMN IF NOT EXISTS contrasena TEXT,
  ADD COLUMN IF NOT EXISTS email_app TEXT,
  ADD COLUMN IF NOT EXISTS contrasena_email_app TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_id_operario ON proveedores(id_operario)
  WHERE id_operario IS NOT NULL;

-- RLS: añadir política DELETE para admin
DO $$ BEGIN
  DROP POLICY IF EXISTS "proveedores_delete_admin" ON proveedores;
  CREATE POLICY "proveedores_delete_admin" ON proveedores
    FOR DELETE USING (
      public.get_my_role() = 'admin'
    );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
