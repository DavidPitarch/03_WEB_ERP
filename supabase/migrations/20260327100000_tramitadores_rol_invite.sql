-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: tramitadores — rol semántico + flujo de invitación
--
-- Cambios:
--   1. Elimina el CHECK constraint de `nivel` (junior/senior/especialista/supervisor)
--   2. Añade nuevo CHECK constraint con los roles de aplicación.
--   3. Actualiza el valor por defecto a 'tramitador'.
--   4. Migra filas existentes al nuevo valor 'tramitador' (entorno de desarrollo).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Eliminar constraint anterior
ALTER TABLE tramitadores DROP CONSTRAINT IF EXISTS tramitadores_nivel_check;

-- 2. Nuevo constraint con roles de aplicación
ALTER TABLE tramitadores
  ADD CONSTRAINT tramitadores_nivel_check
  CHECK (nivel IN ('tramitador', 'facturacion', 'redes', 'administrador', 'super_administrador'));

-- 3. Nuevo valor por defecto
ALTER TABLE tramitadores ALTER COLUMN nivel SET DEFAULT 'tramitador';

-- 4. Migrar filas existentes con valores obsoletos
UPDATE tramitadores
SET nivel = 'tramitador'
WHERE nivel IN ('junior', 'senior', 'especialista', 'supervisor');
