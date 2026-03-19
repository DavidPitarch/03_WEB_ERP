-- ============================================================
-- Seed 004: Dataset demo enriquecido — Pre-MVP
-- Requiere: 001_roles_catalogos.sql + 002_demo_data.sql ejecutados
-- Objetivo: dashboard con KPIs no triviales, bandejas con contenido,
--           alertas activas, VPs, facturas, presupuestos, pedidos.
-- ============================================================

-- ─── Peritos adicionales (para VP demo) ───────────────────────────────────
INSERT INTO peritos (id, nombre, apellidos, email, telefono, numero_colegiado, especialidades, activo)
VALUES
  ('pe000001-0000-0000-0000-000000000001', 'Roberto', 'Blanco Sanz', 'roberto.blanco@peritos.es', '650999001', 'COL-MAD-1234', '{"daños_agua","estructural"}', true),
  ('pe000001-0000-0000-0000-000000000002', 'Elena', 'Vidal Moré', 'elena.vidal@peritos.es', '650999002', 'COL-BCN-5678', '{"electrico","incendio"}', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Asegurados adicionales ───────────────────────────────────────────────
INSERT INTO asegurados (id, nombre, apellidos, telefono, email, direccion, codigo_postal, localidad, provincia, nif)
VALUES
  ('a0000001-0000-0000-0000-000000000006', 'Fernando', 'Castro Yuste', '611222006', 'fernando.castro@email.com', 'Calle Velázquez 22, 1ºA', '28001', 'Madrid', 'Madrid', '67890123F'),
  ('a0000001-0000-0000-0000-000000000007', 'Rosa', 'Iglesias Pons', '611222007', 'rosa.iglesias@email.com', 'Av. Sarrià 45, 3ºB', '08017', 'Barcelona', 'Barcelona', '78901234G'),
  ('a0000001-0000-0000-0000-000000000008', 'Javier', 'Moreno Pérez', '611222008', null, 'Calle Larios 10, 2ºC', '29005', 'Málaga', 'Málaga', '89012345H'),
  ('a0000001-0000-0000-0000-000000000009', 'Lucía', 'Ramos Torres', '611222009', 'lucia.ramos@email.com', 'Gran Vía 1, 4ºD', '48001', 'Bilbao', 'Vizcaya', '90123456I'),
  ('a0000001-0000-0000-0000-000000000010', 'Alberto', 'Fuentes Gil', '611222010', null, 'Calle Real 5, bajo', '15001', 'A Coruña', 'A Coruña', '01234567J')
ON CONFLICT (id) DO NOTHING;

-- ─── Expedientes adicionales (20 en total entre 002 y 004) ───────────────

-- SLA próximo a vencer (urgentes para watchdog)
INSERT INTO expedientes (id, numero_expediente, estado, compania_id, empresa_facturadora_id, asegurado_id, operario_id, tipo_siniestro, descripcion, direccion_siniestro, codigo_postal, localidad, provincia, numero_poliza, numero_siniestro_cia, prioridad, fecha_encargo, fecha_limite_sla)
VALUES
  ('x0000001-0000-0000-0000-000000000008', 'EXP-2026-00008', 'EN_PLANIFICACION',
   'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000006', 'o0000001-0000-0000-0000-000000000001',
   'agua', 'Inundación por rotura de tubería colectora en garaje',
   'Calle Velázquez 22, 1ºA', '28001', 'Madrid', 'Madrid',
   'POL-008-2025', 'SIN-MAPFRE-008', 'urgente', '2026-03-17 08:00:00+01',
   '2026-03-20 23:59:00+01'),  -- SLA vence mañana

  ('x0000001-0000-0000-0000-000000000009', 'EXP-2026-00009', 'EN_CURSO',
   'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000007', 'o0000001-0000-0000-0000-000000000002',
   'electrico', 'Cortocircuito con afectación de electrodomésticos y cuadro general',
   'Av. Sarrià 45, 3ºB', '08017', 'Barcelona', 'Barcelona',
   'POL-009-2025', 'SIN-AXA-009', 'alta', '2026-03-15 10:00:00+01',
   '2026-03-21 23:59:00+01'),  -- SLA casi expirado

  ('x0000001-0000-0000-0000-000000000010', 'EXP-2026-00010', 'FINALIZADO',
   'c0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000008', 'o0000001-0000-0000-0000-000000000003',
   'incendio', 'Incendio en cocina con daños en encimera, muebles y revestimientos',
   'Calle Larios 10, 2ºC', '29005', 'Málaga', 'Málaga',
   'POL-010-2025', 'SIN-ZURICH-010', 'alta', '2026-02-28 09:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000011', 'EXP-2026-00011', 'FACTURADO',
   'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000009', 'o0000001-0000-0000-0000-000000000004',
   'agua', 'Filtración de agua por junta de terraza deteriorada',
   'Gran Vía 1, 4ºD', '48001', 'Bilbao', 'Vizcaya',
   'POL-011-2025', 'SIN-ALLIANZ-011', 'media', '2026-02-15 11:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000012', 'EXP-2026-00012', 'COBRADO',
   'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000010', 'o0000001-0000-0000-0000-000000000001',
   'rotura_cristales', 'Rotura de mampara de baño y espejo por golpe',
   'Calle Real 5, bajo', '15001', 'A Coruña', 'A Coruña',
   'POL-012-2025', 'SIN-GENERALI-012', 'baja', '2026-01-20 14:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000013', 'EXP-2026-00013', 'CANCELADO',
   'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001', null,
   'fenomeno_atmosferico', 'Daños por granizo en cubierta — cancelado por duplicado',
   'Calle Alcalá 15, 3ºB', '28014', 'Madrid', 'Madrid',
   null, 'SIN-MAPFRE-013', 'baja', '2026-03-01 09:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000014', 'EXP-2026-00014', 'PENDIENTE_MATERIAL',
   'c0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000002', 'o0000001-0000-0000-0000-000000000003',
   'agua', 'Humedad ascendente en paredes de planta baja',
   'Calle Gran Vía 45, 5ºA', '28013', 'Madrid', 'Madrid',
   'POL-014-2025', 'SIN-AXA-014', 'media', '2026-03-05 10:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000015', 'EXP-2026-00015', 'NUEVO',
   'c0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000003', null,
   'agua', 'Goteras en techo de salón — origen desconocido',
   'Av. Meridiana 120, 2º1ª', '08027', 'Barcelona', 'Barcelona',
   'POL-015-2025', null, 'alta', '2026-03-18 08:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000016', 'EXP-2026-00016', 'EN_PLANIFICACION',
   'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000004', 'o0000001-0000-0000-0000-000000000002',
   'fenomeno_atmosferico', 'Daños estructurales por viento en cubierta plana',
   'Calle Colón 30, 1ºD', '46004', 'Valencia', 'Valencia',
   'POL-016-2025', 'SIN-ALLIANZ-016', 'alta', '2026-03-16 09:00:00+01', null),

  ('x0000001-0000-0000-0000-000000000017', 'EXP-2026-00017', 'FINALIZADO',
   'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000005', 'o0000001-0000-0000-0000-000000000004',
   'electrico', 'Avería en sistema de climatización — fallo eléctrico',
   'Calle Serrano 80, 4ºC', '28006', 'Madrid', 'Madrid',
   'POL-017-2025', 'SIN-GENERALI-017', 'media', '2026-03-01 11:00:00+01', null)
ON CONFLICT (id) DO NOTHING;

-- ─── Historial de estados para expedientes clave ──────────────────────────
INSERT INTO historial_expediente (expediente_id, estado_nuevo, estado_anterior, actor_id, motivo, created_at)
VALUES
  ('x0000001-0000-0000-0000-000000000011', 'FACTURADO', 'FINALIZADO',
   '00000000-0000-0000-0000-000000000001', 'Factura emitida correctamente', '2026-03-10 10:00:00+01'),
  ('x0000001-0000-0000-0000-000000000012', 'COBRADO', 'FACTURADO',
   '00000000-0000-0000-0000-000000000001', 'Cobro registrado', '2026-02-10 10:00:00+01')
ON CONFLICT DO NOTHING;

-- ─── Presupuestos ────────────────────────────────────────────────────────
INSERT INTO presupuestos (id, expediente_id, concepto, importe_total, aprobado, aprobado_at, created_at)
VALUES
  -- Presupuesto aprobado (EXP finalizado, listo para facturar)
  ('pr000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000010',
   'Reparación total incendio cocina: extracción escombros, alicatado y pintura', 3840.00,
   true, '2026-03-05 10:00:00+01', '2026-03-03 09:00:00+01'),

  -- Presupuesto aprobado (EXP-00017 finalizado)
  ('pr000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000017',
   'Revisión y sustitución de compresor climatización + cableado', 1250.00,
   true, '2026-03-08 11:00:00+01', '2026-03-06 09:00:00+01'),

  -- Presupuesto pendiente de aprobación
  ('pr000001-0000-0000-0000-000000000003', 'x0000001-0000-0000-0000-000000000009',
   'Sustitución cuadro eléctrico + electrodomésticos afectados', 5200.00,
   false, null, '2026-03-16 10:00:00+01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lineas_presupuesto (presupuesto_id, descripcion, cantidad, precio_unitario, importe, orden)
VALUES
  ('pr000001-0000-0000-0000-000000000001', 'Extracción y retirada de escombros', 1, 480.00, 480.00, 1),
  ('pr000001-0000-0000-0000-000000000001', 'Alicatado cocina (12 m²)', 12, 85.00, 1020.00, 2),
  ('pr000001-0000-0000-0000-000000000001', 'Pintura paredes y techo (25 m²)', 25, 28.00, 700.00, 3),
  ('pr000001-0000-0000-0000-000000000001', 'Mano de obra especializada (16h)', 16, 102.50, 1640.00, 4),

  ('pr000001-0000-0000-0000-000000000002', 'Compresor climatización Samsung 3000W', 1, 850.00, 850.00, 1),
  ('pr000001-0000-0000-0000-000000000002', 'Cableado eléctrico + mano de obra', 1, 400.00, 400.00, 2),

  ('pr000001-0000-0000-0000-000000000003', 'Cuadro eléctrico ABB 3 fases', 1, 1200.00, 1200.00, 1),
  ('pr000001-0000-0000-0000-000000000003', 'Electrodomésticos afectados (valoración pericial)', 1, 4000.00, 4000.00, 2)
ON CONFLICT DO NOTHING;

-- ─── Series de facturación ────────────────────────────────────────────────
INSERT INTO series_facturacion (id, codigo, nombre, prefijo, empresa_facturadora_id, activa, contador_actual)
VALUES
  ('sr000001-0000-0000-0000-000000000001', 'FAC-2026', 'Facturas 2026', 'FAC2026-', 'e0000001-0000-0000-0000-000000000001', true, 3),
  ('sr000001-0000-0000-0000-000000000002', 'FAC-BCN-2026', 'Facturas Barcelona 2026', 'BCNFAC2026-', 'e0000001-0000-0000-0000-000000000002', true, 1)
ON CONFLICT (id) DO NOTHING;

-- ─── Facturas ─────────────────────────────────────────────────────────────
INSERT INTO facturas (id, expediente_id, serie_id, empresa_facturadora_id, compania_id,
  numero_factura, fecha_emision, fecha_vencimiento, base_imponible, iva_porcentaje, iva_importe, total,
  estado, estado_cobro, cobrada_at, forma_pago)
VALUES
  -- Factura emitida (EXP cobrado)
  ('f0000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000012',
   'sr000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000005',
   'FAC2026-00001', '2026-01-25', '2026-02-25',
   680.00, 21, 142.80, 822.80,
   'cobrada', 'cobrada', '2026-02-08 10:00:00+01', 'transferencia'),

  -- Factura enviada pendiente de cobro
  ('f0000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000011',
   'sr000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000004',
   'FAC2026-00002', '2026-03-01', '2026-03-31',
   1840.00, 21, 386.40, 2226.40,
   'enviada', 'pendiente', null, 'transferencia'),

  -- Factura emitida (no enviada todavía)
  ('f0000001-0000-0000-0000-000000000003', 'x0000001-0000-0000-0000-000000000017',
   'sr000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000005',
   'FAC2026-00003', '2026-03-10', '2026-04-09',
   1250.00, 21, 262.50, 1512.50,
   'emitida', 'pendiente', null, 'domiciliacion')
ON CONFLICT (id) DO NOTHING;

-- Líneas de factura
INSERT INTO lineas_factura (factura_id, descripcion, cantidad, precio_unitario, importe, orden)
VALUES
  ('f0000001-0000-0000-0000-000000000001', 'Reparación mampara y espejo', 1, 680.00, 680.00, 1),
  ('f0000001-0000-0000-0000-000000000002', 'Reparación filtración terraza', 1, 1840.00, 1840.00, 1),
  ('f0000001-0000-0000-0000-000000000003', 'Sustitución climatización + cableado', 1, 1250.00, 1250.00, 1)
ON CONFLICT DO NOTHING;

-- ─── Tareas internas ─────────────────────────────────────────────────────
INSERT INTO tareas_internas (id, expediente_id, titulo, descripcion, estado, prioridad, fecha_limite, created_at)
VALUES
  ('t0000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000008',
   'Solicitar informe de daños al operario Carlos García',
   'Recabar informe detallado del siniestro de garaje antes de la peritación',
   'pendiente', 'alta', '2026-03-20 18:00:00+01', '2026-03-17 09:00:00+01'),

  ('t0000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000009',
   'Confirmar disponibilidad perito eléctrico',
   'Contactar con perito para valoración del cuadro eléctrico afectado',
   'en_progreso', 'alta', '2026-03-19 12:00:00+01', '2026-03-15 11:00:00+01'),

  -- Tarea vencida (para watchdog / alerta)
  ('t0000001-0000-0000-0000-000000000003', 'x0000001-0000-0000-0000-000000000007',
   'Gestionar desatasco y enviar confirmación al asegurado',
   'Pendiente desde hace 5 días — SLA en riesgo',
   'pendiente', 'alta', '2026-03-14 18:00:00+01', '2026-03-12 10:00:00+01'),

  ('t0000001-0000-0000-0000-000000000004', 'x0000001-0000-0000-0000-000000000004',
   'Confirmar llegada del material de impermeabilización',
   'Material pedido al proveedor, pendiente confirmación de entrega',
   'pendiente', 'media', '2026-03-22 18:00:00+01', '2026-03-18 08:00:00+01'),

  ('t0000001-0000-0000-0000-000000000005', 'x0000001-0000-0000-0000-000000000002',
   'Reprogramar cita tras no presencia del asegurado',
   'El asegurado no estaba en la primera visita. Coordinar nueva fecha.',
   'completada', 'media', '2026-03-18 12:00:00+01', '2026-03-17 10:00:00+01')
ON CONFLICT (id) DO NOTHING;

-- ─── Alertas activas ──────────────────────────────────────────────────────
INSERT INTO alertas (id, tipo, titulo, expediente_id, tarea_id, prioridad, estado, created_at)
VALUES
  ('al000001-0000-0000-0000-000000000001',
   'sla_critico', 'SLA crítico — EXP-2026-00008 vence en <48h',
   'x0000001-0000-0000-0000-000000000008', null,
   'critica', 'activa', '2026-03-19 07:00:00+01'),

  ('al000001-0000-0000-0000-000000000002',
   'tarea_vencida', 'Tarea vencida — Gestionar desatasco EXP-2026-00007',
   'x0000001-0000-0000-0000-000000000007', 't0000001-0000-0000-0000-000000000003',
   'alta', 'activa', '2026-03-19 07:00:00+01'),

  ('al000001-0000-0000-0000-000000000003',
   'parte_pendiente_antiguo', 'Parte sin validar >3 días — EXP-2026-00003',
   'x0000001-0000-0000-0000-000000000003', null,
   'media', 'activa', '2026-03-18 07:00:00+01')
ON CONFLICT DO NOTHING;

-- ─── Pedidos de material ──────────────────────────────────────────────────
INSERT INTO pedidos_material (id, expediente_id, proveedor_id, estado, descripcion, importe_estimado,
  fecha_limite, enviado_at, confirmado_at, token_confirmacion, token_expira_at, numero_pedido, created_at)
VALUES
  -- Pedido confirmado
  ('pd000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000004',
   'p0000001-0000-0000-0000-000000000001',
   'confirmado', 'Impermeabilizante Sika 20L + rodillo aplicador', 185.00,
   '2026-03-25 23:59:00+01', '2026-03-15 10:00:00+01', '2026-03-16 09:00:00+01',
   null, null, 'PED-2026-0001', '2026-03-14 11:00:00+01'),

  -- Pedido enviado (pendiente confirmación)
  ('pd000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000014',
   'p0000001-0000-0000-0000-000000000002',
   'enviado', 'Kit de inyecciones epoxy para muro capilar húmedo', 320.00,
   '2026-03-23 23:59:00+01', '2026-03-18 09:00:00+01', null,
   'tok-demo-abc123', '2026-03-25 23:59:00+01', 'PED-2026-0002', '2026-03-17 10:00:00+01'),

  -- Pedido caducado (para demo de watchdog)
  ('pd000001-0000-0000-0000-000000000003', 'x0000001-0000-0000-0000-000000000002',
   'p0000001-0000-0000-0000-000000000001',
   'caducado', 'Llave de paso DN20 + accesorios', 95.00,
   '2026-03-10 23:59:00+01', '2026-03-05 09:00:00+01', null,
   null, null, 'PED-2026-0003', '2026-03-04 11:00:00+01')
ON CONFLICT (id) DO NOTHING;

-- ─── Partes de operario (1 pendiente de validación, 1 validado) ──────────
INSERT INTO partes_operario (id, expediente_id, operario_id, resultado, trabajos_realizados,
  observaciones, validado, created_at)
VALUES
  -- Parte pendiente de validación (>3 días → alerta activa)
  ('po000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000003',
   'o0000001-0000-0000-0000-000000000003',
   'reparado',
   'Sustitución de interruptores automáticos del cuadro eléctrico principal. Revisión general del cableado. Sin anomalías adicionales.',
   'Cuadro actualizado a normativa vigente. Se recomienda revisión anual.',
   false, '2026-03-14 16:00:00+01'),

  -- Parte validado (EXP finalizado)
  ('po000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000005',
   'o0000001-0000-0000-0000-000000000002',
   'reparado',
   'Sustitución de cristal templado 60x90cm de ventana lateral. Sellado perimetral con silicona neutra.',
   null,
   true, '2026-02-25 17:00:00+01')
ON CONFLICT (id) DO NOTHING;

-- ─── Videoperitaciones (demo VP) ─────────────────────────────────────────
INSERT INTO vp_videoperitaciones (id, expediente_id, perito_id, estado,
  titulo, descripcion_solicitud, tipo_peritacion,
  scheduled_at, started_at, ended_at, created_at)
VALUES
  -- VP activa (en progreso)
  ('vp000001-0000-0000-0000-000000000001', 'x0000001-0000-0000-0000-000000000009',
   'pe000001-0000-0000-0000-000000000002',
   'agendado',
   'Peritación eléctrica EXP-2026-00009',
   'Valoración de daños eléctricos y electrodomésticos afectados por cortocircuito',
   'remota',
   '2026-03-21 10:00:00+01', null, null, '2026-03-16 10:00:00+01'),

  -- VP completada y facturada
  ('vp000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000011',
   'pe000001-0000-0000-0000-000000000001',
   'facturado',
   'Peritación daños agua EXP-2026-00011',
   'Valoración daños por filtración de terraza y afectación de techo',
   'remota',
   '2026-03-05 11:00:00+01', '2026-03-05 11:05:00+01', '2026-03-05 12:15:00+01',
   '2026-03-03 09:00:00+01')
ON CONFLICT (id) DO NOTHING;

-- Informe VP (para la VP facturada)
INSERT INTO vp_informes (id, videoperitacion_id, expediente_id, estado, version,
  datos_expediente, hallazgos, resolucion_pericial, created_at)
VALUES
  ('vi000001-0000-0000-0000-000000000001', 'vp000001-0000-0000-0000-000000000002',
   'x0000001-0000-0000-0000-000000000011',
   'validado', 2,
   '{"tipo_siniestro":"agua","localidad":"Bilbao","fecha_siniestro":"2026-02-14"}',
   '{"danos_principales":"Filtración activa en junta de terraza con afectación de techo salón (4m²)","estado":"estructuralmente seguro"}',
   '{"causa":"Deterioro de impermeabilización de terraza","recomendacion":"Reparación impermeabilización + pintura interior"}',
   '2026-03-05 12:30:00+01')
ON CONFLICT (id) DO NOTHING;

-- Valoración VP (para la VP facturada)
INSERT INTO vp_valoraciones (id, videoperitacion_id, expediente_id, informe_id,
  estado, total_aplicado, baremo_id, baremo_version, baremo_nombre, created_at)
VALUES
  ('vv000001-0000-0000-0000-000000000001', 'vp000001-0000-0000-0000-000000000002',
   'x0000001-0000-0000-0000-000000000011', 'vi000001-0000-0000-0000-000000000001',
   'validada', 1840.00,
   '00000000-0000-0000-0000-000000000001', 1, 'Baremo Allianz 2026',
   '2026-03-05 12:45:00+01')
ON CONFLICT (id) DO NOTHING;

-- Factura VP (bridge)
INSERT INTO vp_facturas (id, videoperitacion_id, factura_id, expediente_id, valoracion_id, informe_id,
  importe_valoracion, baremo_version, emitida_por, emitida_at)
VALUES
  ('vf000001-0000-0000-0000-000000000001', 'vp000001-0000-0000-0000-000000000002',
   'f0000001-0000-0000-0000-000000000002', 'x0000001-0000-0000-0000-000000000011',
   'vv000001-0000-0000-0000-000000000001', 'vi000001-0000-0000-0000-000000000001',
   1840.00, 1,
   '00000000-0000-0000-0000-000000000001', '2026-03-08 10:00:00+01')
ON CONFLICT (id) DO NOTHING;
