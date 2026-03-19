-- ============================================================
-- Seed 005: Dataset demo para remoto — Pre-MVP
-- Columnas exactas según schema remoto verificado.
-- Aplica solo data para la que el schema es conocido.
-- ============================================================

-- ─── 1. Datos de referencia ───────────────────────────────────────────────

INSERT INTO companias (id, nombre, codigo, cif, activa) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Mapfre',       'MAPFRE',  'A28141935', true),
  ('c0000001-0000-0000-0000-000000000002', 'AXA Seguros',  'AXA',     'A60917978', true),
  ('c0000001-0000-0000-0000-000000000003', 'Zurich',       'ZURICH',  'A30030100', true),
  ('c0000001-0000-0000-0000-000000000004', 'Allianz',      'ALLIANZ', 'A28007748', true),
  ('c0000001-0000-0000-0000-000000000005', 'Generali',     'GENERALI','A28007268', true)
ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre, codigo = EXCLUDED.codigo,
      cif = EXCLUDED.cif, activa = EXCLUDED.activa;

INSERT INTO empresas_facturadoras (id, nombre, cif, direccion, localidad, provincia, codigo_postal, activa) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'Reparaciones del Hogar S.L.',           'B12345678', 'Calle Mayor 10',    'Madrid',    'Madrid',    '28001', true),
  ('e0000001-0000-0000-0000-000000000002', 'Servicios Técnicos Mediterráneo S.L.', 'B87654321', 'Av. Diagonal 450', 'Barcelona', 'Barcelona', '08006', true)
ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre, cif = EXCLUDED.cif, activa = EXCLUDED.activa;

-- Operarios: prefijo 0b (0 y b son hex válidos)
INSERT INTO operarios (id, nombre, apellidos, telefono, email, gremios, zonas_cp, activo) VALUES
  ('0b000001-0000-0000-0000-000000000001', 'Carlos',  'García López',    '600111001', 'carlos.garcia@demo.com',    '{"fontaneria","albanileria"}', '{"28001","28002","28003","28004","28005"}', true),
  ('0b000001-0000-0000-0000-000000000002', 'María',   'Fernández Ruiz',  '600111002', 'maria.fernandez@demo.com',  '{"electricidad"}',             '{"28006","28007","28008","28009","28010"}', true),
  ('0b000001-0000-0000-0000-000000000003', 'Antonio', 'Martínez Sanz',   '600111003', 'antonio.martinez@demo.com', '{"pintura","albanileria"}',    '{"08001","08002","08003","08004","08005"}', true),
  ('0b000001-0000-0000-0000-000000000004', 'Laura',   'Rodríguez Pérez', '600111004', 'laura.rodriguez@demo.com',  '{"fontaneria","carpinteria"}', '{"46001","46002","46003","46004"}',         true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO proveedores (id, nombre, cif, contacto, telefono, email, tipo, activo) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Materiales Construhogar', 'B11111111', 'Juan Pérez', '910000001', 'pedidos@construhogar.es', 'material', true),
  ('b0000001-0000-0000-0000-000000000002', 'Fontanería Express S.L.', 'B22222222', 'Ana López',  '910000002', 'pedidos@fontaexpress.es', 'material', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO asegurados (id, nombre, apellidos, telefono, telefono2, email, direccion, codigo_postal, localidad, provincia, nif) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Pedro',    'Sánchez Morales', '611222001', null,        'pedro.sanchez@email.com',   'Calle Alcalá 15, 3ºB',    '28014', 'Madrid',    'Madrid',    '12345678A'),
  ('a0000001-0000-0000-0000-000000000002', 'Ana',      'López García',    '611222002', '611222012', 'ana.lopez@email.com',       'Calle Gran Vía 45, 5ºA',  '28013', 'Madrid',    'Madrid',    '23456789B'),
  ('a0000001-0000-0000-0000-000000000003', 'Miguel',   'Torres Ruiz',     '611222003', null,        null,                        'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona', '34567890C'),
  ('a0000001-0000-0000-0000-000000000004', 'Carmen',   'Díaz Navarro',    '611222004', null,        'carmen.diaz@email.com',     'Calle Colón 30, 1ºD',     '46004', 'Valencia',  'Valencia',  '45678901D'),
  ('a0000001-0000-0000-0000-000000000005', 'Luis',     'Martín Vega',     '611222005', '611222015', null,                        'Calle Serrano 80, 4ºC',   '28006', 'Madrid',    'Madrid',    '56789012E'),
  ('a0000001-0000-0000-0000-000000000006', 'Fernando', 'Castro Yuste',    '611222006', null,        'fernando.castro@email.com', 'Calle Velázquez 22, 1ºA', '28001', 'Madrid',    'Madrid',    '67890123A'),
  ('a0000001-0000-0000-0000-000000000007', 'Rosa',     'Iglesias Pons',   '611222007', null,        'rosa.iglesias@email.com',   'Av. Sarrià 45, 3ºB',      '08017', 'Barcelona', 'Barcelona', '78901234B'),
  ('a0000001-0000-0000-0000-000000000008', 'Javier',   'Moreno Pérez',    '611222008', null,        null,                        'Calle Larios 10, 2ºC',    '29005', 'Málaga',    'Málaga',    '89012345C'),
  ('a0000001-0000-0000-0000-000000000009', 'Lucía',    'Ramos Torres',    '611222009', null,        'lucia.ramos@email.com',     'Gran Vía 1, 4ºD',         '48001', 'Bilbao',    'Vizcaya',   '90123456D'),
  ('a0000001-0000-0000-0000-000000000010', 'Alberto',  'Fuentes Gil',     '611222010', null,        null,                        'Calle Real 5, bajo',       '15001', 'A Coruña',  'A Coruña',  '01234567E')
ON CONFLICT (id) DO NOTHING;

-- Peritos: solo columnas que existen en remoto (sin numero_colegiado/especialidades)
INSERT INTO peritos (id, nombre, apellidos, email, telefono, activo) VALUES
  ('be000001-0000-0000-0000-000000000001', 'Roberto', 'Blanco Sanz', 'roberto.blanco@peritos.es', '650999001', true),
  ('be000001-0000-0000-0000-000000000002', 'Elena',   'Vidal Moré',  'elena.vidal@peritos.es',    '650999002', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Expedientes demo (EXP-006 a EXP-017) ─────────────────────────────
-- Los expedientes 001-005 ya existen en remoto (phase0 gate).
-- Se añaden 006+ para cubrir todos los estados de negocio.
-- Prefijo e1 = valid hex (e y 1)

INSERT INTO expedientes (id, numero_expediente, estado, compania_id, empresa_facturadora_id, asegurado_id, operario_id, tipo_siniestro, descripcion, direccion_siniestro, codigo_postal, localidad, provincia, numero_poliza, numero_siniestro_cia, prioridad, fecha_encargo, fecha_limite_sla)
VALUES
  ('e1000001-0000-0000-0000-000000000006', 'EXP-2026-00006', 'NO_ASIGNADO',
   'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000001', null,
   'fenomeno_atmosferico', 'Goteras en tejado tras tormenta',
   'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid',
   null, 'SIN-GENERALI-001', 'alta', '2026-03-14 16:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000007', 'EXP-2026-00007', 'PENDIENTE_CLIENTE',
   'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000003', '0b000001-0000-0000-0000-000000000001',
   'agua', 'Atasco en bajante comunitaria',
   'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona',
   'POL-007-2025', null, 'media', '2026-03-12 09:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000008', 'EXP-2026-00008', 'EN_PLANIFICACION',
   'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000006', '0b000001-0000-0000-0000-000000000001',
   'agua', 'Inundación por rotura de tubería colectora en garaje',
   'Calle Velázquez 22, 1ºA', '28001', 'Madrid', 'Madrid',
   'POL-008-2025', 'SIN-MAPFRE-008', 'urgente', '2026-03-17 08:00:00+01', '2026-03-20 23:59:00+01'),

  ('e1000001-0000-0000-0000-000000000009', 'EXP-2026-00009', 'EN_CURSO',
   'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000007', '0b000001-0000-0000-0000-000000000002',
   'electrico', 'Cortocircuito con afectación de electrodomésticos y cuadro general',
   'Av. Sarrià 45, 3ºB', '08017', 'Barcelona', 'Barcelona',
   'POL-009-2025', 'SIN-AXA-009', 'alta', '2026-03-15 10:00:00+01', '2026-03-21 23:59:00+01'),

  ('e1000001-0000-0000-0000-000000000010', 'EXP-2026-00010', 'FINALIZADO',
   'c0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000008', '0b000001-0000-0000-0000-000000000003',
   'incendio', 'Incendio en cocina con daños en encimera, muebles y revestimientos',
   'Calle Larios 10, 2ºC', '29005', 'Málaga', 'Málaga',
   'POL-010-2025', 'SIN-ZURICH-010', 'alta', '2026-02-28 09:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000011', 'EXP-2026-00011', 'FACTURADO',
   'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000009', '0b000001-0000-0000-0000-000000000004',
   'agua', 'Filtración de agua por junta de terraza deteriorada',
   'Gran Vía 1, 4ºD', '48001', 'Bilbao', 'Vizcaya',
   'POL-011-2025', 'SIN-ALLIANZ-011', 'media', '2026-02-15 11:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000012', 'EXP-2026-00012', 'COBRADO',
   'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000010', '0b000001-0000-0000-0000-000000000001',
   'rotura_cristales', 'Rotura de mampara de baño y espejo por golpe',
   'Calle Real 5, bajo', '15001', 'A Coruña', 'A Coruña',
   'POL-012-2025', 'SIN-GENERALI-012', 'baja', '2026-01-20 14:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000013', 'EXP-2026-00013', 'CANCELADO',
   'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001', null,
   'fenomeno_atmosferico', 'Daños por granizo en cubierta — cancelado por duplicado',
   'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid',
   null, 'SIN-MAPFRE-013', 'baja', '2026-03-01 09:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000014', 'EXP-2026-00014', 'PENDIENTE_MATERIAL',
   'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000002', '0b000001-0000-0000-0000-000000000003',
   'agua', 'Humedad ascendente en paredes de planta baja',
   'Calle Gran Vía 45, 5ºA', '28013', 'Madrid', 'Madrid',
   'POL-014-2025', 'SIN-AXA-014', 'media', '2026-03-05 10:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000015', 'EXP-2026-00015', 'NUEVO',
   'c0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000003', null,
   'agua', 'Goteras en techo de salón — origen desconocido',
   'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona',
   'POL-015-2025', null, 'alta', '2026-03-18 08:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000016', 'EXP-2026-00016', 'EN_PLANIFICACION',
   'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000004', '0b000001-0000-0000-0000-000000000002',
   'fenomeno_atmosferico', 'Daños estructurales por viento en cubierta plana',
   'Calle Colón 30, 1ºD', '46004', 'Valencia', 'Valencia',
   'POL-016-2025', 'SIN-ALLIANZ-016', 'alta', '2026-03-16 09:00:00+01', null),

  ('e1000001-0000-0000-0000-000000000017', 'EXP-2026-00017', 'FINALIZADO',
   'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000005', '0b000001-0000-0000-0000-000000000004',
   'electrico', 'Avería en sistema de climatización — fallo eléctrico',
   'Calle Serrano 80, 4ºC', '28006', 'Madrid', 'Madrid',
   'POL-017-2025', 'SIN-GENERALI-017', 'media', '2026-03-01 11:00:00+01', null)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Series de facturación ─────────────────────────────────────────────
-- tipo es NOT NULL en el remoto — usar 'ordinaria' o el valor que acepte la check constraint

INSERT INTO series_facturacion (id, codigo, nombre, prefijo, empresa_facturadora_id, tipo, activa, contador_actual)
VALUES
  ('5a000001-0000-0000-0000-000000000001', 'FAC-2026',     'Facturas 2026',           'FAC2026-',    'e0000001-0000-0000-0000-000000000001', 'ordinaria', true, 3),
  ('5a000001-0000-0000-0000-000000000002', 'BCN-2026', 'Facturas Barcelona 2026', 'BCNFAC2026-', 'e0000001-0000-0000-0000-000000000002', 'ordinaria', true, 1)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Facturas ─────────────────────────────────────────────────────────
-- Sin serie_id ni compania_id que podrían no estar en scope. Estado: emitida/enviada/cobrada

INSERT INTO facturas (id, expediente_id, empresa_facturadora_id, numero_factura,
  fecha_emision, fecha_vencimiento, base_imponible, iva_porcentaje, iva_importe, total,
  estado, estado_cobro, cobrada_at, forma_pago)
VALUES
  ('f0000001-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000012',
   'e0000001-0000-0000-0000-000000000001', 'FAC2026-00001',
   '2026-01-25', '2026-02-25', 680.00, 21, 142.80, 822.80,
   'cobrada', 'cobrada', '2026-02-08 10:00:00+01', 'transferencia'),

  ('f0000001-0000-0000-0000-000000000002', 'e1000001-0000-0000-0000-000000000011',
   'e0000001-0000-0000-0000-000000000001', 'FAC2026-00002',
   '2026-03-01', '2026-03-31', 1840.00, 21, 386.40, 2226.40,
   'enviada', 'pendiente', null, 'transferencia'),

  ('f0000001-0000-0000-0000-000000000003', 'e1000001-0000-0000-0000-000000000017',
   'e0000001-0000-0000-0000-000000000001', 'FAC2026-00003',
   '2026-03-10', '2026-04-09', 1250.00, 21, 262.50, 1512.50,
   'emitida', 'pendiente', null, 'domiciliacion')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Alertas activas ───────────────────────────────────────────────────
-- mensaje es nullable; destinatario_id es nullable

INSERT INTO alertas (id, tipo, titulo, expediente_id, prioridad, estado, created_at)
VALUES
  ('a1000001-0000-0000-0000-000000000001', 'sla_critico',
   'SLA crítico — EXP-2026-00008 vence en <48h',
   'e1000001-0000-0000-0000-000000000008', 'urgente', 'activa', '2026-03-19 07:00:00+01'),

  ('a1000001-0000-0000-0000-000000000002', 'sla_critico',
   'SLA casi expirado — EXP-2026-00009',
   'e1000001-0000-0000-0000-000000000009', 'alta', 'activa', '2026-03-18 07:00:00+01'),

  ('a1000001-0000-0000-0000-000000000003', 'parte_pendiente_antiguo',
   'Parte sin validar >3 días — EXP-2026-00009',
   'e1000001-0000-0000-0000-000000000009', 'media', 'activa', '2026-03-17 07:00:00+01')
ON CONFLICT DO NOTHING;

-- ─── 6. Partes de operario ────────────────────────────────────────────────
-- Solo columnas que existen en schema remoto

INSERT INTO partes_operario (id, expediente_id, operario_id, resultado, trabajos_realizados,
  observaciones, validado)
VALUES
  -- Parte pendiente de validación (>3 días)
  ('ba000001-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000009',
   '0b000001-0000-0000-0000-000000000002', 'completada',
   'Sustitución de interruptores automáticos del cuadro eléctrico. Revisión del cableado.',
   'Cuadro actualizado a normativa vigente. Se recomienda revisión anual.',
   false),

  -- Parte validado
  ('ba000001-0000-0000-0000-000000000002', 'e1000001-0000-0000-0000-000000000012',
   '0b000001-0000-0000-0000-000000000001', 'completada',
   'Sustitución de mampara de baño y espejo. Sellado perimetral.',
   null, true)
ON CONFLICT (id) DO NOTHING;
