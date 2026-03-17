-- Seed: Roles base
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador del sistema'),
  ('supervisor', 'Supervisor de operaciones'),
  ('tramitador', 'Tramitador de expedientes'),
  ('operario', 'Operario de campo'),
  ('proveedor', 'Proveedor externo'),
  ('perito', 'Perito de compañía'),
  ('financiero', 'Responsable financiero'),
  ('direccion', 'Dirección / gerencia'),
  ('cliente_final', 'Cliente asegurado');

-- Seed: Permisos base
INSERT INTO permissions (codigo, descripcion) VALUES
  ('expedientes.read', 'Ver expedientes'),
  ('expedientes.create', 'Crear expedientes'),
  ('expedientes.update', 'Editar expedientes'),
  ('expedientes.transition', 'Cambiar estado de expedientes'),
  ('citas.read', 'Ver citas'),
  ('citas.create', 'Crear citas'),
  ('citas.update', 'Editar citas'),
  ('partes.read', 'Ver partes de operario'),
  ('partes.create', 'Crear partes'),
  ('partes.validate', 'Validar partes'),
  ('facturas.read', 'Ver facturas'),
  ('facturas.create', 'Crear facturas'),
  ('facturas.send', 'Enviar facturas'),
  ('pagos.read', 'Ver pagos'),
  ('pagos.create', 'Registrar pagos'),
  ('pedidos.read', 'Ver pedidos'),
  ('pedidos.create', 'Crear pedidos'),
  ('auditoria.read', 'Ver auditoría'),
  ('usuarios.manage', 'Gestionar usuarios'),
  ('bi.read', 'Ver analítica');

-- Seed: Catálogos
INSERT INTO catalogos (tipo, codigo, valor, orden) VALUES
  ('tipo_siniestro', 'agua', 'Daños por agua', 1),
  ('tipo_siniestro', 'incendio', 'Incendio', 2),
  ('tipo_siniestro', 'robo', 'Robo', 3),
  ('tipo_siniestro', 'fenomeno_atmosferico', 'Fenómeno atmosférico', 4),
  ('tipo_siniestro', 'rotura_cristales', 'Rotura de cristales', 5),
  ('tipo_siniestro', 'responsabilidad_civil', 'Responsabilidad civil', 6),
  ('tipo_siniestro', 'electrico', 'Daños eléctricos', 7),
  ('tipo_siniestro', 'otros', 'Otros', 99),
  ('gremio', 'fontaneria', 'Fontanería', 1),
  ('gremio', 'electricidad', 'Electricidad', 2),
  ('gremio', 'albanileria', 'Albañilería', 3),
  ('gremio', 'pintura', 'Pintura', 4),
  ('gremio', 'carpinteria', 'Carpintería', 5),
  ('gremio', 'cerrajeria', 'Cerrajería', 6),
  ('gremio', 'cristaleria', 'Cristalería', 7),
  ('gremio', 'limpieza', 'Limpieza', 8);
