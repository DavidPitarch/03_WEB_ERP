-- ============================================================
-- Seed: Datos de prueba para demo R1
-- Requiere: 001_roles_catalogos.sql ejecutado
-- NOTA: Los UUIDs de auth.users deben crearse manualmente en Supabase Auth
-- ============================================================

-- ─── Compañías ───
INSERT INTO companias (id, nombre, codigo, cif, activa) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Mapfre', 'MAPFRE', 'A28141935', true),
  ('c0000001-0000-0000-0000-000000000002', 'AXA Seguros', 'AXA', 'A60917978', true),
  ('c0000001-0000-0000-0000-000000000003', 'Zurich', 'ZURICH', 'A30030100', true),
  ('c0000001-0000-0000-0000-000000000004', 'Allianz', 'ALLIANZ', 'A28007748', true),
  ('c0000001-0000-0000-0000-000000000005', 'Generali', 'GENERALI', 'A28007268', true);

-- ─── Empresas facturadoras ───
INSERT INTO empresas_facturadoras (id, nombre, cif, direccion, localidad, provincia, codigo_postal, activa) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'Reparaciones del Hogar S.L.', 'B12345678', 'Calle Mayor 10', 'Madrid', 'Madrid', '28001', true),
  ('e0000001-0000-0000-0000-000000000002', 'Servicios Técnicos Mediterráneo S.L.', 'B87654321', 'Av. Diagonal 450', 'Barcelona', 'Barcelona', '08006', true);

-- ─── Operarios ───
INSERT INTO operarios (id, nombre, apellidos, telefono, email, gremios, zonas_cp, activo) VALUES
  ('o0000001-0000-0000-0000-000000000001', 'Carlos', 'García López', '600111001', 'carlos.garcia@demo.com', '{"fontaneria","albanileria"}', '{"28001","28002","28003","28004","28005"}', true),
  ('o0000001-0000-0000-0000-000000000002', 'María', 'Fernández Ruiz', '600111002', 'maria.fernandez@demo.com', '{"electricidad"}', '{"28006","28007","28008","28009","28010"}', true),
  ('o0000001-0000-0000-0000-000000000003', 'Antonio', 'Martínez Sanz', '600111003', 'antonio.martinez@demo.com', '{"pintura","albanileria"}', '{"08001","08002","08003","08004","08005"}', true),
  ('o0000001-0000-0000-0000-000000000004', 'Laura', 'Rodríguez Pérez', '600111004', 'laura.rodriguez@demo.com', '{"fontaneria","carpinteria"}', '{"46001","46002","46003","46004"}', true);

-- ─── Proveedores ───
INSERT INTO proveedores (id, nombre, cif, contacto, telefono, email, tipo, activo) VALUES
  ('p0000001-0000-0000-0000-000000000001', 'Materiales Construhogar', 'B11111111', 'Juan Pérez', '910000001', 'pedidos@construhogar.es', 'material', true),
  ('p0000001-0000-0000-0000-000000000002', 'Fontanería Express S.L.', 'B22222222', 'Ana López', '910000002', 'pedidos@fontaexpress.es', 'material', true);

-- ─── Asegurados ───
INSERT INTO asegurados (id, nombre, apellidos, telefono, telefono2, email, direccion, codigo_postal, localidad, provincia, nif) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Pedro', 'Sánchez Morales', '611222001', null, 'pedro.sanchez@email.com', 'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid', '12345678A'),
  ('a0000001-0000-0000-0000-000000000002', 'Ana', 'López García', '611222002', '611222012', 'ana.lopez@email.com', 'Calle Gran Vía 45, 5ºA', '28013', 'Madrid', 'Madrid', '23456789B'),
  ('a0000001-0000-0000-0000-000000000003', 'Miguel', 'Torres Ruiz', '611222003', null, null, 'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona', '34567890C'),
  ('a0000001-0000-0000-0000-000000000004', 'Carmen', 'Díaz Navarro', '611222004', null, 'carmen.diaz@email.com', 'Calle Colón 30, 1ºD', '46004', 'Valencia', 'Valencia', '45678901D'),
  ('a0000001-0000-0000-0000-000000000005', 'Luis', 'Martín Vega', '611222005', '611222015', null, 'Calle Serrano 80, 4ºC', '28006', 'Madrid', 'Madrid', '56789012E');

-- ─── Expedientes de prueba ───
INSERT INTO expedientes (id, numero_expediente, estado, compania_id, empresa_facturadora_id, asegurado_id, operario_id, tipo_siniestro, descripcion, direccion_siniestro, codigo_postal, localidad, provincia, numero_poliza, numero_siniestro_cia, prioridad, fecha_encargo) VALUES
  ('x0000001-0000-0000-0000-000000000001', 'EXP-2026-00001', 'NUEVO', 'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', null, 'agua', 'Fuga de agua en cocina que afecta a vecino inferior', 'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid', 'POL-001-2025', 'SIN-MAPFRE-001', 'alta', '2026-03-10 09:00:00+01'),

  ('x0000001-0000-0000-0000-000000000002', 'EXP-2026-00002', 'EN_PLANIFICACION', 'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 'o0000001-0000-0000-0000-000000000001', 'agua', 'Rotura de tubería en baño principal', 'Calle Gran Vía 45, 5ºA', '28013', 'Madrid', 'Madrid', 'POL-002-2025', 'SIN-AXA-001', 'media', '2026-03-08 10:00:00+01'),

  ('x0000001-0000-0000-0000-000000000003', 'EXP-2026-00003', 'EN_CURSO', 'c0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000003', 'o0000001-0000-0000-0000-000000000003', 'electrico', 'Cortocircuito en cuadro eléctrico del salón', 'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona', 'POL-003-2025', null, 'urgente', '2026-03-05 08:30:00+01'),

  ('x0000001-0000-0000-0000-000000000004', 'EXP-2026-00004', 'PENDIENTE_MATERIAL', 'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000004', 'o0000001-0000-0000-0000-000000000004', 'agua', 'Humedades en techo del salón por filtración de terraza', 'Calle Colón 30, 1ºD', '46004', 'Valencia', 'Valencia', 'POL-004-2025', 'SIN-MAPFRE-002', 'media', '2026-03-01 11:00:00+01'),

  ('x0000001-0000-0000-0000-000000000005', 'EXP-2026-00005', 'FINALIZADO', 'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', 'o0000001-0000-0000-0000-000000000002', 'rotura_cristales', 'Cristal de ventana roto por impacto', 'Calle Serrano 80, 4ºC', '28006', 'Madrid', 'Madrid', 'POL-005-2025', 'SIN-ALLIANZ-001', 'baja', '2026-02-20 14:00:00+01'),

  ('x0000001-0000-0000-0000-000000000006', 'EXP-2026-00006', 'NO_ASIGNADO', 'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', null, 'fenomeno_atmosferico', 'Goteras en tejado tras tormenta', 'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid', null, 'SIN-GENERALI-001', 'alta', '2026-03-14 16:00:00+01'),

  ('x0000001-0000-0000-0000-000000000007', 'EXP-2026-00007', 'PENDIENTE_CLIENTE', 'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'o0000001-0000-0000-0000-000000000001', 'agua', 'Atasco en bajante comunitaria', 'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona', 'POL-007-2025', null, 'media', '2026-03-12 09:00:00+01');

-- ─── Citas de prueba ───
INSERT INTO citas (id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, notas) VALUES
  ('ct000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000002', 'o0000001-0000-0000-0000-000000000001', '2026-03-17', '09:00', '11:00', 'programada', 'Primera visita diagnóstico'),
  ('ct000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000003', 'o0000001-0000-0000-0000-000000000003', '2026-03-10', '10:00', '12:00', 'realizada', 'Revisión cuadro eléctrico'),
  ('ct000001-0000-0000-0000-000000000003', 'x0000001-0000-0000-0000-000000000005', 'o0000001-0000-0000-0000-000000000002', '2026-02-25', '14:00', '16:00', 'realizada', 'Sustitución cristal'),
  ('ct000001-0000-0000-0000-000000000004', 'x0000001-0000-0000-0000-000000000004', 'o0000001-0000-0000-0000-000000000004', '2026-03-07', '09:00', '11:00', 'realizada', 'Primera visita - se detecta necesidad de material');

-- ─── Partes (solo para el expediente FINALIZADO) ───
INSERT INTO partes_operario (id, expediente_id, operario_id, cita_id, trabajos_realizados, trabajos_pendientes, observaciones, requiere_nueva_visita, validado, validado_at) VALUES
  ('pa000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000005', 'o0000001-0000-0000-0000-000000000002', 'ct000001-0000-0000-0000-000000000003', 'Sustitución de cristal doble 120x80. Limpieza de marco. Sellado perimetral.', null, 'Trabajo completado sin incidencias.', false, true, '2026-02-26 10:00:00+01');

-- ─── Cita lista para parte (demo operario flow) ───
-- EXP-2026-00003 tiene operario Antonio (op-3), estado EN_CURSO, cita programada para hoy
INSERT INTO citas (id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, notas) VALUES
  ('ct000001-0000-0000-0000-000000000005', 'x0000001-0000-0000-0000-000000000003', 'o0000001-0000-0000-0000-000000000003', CURRENT_DATE, '09:00', '11:00', 'programada', 'Visita para completar reparación eléctrica');

-- ─── Nota: Para que el operario pueda loguearse, crear un usuario en Supabase Auth ───
-- y actualizar el campo user_id del operario:
-- UPDATE operarios SET user_id = '<auth_user_uuid>' WHERE id = 'o0000001-0000-0000-0000-000000000003';
-- Ejemplo con email: antonio.martinez@demo.com / password: demo123456

-- ─── Historial de estados mínimo ───
-- (en producción estos se generan automáticamente via API)
