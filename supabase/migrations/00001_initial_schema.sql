-- ============================================================
-- ERP Siniestros Hogar — Migración inicial
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF to_regprocedure('public.uuid_generate_v4()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.uuid_generate_v4()
      RETURNS uuid
      LANGUAGE sql
      AS $body$
        SELECT gen_random_uuid();
      $body$;
    $fn$;
  END IF;
END
$$;

-- ─── ENUMS ───
CREATE TYPE expediente_estado AS ENUM (
  'NUEVO', 'NO_ASIGNADO', 'EN_PLANIFICACION', 'EN_CURSO',
  'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE',
  'FINALIZADO', 'FACTURADO', 'COBRADO', 'CERRADO', 'CANCELADO'
);

CREATE TYPE prioridad AS ENUM ('baja', 'media', 'alta', 'urgente');

CREATE TYPE cita_estado AS ENUM ('programada', 'confirmada', 'realizada', 'cancelada', 'no_show');

CREATE TYPE comunicacion_tipo AS ENUM (
  'nota_interna', 'email_entrante', 'email_saliente', 'llamada', 'sms', 'sistema'
);

CREATE TYPE auditoria_accion AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ─── IDENTIDAD Y ACCESO ───

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150),
  telefono VARCHAR(20),
  avatar_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ─── NEGOCIO ───

CREATE TABLE companias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  cif VARCHAR(20),
  activa BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE empresas_facturadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  cif VARCHAR(20) UNIQUE NOT NULL,
  direccion TEXT,
  localidad VARCHAR(100),
  provincia VARCHAR(100),
  codigo_postal VARCHAR(10),
  telefono VARCHAR(20),
  email VARCHAR(150),
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asegurados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  telefono2 VARCHAR(20),
  email VARCHAR(150),
  direccion TEXT NOT NULL,
  codigo_postal VARCHAR(10) NOT NULL,
  localidad VARCHAR(100) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  nif VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE operarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  gremios TEXT[] DEFAULT '{}',
  zonas_cp TEXT[] DEFAULT '{}',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  cif VARCHAR(20),
  contacto VARCHAR(150),
  telefono VARCHAR(20),
  email VARCHAR(150),
  tipo VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE peritos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  compania_id UUID REFERENCES companias(id),
  telefono VARCHAR(20),
  email VARCHAR(150),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXPEDIENTES ───

CREATE TABLE expedientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_expediente VARCHAR(30) UNIQUE NOT NULL,
  estado expediente_estado NOT NULL DEFAULT 'NUEVO',
  compania_id UUID NOT NULL REFERENCES companias(id),
  empresa_facturadora_id UUID NOT NULL REFERENCES empresas_facturadoras(id),
  asegurado_id UUID NOT NULL REFERENCES asegurados(id),
  operario_id UUID REFERENCES operarios(id),
  perito_id UUID REFERENCES peritos(id),
  numero_poliza VARCHAR(50),
  numero_siniestro_cia VARCHAR(50),
  tipo_siniestro VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  direccion_siniestro TEXT NOT NULL,
  codigo_postal VARCHAR(10) NOT NULL,
  localidad VARCHAR(100) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  fecha_encargo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_limite_sla TIMESTAMPTZ,
  prioridad prioridad NOT NULL DEFAULT 'media',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expedientes_estado ON expedientes(estado);
CREATE INDEX idx_expedientes_compania ON expedientes(compania_id);
CREATE INDEX idx_expedientes_operario ON expedientes(operario_id);
CREATE INDEX idx_expedientes_numero ON expedientes(numero_expediente);
CREATE INDEX idx_expedientes_created ON expedientes(created_at DESC);

-- ─── OPERATIVA ───

CREATE TABLE citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  operario_id UUID NOT NULL REFERENCES operarios(id),
  fecha DATE NOT NULL,
  franja_inicio TIME NOT NULL,
  franja_fin TIME NOT NULL,
  estado cita_estado NOT NULL DEFAULT 'programada',
  notas TEXT,
  notificacion_enviada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citas_expediente ON citas(expediente_id);
CREATE INDEX idx_citas_operario_fecha ON citas(operario_id, fecha);

CREATE TABLE comunicaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  tipo comunicacion_tipo NOT NULL,
  asunto VARCHAR(300),
  contenido TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_nombre VARCHAR(200) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comunicaciones_expediente ON comunicaciones(expediente_id, created_at DESC);

CREATE TABLE partes_operario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  operario_id UUID NOT NULL REFERENCES operarios(id),
  cita_id UUID REFERENCES citas(id),
  trabajos_realizados TEXT NOT NULL,
  trabajos_pendientes TEXT,
  materiales_utilizados TEXT,
  observaciones TEXT,
  requiere_nueva_visita BOOLEAN DEFAULT FALSE,
  firma_cliente_url TEXT,
  validado BOOLEAN DEFAULT FALSE,
  validado_por UUID REFERENCES auth.users(id),
  validado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evidencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  parte_id UUID REFERENCES partes_operario(id),
  tipo VARCHAR(30) NOT NULL, -- foto, video, audio, documento
  storage_path TEXT NOT NULL,
  nombre_original VARCHAR(300),
  mime_type VARCHAR(100),
  tamano_bytes BIGINT,
  descripcion TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID REFERENCES expedientes(id),
  tipo VARCHAR(50) NOT NULL, -- factura_pdf, presupuesto_pdf, informe_pericial, etc
  storage_path TEXT NOT NULL,
  nombre VARCHAR(300) NOT NULL,
  generado_automaticamente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tareas_internas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID REFERENCES expedientes(id),
  titulo VARCHAR(300) NOT NULL,
  descripcion TEXT,
  asignado_a UUID REFERENCES auth.users(id),
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  fecha_limite TIMESTAMPTZ,
  completada BOOLEAN DEFAULT FALSE,
  completada_at TIMESTAMPTZ,
  prioridad prioridad DEFAULT 'media',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ECONÓMICO ───

CREATE TABLE baremos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compania_id UUID NOT NULL REFERENCES companias(id),
  nombre VARCHAR(200) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partidas_baremo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baremo_id UUID NOT NULL REFERENCES baremos(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  unidad VARCHAR(20) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE presupuestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  numero VARCHAR(30) UNIQUE NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
  importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  aprobado BOOLEAN DEFAULT FALSE,
  aprobado_por UUID REFERENCES auth.users(id),
  aprobado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lineas_presupuesto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  partida_baremo_id UUID REFERENCES partidas_baremo(id),
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  presupuesto_id UUID REFERENCES presupuestos(id),
  numero_factura VARCHAR(30) UNIQUE NOT NULL,
  empresa_facturadora_id UUID NOT NULL REFERENCES empresas_facturadoras(id),
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  base_imponible NUMERIC(12,2) NOT NULL,
  iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  iva_importe NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'emitida', -- emitida, enviada, cobrada, anulada
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lineas_factura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id UUID NOT NULL REFERENCES facturas(id),
  fecha_pago DATE NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  metodo VARCHAR(50) NOT NULL,
  referencia VARCHAR(100),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOGÍSTICA ───

CREATE TABLE pedidos_material (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  solicitado_por UUID NOT NULL REFERENCES auth.users(id),
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- pendiente, confirmado, recibido, cancelado
  fecha_limite DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lineas_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos_material(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  unidad VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE confirmaciones_proveedor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos_material(id),
  confirmado BOOLEAN NOT NULL,
  fecha_estimada_entrega DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GOBIERNO Y TRAZABILIDAD ───

CREATE TABLE historial_estados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  estado_anterior expediente_estado,
  estado_nuevo expediente_estado NOT NULL,
  motivo TEXT,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historial_expediente ON historial_estados(expediente_id, created_at DESC);

CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabla VARCHAR(100) NOT NULL,
  registro_id UUID NOT NULL,
  accion auditoria_accion NOT NULL,
  actor_id UUID,
  cambios JSONB NOT NULL DEFAULT '{}',
  ip INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auditoria_tabla_registro ON auditoria(tabla, registro_id);
CREATE INDEX idx_auditoria_created ON auditoria(created_at DESC);

CREATE TABLE eventos_dominio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  causation_id UUID,
  actor_id UUID NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INT DEFAULT 0,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eventos_aggregate ON eventos_dominio(aggregate_id, aggregate_type);
CREATE INDEX idx_eventos_unprocessed ON eventos_dominio(processed, occurred_at) WHERE NOT processed;

CREATE TABLE catalogos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(50) NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  valor VARCHAR(200) NOT NULL,
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  UNIQUE(tipo, codigo)
);

-- ─── FUNCIÓN: actualizar updated_at ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expedientes_updated BEFORE UPDATE ON expedientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_citas_updated BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_asegurados_updated BEFORE UPDATE ON asegurados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_operarios_updated BEFORE UPDATE ON operarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_presupuestos_updated BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON pedidos_material
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
