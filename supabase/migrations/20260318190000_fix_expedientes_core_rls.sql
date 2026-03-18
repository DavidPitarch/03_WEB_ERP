-- ============================================================
-- Fix core expediente RLS to avoid nested perito/operario policy failures
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS expedientes_operario_select ON expedientes;
DROP POLICY IF EXISTS expedientes_perito_select ON expedientes;

CREATE POLICY expedientes_operario_select ON expedientes FOR SELECT
  USING (operario_id = public.current_operario_id());

CREATE POLICY expedientes_perito_select ON expedientes FOR SELECT
  USING (perito_id = public.current_perito_id());

COMMIT;
