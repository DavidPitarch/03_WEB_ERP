-- Migration: añadir campos nif y extension a user_profiles
-- Necesarios para la pantalla "Datos de Usuario" del backoffice

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS nif       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS extension VARCHAR(10);

COMMENT ON COLUMN user_profiles.nif       IS 'NIF/DNI/NIE del usuario';
COMMENT ON COLUMN user_profiles.extension IS 'Extensión VoIP de la centralita';
