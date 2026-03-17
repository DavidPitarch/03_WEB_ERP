-- ============================================================
-- RLS Policies — Seguridad por rol
-- ============================================================

ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE partes_operario ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE asegurados ENABLE ROW LEVEL SECURITY;

-- Helper: obtener roles del usuario actual
CREATE OR REPLACE FUNCTION auth.user_roles()
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(r.nombre)
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: es admin o supervisor
CREATE OR REPLACE FUNCTION auth.is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
  SELECT auth.user_roles() && ARRAY['admin', 'supervisor'];
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── EXPEDIENTES ───

-- Admin/supervisor/tramitador/financiero: todos los expedientes
CREATE POLICY expedientes_staff_select ON expedientes FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']);

-- Operarios: solo expedientes asignados a ellos
CREATE POLICY expedientes_operario_select ON expedientes FOR SELECT
  USING (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
  );

-- Peritos: solo expedientes asignados pericialmente
CREATE POLICY expedientes_perito_select ON expedientes FOR SELECT
  USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );

-- Insert/Update solo desde service_role (edge-api)
CREATE POLICY expedientes_insert ON expedientes FOR INSERT
  WITH CHECK (auth.is_admin_or_supervisor() OR current_setting('role') = 'service_role');

CREATE POLICY expedientes_update ON expedientes FOR UPDATE
  USING (current_setting('role') = 'service_role');

-- ─── CITAS ───
CREATE POLICY citas_staff_select ON citas FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY citas_operario_select ON citas FOR SELECT
  USING (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
  );

-- ─── COMUNICACIONES ───
CREATE POLICY comunicaciones_staff_select ON comunicaciones FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

-- ─── PARTES ───
CREATE POLICY partes_staff_select ON partes_operario FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY partes_operario_select ON partes_operario FOR SELECT
  USING (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
  );
