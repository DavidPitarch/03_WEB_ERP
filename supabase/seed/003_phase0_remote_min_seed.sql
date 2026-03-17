-- ============================================================
-- Sprint 5.5 Phase 0 - Seed minimo remoto para gate tecnico
-- Requiere: migraciones 00001..00018 aplicadas
-- Requiere: usuarios auth ya creados en Supabase Auth
-- Uso:
--   1. Ejecutar este archivo en SQL editor o via psql
--   2. Invocar:
--      SELECT * FROM public.erp_phase0_seed_minimo(
--        '<admin_user_id>',
--        '<supervisor_user_id>',
--        '<tramitador_user_id>',
--        '<financiero_user_id>',
--        '<operario_user_id>',
--        'operario.gate@erp.local'
--      );
-- ============================================================

CREATE OR REPLACE FUNCTION public.erp_phase0_seed_minimo(
  p_admin_user_id UUID,
  p_supervisor_user_id UUID,
  p_tramitador_user_id UUID,
  p_financiero_user_id UUID,
  p_operario_user_id UUID,
  p_operario_email TEXT DEFAULT 'operario.gate@erp.local'
)
RETURNS TABLE (
  compania_id UUID,
  empresa_facturadora_id UUID,
  operario_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compania_id UUID := 'c0000001-0000-0000-0000-000000000001';
  v_empresa_facturadora_id UUID := 'e0000001-0000-0000-0000-000000000001';
  v_operario_id UUID := 'o0000001-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO roles (nombre, descripcion)
  VALUES
    ('admin', 'Administrador del sistema'),
    ('supervisor', 'Supervisor de operaciones'),
    ('tramitador', 'Tramitador de expedientes'),
    ('operario', 'Operario de campo'),
    ('financiero', 'Responsable financiero')
  ON CONFLICT (nombre) DO NOTHING;

  INSERT INTO companias (id, nombre, codigo, cif, activa, config)
  VALUES (
    v_compania_id,
    'Compania Gate QA',
    'GATE-QA',
    'A00000001',
    TRUE,
    jsonb_build_object('bootstrap', 'sprint-5.5-phase0')
  )
  ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      codigo = EXCLUDED.codigo,
      cif = EXCLUDED.cif,
      activa = TRUE,
      config = EXCLUDED.config,
      updated_at = NOW();

  INSERT INTO empresas_facturadoras (
    id,
    nombre,
    cif,
    direccion,
    localidad,
    provincia,
    codigo_postal,
    telefono,
    email,
    activa
  )
  VALUES (
    v_empresa_facturadora_id,
    'ERP Gate Facturacion S.L.',
    'B00000001',
    'Calle Gate 1',
    'Madrid',
    'Madrid',
    '28001',
    '910000000',
    'facturacion.gate@erp.local',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      cif = EXCLUDED.cif,
      direccion = EXCLUDED.direccion,
      localidad = EXCLUDED.localidad,
      provincia = EXCLUDED.provincia,
      codigo_postal = EXCLUDED.codigo_postal,
      telefono = EXCLUDED.telefono,
      email = EXCLUDED.email,
      activa = TRUE;

  INSERT INTO operarios (
    id,
    user_id,
    nombre,
    apellidos,
    telefono,
    email,
    gremios,
    zonas_cp,
    activo
  )
  VALUES (
    v_operario_id,
    p_operario_user_id,
    'Operario',
    'Gate',
    '600000001',
    p_operario_email,
    ARRAY['fontaneria'],
    ARRAY['28001', '28002'],
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      nombre = EXCLUDED.nombre,
      apellidos = EXCLUDED.apellidos,
      telefono = EXCLUDED.telefono,
      email = EXCLUDED.email,
      gremios = EXCLUDED.gremios,
      zonas_cp = EXCLUDED.zonas_cp,
      activo = TRUE,
      updated_at = NOW();

  INSERT INTO user_profiles (id, nombre, apellidos, telefono, activo)
  VALUES
    (p_admin_user_id, 'Admin', 'Gate', '610000001', TRUE),
    (p_supervisor_user_id, 'Supervisor', 'Gate', '610000002', TRUE),
    (p_tramitador_user_id, 'Tramitador', 'Gate', '610000003', TRUE),
    (p_financiero_user_id, 'Financiero', 'Gate', '610000004', TRUE),
    (p_operario_user_id, 'Operario', 'Gate', '610000005', TRUE)
  ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      apellidos = EXCLUDED.apellidos,
      telefono = EXCLUDED.telefono,
      activo = TRUE,
      updated_at = NOW();

  INSERT INTO user_roles (user_id, role_id)
  SELECT mapping.user_id, roles.id
  FROM (
    VALUES
      (p_admin_user_id, 'admin'),
      (p_supervisor_user_id, 'supervisor'),
      (p_tramitador_user_id, 'tramitador'),
      (p_financiero_user_id, 'financiero'),
      (p_operario_user_id, 'operario')
  ) AS mapping(user_id, role_name)
  JOIN roles ON roles.nombre = mapping.role_name
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RETURN QUERY
  SELECT v_compania_id, v_empresa_facturadora_id, v_operario_id;
END;
$$;
