BEGIN;

-- Restore direct perito visibility on assigned VP rows without reopening office-wide access.
DROP POLICY IF EXISTS vp_videoperitaciones_perito_select ON vp_videoperitaciones;
CREATE POLICY vp_videoperitaciones_perito_select ON vp_videoperitaciones FOR SELECT
  USING (
    perito_id IS NOT NULL
    AND perito_id = public.current_perito_id()
  );

-- Allow assigned peritos to read delivery attempts for their own VP cases.
DROP POLICY IF EXISTS vp_envios_perito_select ON vp_envios;
CREATE POLICY vp_envios_perito_select ON vp_envios FOR SELECT
  USING (
    public.current_perito_id() IS NOT NULL
    AND public.can_access_vp(videoperitacion_id)
  );

COMMIT;
