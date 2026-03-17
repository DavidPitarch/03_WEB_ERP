// @erp/types — Tipos compartidos del dominio

// ─── Estados del expediente ───
export const EXPEDIENTE_ESTADOS = [
  'NUEVO',
  'NO_ASIGNADO',
  'EN_PLANIFICACION',
  'EN_CURSO',
  'PENDIENTE',
  'PENDIENTE_MATERIAL',
  'PENDIENTE_PERITO',
  'PENDIENTE_CLIENTE',
  'FINALIZADO',
  'FACTURADO',
  'COBRADO',
  'CERRADO',
  'CANCELADO',
] as const;

export type ExpedienteEstado = (typeof EXPEDIENTE_ESTADOS)[number];

// ─── Roles ───
export const ROLES = [
  'admin',
  'supervisor',
  'tramitador',
  'operario',
  'proveedor',
  'perito',
  'financiero',
  'direccion',
  'cliente_final',
] as const;

export type Rol = (typeof ROLES)[number];

// ─── Entidades base ───
export interface Expediente {
  id: string;
  numero_expediente: string;
  estado: ExpedienteEstado;
  compania_id: string;
  empresa_facturadora_id: string;
  asegurado_id: string;
  operario_id: string | null;
  perito_id: string | null;
  numero_poliza: string | null;
  numero_siniestro_cia: string | null;
  tipo_siniestro: string;
  descripcion: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  fecha_encargo: string;
  fecha_limite_sla: string | null;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  created_at: string;
  updated_at: string;
}

export interface Asegurado {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  telefono2: string | null;
  email: string | null;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  nif: string | null;
  created_at: string;
}

export interface Compania {
  id: string;
  nombre: string;
  codigo: string;
  activa: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface EmpresaFacturadora {
  id: string;
  nombre: string;
  cif: string;
  direccion: string;
  activa: boolean;
  created_at: string;
}

export interface Operario {
  id: string;
  user_id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  gremios: string[];
  zonas_cp: string[];
  activo: boolean;
  created_at: string;
}

export interface Cita {
  id: string;
  expediente_id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  estado: 'programada' | 'confirmada' | 'realizada' | 'cancelada' | 'no_show';
  notas: string | null;
  notificacion_enviada: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comunicacion {
  id: string;
  expediente_id: string;
  tipo: 'nota_interna' | 'email_entrante' | 'email_saliente' | 'llamada' | 'sms' | 'sistema';
  asunto: string | null;
  contenido: string;
  actor_id: string;
  actor_nombre: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ParteOperario {
  id: string;
  expediente_id: string;
  operario_id: string;
  cita_id: string;
  trabajos_realizados: string;
  trabajos_pendientes: string | null;
  materiales_utilizados: string | null;
  observaciones: string | null;
  resultado: ResultadoVisita | null;
  motivo_resultado: string | null;
  requiere_nueva_visita: boolean;
  firma_cliente_url: string | null;
  firma_storage_path: string | null;
  sync_status: string;
  validado: boolean;
  validado_por: string | null;
  validado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistorialEstado {
  id: string;
  expediente_id: string;
  estado_anterior: ExpedienteEstado | null;
  estado_nuevo: ExpedienteEstado;
  motivo: string | null;
  actor_id: string;
  created_at: string;
}

export interface Auditoria {
  id: string;
  tabla: string;
  registro_id: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_id: string;
  cambios: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export interface EventoDominio {
  id: string;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  version: number;
  payload: Record<string, unknown>;
  correlation_id: string;
  causation_id: string | null;
  actor_id: string;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  retry_count: number;
  occurred_at: string;
}

// ─── Tipos de eventos de dominio ───
export const DOMAIN_EVENT_TYPES = [
  'ExpedienteCreado',
  'ExpedienteActualizado',
  'CitaAgendada',
  'CitaReprogramada',
  'ParteRecibido',
  'ParteValidado',
  'PedidoCreado',
  'PedidoConfirmado',
  'InstruccionPericialEmitida',
  'ExpedienteFinalizado',
  'FacturaEmitida',
  'PagoRegistrado',
  'TareaDisparada',
  'ClienteConfirmaCita',
  'PedidoEnviado',
  'PedidoCaducado',
  'PedidoRecogido',
  'PedidoCancelado',
  'AutofacturaGenerada',
  'AutofacturaEmitida',
  'FacturaEnviada',
  'DictamenEmitido',
  'DictamenAceptado',
  'DictamenRechazado',
  'VideoperitacionCreada',
  'VideoperitacionEncargoRecibido',
  'VideoperitacionContactoIntentado',
  'VideoperitacionAgendada',
  'VideoperitacionReprogramada',
  'VideoperitacionCancelada',
  'LinkVideoperitacionEnviado',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// ─── API contracts ───
export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Paginación ───
export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ─── Origen del expediente ───
export const EXPEDIENTE_ORIGENES = ['manual', 'api', 'webhook', 'email', 'import'] as const;
export type ExpedienteOrigen = (typeof EXPEDIENTE_ORIGENES)[number];

// ─── Expediente extendido con campos R1 ───
export interface ExpedienteCompleto extends Expediente {
  origen: ExpedienteOrigen;
  referencia_externa: string | null;
  datos_origen: Record<string, unknown>;
  // Joins
  companias?: Compania;
  asegurados?: Asegurado;
  operarios?: Operario;
  peritos?: { id: string; nombre: string; apellidos: string } | null;
  empresas_facturadoras?: EmpresaFacturadora;
}

// ─── Filtros expedientes ───
export interface ExpedienteFilters {
  estado?: ExpedienteEstado;
  compania_id?: string;
  operario_id?: string;
  prioridad?: Expediente['prioridad'];
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

// ─── Contadores de bandeja ───
export interface BandejaContadores {
  [estado: string]: number;
}

// ─── Timeline unificada ───
export type TimelineItemType = 'estado' | 'comunicacion' | 'cita' | 'sistema';

export interface TimelineItem {
  id: string;
  timeline_type: TimelineItemType;
  created_at: string;
  // Estado
  estado_anterior?: string | null;
  estado_nuevo?: string;
  motivo?: string | null;
  // Comunicación
  tipo?: string;
  asunto?: string | null;
  contenido?: string;
  actor_nombre?: string;
  // Cita
  fecha?: string;
  franja_inicio?: string;
  franja_fin?: string;
  estado?: string;
}

// ─── Informe caducado ───
export interface InformeCaducado {
  cita_id: string;
  expediente_id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  numero_expediente: string;
  estado_expediente: string;
  operario_nombre: string;
  operario_apellidos: string;
}

// ─── Intake (ingesta) ───
export interface IntakeClaimRequest {
  referencia_externa: string;
  compania_codigo: string;
  tipo_siniestro: string;
  descripcion: string;
  numero_poliza?: string;
  numero_siniestro_cia?: string;
  prioridad?: 'baja' | 'media' | 'alta' | 'urgente';
  fecha_limite_sla?: string;
  asegurado: {
    nombre: string;
    apellidos: string;
    telefono: string;
    telefono2?: string;
    email?: string;
    nif?: string;
    direccion: string;
    codigo_postal: string;
    localidad: string;
    provincia: string;
  };
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  metadata?: Record<string, unknown>;
}

export interface IntakeClaimResponse {
  status: 'created' | 'duplicate_detected' | 'validation_error';
  expediente_id?: string;
  numero_expediente?: string;
  duplicate_of?: string;
  errors?: string[];
}

// ─── Búsqueda universal ───
export interface SearchResult {
  type: 'expediente' | 'asegurado';
  id: string;
  title: string;
  subtitle: string;
  expediente_id?: string;
}

// ─── Crear expediente ───
export interface CreateExpedienteRequest {
  compania_id: string;
  empresa_facturadora_id: string;
  tipo_siniestro: string;
  descripcion: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  numero_poliza?: string;
  numero_siniestro_cia?: string;
  prioridad?: 'baja' | 'media' | 'alta' | 'urgente';
  fecha_limite_sla?: string;
  origen?: ExpedienteOrigen;
  referencia_externa?: string;
  // Asegurado: existente o nuevo
  asegurado_id?: string;
  asegurado_nuevo?: {
    nombre: string;
    apellidos: string;
    telefono: string;
    telefono2?: string;
    email?: string;
    nif?: string;
    direccion: string;
    codigo_postal: string;
    localidad: string;
    provincia: string;
  };
}

// ─── R1-B: Operator PWA types ───

export const RESULTADO_VISITA = ['completada', 'pendiente', 'ausente', 'requiere_material'] as const;
export type ResultadoVisita = (typeof RESULTADO_VISITA)[number];

export const EVIDENCIA_CLASIFICACION = ['antes', 'durante', 'despues', 'general'] as const;
export type EvidenciaClasificacion = (typeof EVIDENCIA_CLASIFICACION)[number];

export interface AgendaItem {
  cita_id: string;
  expediente_id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  cita_estado: string;
  cita_notas: string | null;
  numero_expediente: string;
  expediente_estado: string;
  tipo_siniestro: string;
  descripcion: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  prioridad: string;
  asegurado_nombre: string;
  asegurado_apellidos: string;
  asegurado_telefono: string;
  asegurado_telefono2: string | null;
  tiene_parte: boolean;
}

export interface OperatorClaimDetail {
  id: string;
  numero_expediente: string;
  estado: ExpedienteEstado;
  tipo_siniestro: string;
  descripcion: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  prioridad: string;
  asegurado: {
    nombre: string;
    apellidos: string;
    telefono: string;
    telefono2: string | null;
  };
  citas: Cita[];
  partes: ParteOperario[];
}

export interface CreateParteRequest {
  expediente_id: string;
  cita_id: string;
  trabajos_realizados: string;
  trabajos_pendientes?: string;
  materiales_utilizados?: string;
  observaciones?: string;
  resultado: ResultadoVisita;
  motivo_resultado?: string;
  requiere_nueva_visita: boolean;
  firma_storage_path?: string;
  evidencia_ids?: string[];
}

export interface UploadInitResponse {
  upload_id: string;
  signed_url: string;
  storage_path: string;
}

export interface UploadCompleteRequest {
  upload_id: string;
  storage_path: string;
  expediente_id: string;
  parte_id?: string;
  cita_id?: string;
  clasificacion: EvidenciaClasificacion;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
}

// ─── R2-A.2: Tareas, Alertas, Baremos, Presupuestos ───

export const TAREA_ESTADOS = ['pendiente', 'en_progreso', 'pospuesta', 'resuelta', 'cancelada'] as const;
export type TareaEstado = (typeof TAREA_ESTADOS)[number];

export const ALERTA_TIPOS = ['tarea_vencida', 'sla_proximo', 'parte_pendiente_antiguo', 'pendiente_sin_revision', 'informe_caducado', 'custom'] as const;
export type AlertaTipo = (typeof ALERTA_TIPOS)[number];

export const ALERTA_ESTADOS = ['activa', 'pospuesta', 'resuelta', 'descartada'] as const;
export type AlertaEstado = (typeof ALERTA_ESTADOS)[number];

export const CAUSA_PENDIENTE = ['material', 'perito', 'cliente_ausente', 'cliente_rechaza', 'acceso_impedido', 'condiciones_meteorologicas', 'otra'] as const;
export type CausaPendiente = (typeof CAUSA_PENDIENTE)[number];

export interface TareaInterna {
  id: string;
  expediente_id: string | null;
  titulo: string;
  descripcion: string | null;
  asignado_a: string | null;
  creado_por: string;
  fecha_limite: string | null;
  completada: boolean;
  completada_at: string | null;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  estado: TareaEstado;
  fecha_pospuesta: string | null;
  motivo_posposicion: string | null;
  resolucion: string | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alerta {
  id: string;
  tipo: AlertaTipo;
  titulo: string;
  mensaje: string | null;
  expediente_id: string | null;
  tarea_id: string | null;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  estado: AlertaEstado;
  pospuesta_hasta: string | null;
  destinatario_id: string | null;
  created_at: string;
  resuelta_at: string | null;
}

export interface Baremo {
  id: string;
  compania_id: string;
  nombre: string;
  version: number;
  tipo: 'compania' | 'operario';
  operario_id: string | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  created_at: string;
}

export interface PartidaBaremo {
  id: string;
  baremo_id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precio_unitario: number;
  precio_operario: number | null;
  especialidad: string | null;
  activa: boolean;
  created_at: string;
}

export interface Presupuesto {
  id: string;
  expediente_id: string;
  numero: string;
  estado: string;
  importe_total: number;
  coste_estimado: number;
  ingreso_estimado: number;
  margen_previsto: number;
  parte_id: string | null;
  aprobado: boolean;
  aprobado_por: string | null;
  aprobado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineaPresupuesto {
  id: string;
  presupuesto_id: string;
  partida_baremo_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_operario: number;
  importe: number;
  descuento_porcentaje: number;
  iva_porcentaje: number;
  subtotal: number;
  expediente_id: string | null;
  parte_id: string | null;
  created_at: string;
}

export interface SlaStatus {
  fecha_limite: string | null;
  tiempo_total_ms: number;
  tiempo_suspendido_ms: number;
  tiempo_efectivo_ms: number;
  porcentaje_consumido: number;
  estado_sla: 'ok' | 'warning' | 'critical' | 'vencido' | 'sin_sla';
}

// ─── EP-08: Facturación, cobro y tesorería ───

export const FACTURA_ESTADOS = ['borrador', 'emitida', 'enviada', 'cobrada', 'anulada'] as const;
export type FacturaEstado = (typeof FACTURA_ESTADOS)[number];

export const ESTADO_COBRO = ['pendiente', 'vencida', 'reclamada', 'cobrada', 'incobrable'] as const;
export type EstadoCobro = (typeof ESTADO_COBRO)[number];

export const CANAL_ENVIO = ['email', 'api', 'portal', 'manual'] as const;
export type CanalEnvio = (typeof CANAL_ENVIO)[number];

export interface SerieFacturacion {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
  empresa_facturadora_id: string;
  tipo: 'ordinaria' | 'rectificativa' | 'abono';
  contador_actual: number;
  activa: boolean;
  created_at: string;
}

export interface Factura {
  id: string;
  expediente_id: string;
  presupuesto_id: string | null;
  serie_id: string | null;
  compania_id: string | null;
  numero_factura: string;
  empresa_facturadora_id: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  base_imponible: number;
  iva_porcentaje: number;
  iva_importe: number;
  total: number;
  estado: FacturaEstado;
  estado_cobro: EstadoCobro;
  forma_pago: string | null;
  cuenta_bancaria: string | null;
  notas: string | null;
  canal_envio: CanalEnvio | null;
  enviada_at: string | null;
  envio_resultado: string | null;
  envio_error: string | null;
  pdf_storage_path: string | null;
  emitida_por: string | null;
  anulada_at: string | null;
  anulada_motivo: string | null;
  cobrada_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineaFactura {
  id: string;
  factura_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  descuento_porcentaje: number;
  iva_porcentaje: number;
  subtotal: number;
  partida_baremo_id: string | null;
  linea_presupuesto_id: string | null;
  created_at: string;
}

export interface Pago {
  id: string;
  factura_id: string;
  fecha_pago: string;
  importe: number;
  metodo: string;
  referencia: string | null;
  notas: string | null;
  actor_id: string | null;
  tipo: 'cobro' | 'devolucion' | 'parcial';
  conciliacion_ref: string | null;
  created_at: string;
}

export interface SeguimientoCobro {
  id: string;
  factura_id: string;
  tipo: 'reclamacion' | 'nota' | 'contacto' | 'gestion';
  contenido: string;
  proximo_contacto: string | null;
  actor_id: string;
  created_at: string;
}

export interface EmitirFacturaRequest {
  expediente_id: string;
  serie_id: string;
  presupuesto_id?: string;
  forma_pago?: string;
  cuenta_bancaria?: string;
  notas?: string;
  iva_porcentaje?: number;
}

export interface RegistrarCobroRequest {
  fecha_pago: string;
  importe: number;
  metodo: string;
  referencia?: string;
  notas?: string;
}

// ─── EP-09: Proveedores y logística de materiales ───

export const PEDIDO_ESTADOS = ['pendiente', 'enviado', 'confirmado', 'listo_para_recoger', 'recogido', 'caducado', 'cancelado'] as const;
export type PedidoEstado = (typeof PEDIDO_ESTADOS)[number];

export interface Proveedor {
  id: string;
  nombre: string;
  cif: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  provincia: string | null;
  canal_preferido: 'email' | 'portal' | 'telefono' | 'manual';
  especialidades: string[];
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoMaterial {
  id: string;
  expediente_id: string;
  proveedor_id: string;
  cita_id: string | null;
  numero_pedido: string;
  estado: PedidoEstado;
  fecha_limite: string | null;
  observaciones: string | null;
  enviado_at: string | null;
  enviado_por: string | null;
  envio_error: string | null;
  confirmado_at: string | null;
  recogido_at: string | null;
  recogido_por: string | null;
  cancelado_at: string | null;
  cancelado_motivo: string | null;
  caducado_at: string | null;
  token_confirmacion: string | null;
  token_expira_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LineaPedido {
  id: string;
  pedido_id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  referencia: string | null;
  notas: string | null;
  created_at: string;
}

export interface ConfirmacionProveedor {
  id: string;
  pedido_id: string;
  token: string;
  ip: string | null;
  user_agent: string | null;
  confirmado_at: string;
}

export interface CreatePedidoRequest {
  expediente_id: string;
  proveedor_id: string;
  cita_id?: string;
  fecha_limite?: string;
  observaciones?: string;
  lineas: {
    descripcion: string;
    cantidad: number;
    unidad?: string;
    referencia?: string;
    notas?: string;
  }[];
}

export interface CreateProveedorRequest {
  nombre: string;
  cif?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  codigo_postal?: string;
  localidad?: string;
  provincia?: string;
  canal_preferido?: 'email' | 'portal' | 'telefono' | 'manual';
  especialidades?: string[];
  notas?: string;
}

// ─── EP-10: BI, Reporting y Autofacturación ───

export const AUTOFACTURA_ESTADOS = ['borrador', 'revisada', 'emitida', 'anulada'] as const;
export type AutofacturaEstado = (typeof AUTOFACTURA_ESTADOS)[number];

export interface DashboardKpis {
  total_expedientes: number;
  exp_en_curso: number;
  exp_pendientes: number;
  exp_finalizados_sin_factura: number;
  exp_sin_presupuesto: number;
  total_facturas_emitidas: number;
  total_facturado: number;
  total_cobrado: number;
  total_pendiente_cobro: number;
  facturas_vencidas: number;
  pedidos_caducados: number;
  informes_caducados: number;
}

export interface ExpedienteRentabilidad {
  expediente_id: string;
  numero_expediente: string;
  estado: string;
  compania_id: string;
  tipo_siniestro: string;
  ingreso_estimado: number;
  coste_estimado: number;
  margen_previsto: number;
  total_facturado: number;
  total_cobrado: number;
  margen_real: number;
  desviacion: number;
  es_deficitario: boolean;
}

export interface RentabilidadCompania {
  compania_id: string;
  compania_nombre: string;
  num_expedientes: number;
  ingreso_total: number;
  coste_total: number;
  margen_total: number;
  facturado_total: number;
  cobrado_total: number;
  margen_medio_pct: number;
  expedientes_deficitarios: number;
}

export interface ProductividadOperario {
  operario_id: string;
  nombre: string;
  apellidos: string;
  total_citas: number;
  citas_realizadas: number;
  partes_enviados: number;
  partes_validados: number;
  tasa_validacion: number;
  informes_caducados: number;
}

export interface Autofactura {
  id: string;
  operario_id: string;
  periodo_desde: string;
  periodo_hasta: string;
  numero_autofactura: string;
  estado: AutofacturaEstado;
  base_imponible: number;
  iva_porcentaje: number;
  iva_importe: number;
  total: number;
  datos_fiscales: Record<string, unknown> | null;
  cuenta_bancaria: string | null;
  notas: string | null;
  emitida_por: string | null;
  emitida_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineaAutofactura {
  id: string;
  autofactura_id: string;
  expediente_id: string | null;
  parte_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  created_at: string;
}

export interface GenerarAutofacturaRequest {
  operario_id: string;
  periodo_desde: string;
  periodo_hasta: string;
}

// ─── EP-11: Portal de peritos ───

export const DICTAMEN_ESTADOS = ['borrador', 'emitido', 'revisado', 'aceptado', 'rechazado'] as const;
export type DictamenEstado = (typeof DICTAMEN_ESTADOS)[number];

export const EVIDENCIA_DICTAMEN_CLASIFICACION = ['dano', 'causa', 'contexto', 'detalle'] as const;
export type EvidenciaDictamenClasificacion = (typeof EVIDENCIA_DICTAMEN_CLASIFICACION)[number];

export interface Perito {
  id: string;
  user_id: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  colegiado_numero: string | null;
  especialidades: string[];
  compania_ids: string[];
  activo: boolean;
  created_at: string;
}

export interface DictamenPericial {
  id: string;
  expediente_id: string;
  perito_id: string;
  numero_dictamen: string;
  fecha_inspeccion: string | null;
  tipo_dano: string | null;
  causa_dano: string | null;
  valoracion_danos: number;
  valoracion_reparacion: number;
  cobertura_aplicable: string | null;
  observaciones: string | null;
  recomendaciones: string | null;
  estado: DictamenEstado;
  pdf_storage_path: string | null;
  emitido_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenciaDictamen {
  id: string;
  dictamen_id: string;
  storage_path: string;
  nombre_original: string;
  clasificacion: EvidenciaDictamenClasificacion;
  notas: string | null;
  created_at: string;
}

export interface CreateDictamenRequest {
  expediente_id: string;
  fecha_inspeccion?: string;
  tipo_dano?: string;
  causa_dano?: string;
  valoracion_danos?: number;
  valoracion_reparacion?: number;
  cobertura_aplicable?: string;
  observaciones?: string;
  recomendaciones?: string;
}

export interface CreatePeritoRequest {
  user_id: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  email?: string;
  colegiado_numero?: string;
  especialidades?: string[];
  compania_ids?: string[];
}

// ─── EP-11B: Videoperitación ───

export const VP_ESTADOS = [
  'encargo_recibido', 'pendiente_contacto', 'contactado', 'agendado',
  'link_enviado', 'sesion_programada', 'sesion_en_curso', 'sesion_finalizada',
  'pendiente_perito', 'revision_pericial',
  'pendiente_informe', 'informe_borrador', 'informe_validado',
  'valoracion_calculada', 'facturado', 'enviado', 'cerrado',
  'cancelado', 'sesion_fallida', 'cliente_ausente',
] as const;
export type VpEstado = (typeof VP_ESTADOS)[number];

export const VP_COMUNICACION_TIPOS = ['llamada_entrante', 'llamada_saliente', 'email_entrante', 'email_saliente', 'nota_interna', 'sistema'] as const;
export type VpComunicacionTipo = (typeof VP_COMUNICACION_TIPOS)[number];

export interface Videoperitacion {
  id: string;
  expediente_id: string;
  perito_id: string | null;
  numero_caso: string;
  estado: VpEstado;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  motivo_tecnico: string | null;
  origen: 'manual' | 'api' | 'webhook' | 'compania';
  referencia_externa: string | null;
  deadline: string | null;
  cancelado_at: string | null;
  cancelado_motivo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VpEncargo {
  id: string;
  videoperitacion_id: string;
  tipo: 'hoja_encargo' | 'declaracion_siniestro';
  contenido: string;
  datos_estructurados: Record<string, unknown> | null;
  adjuntos_refs: string[];
  registrado_por: string;
  created_at: string;
}

export interface VpComunicacion {
  id: string;
  videoperitacion_id: string;
  tipo: VpComunicacionTipo;
  emisor_tipo: 'oficina' | 'cliente' | 'compania' | 'perito' | null;
  resultado: string | null;
  asunto: string | null;
  contenido: string;
  adjuntos_refs: string[];
  actor_id: string;
  actor_nombre: string | null;
  created_at: string;
}

export interface VpIntentoContacto {
  id: string;
  videoperitacion_id: string;
  intento_numero: number;
  canal: 'telefono' | 'email' | 'sms';
  resultado: string;
  notas: string | null;
  actor_id: string;
  created_at: string;
}

export interface VpAgenda {
  id: string;
  videoperitacion_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'programada' | 'confirmada' | 'realizada' | 'cancelada' | 'no_show' | 'reprogramada';
  link_externo: string | null;
  link_token: string | null;
  link_expira_at: string | null;
  link_enviado_at: string | null;
  link_reenvios: number;
  notas: string | null;
  created_by: string;
  created_at: string;
}

export const VP_SESION_ESTADOS = ['pendiente', 'creada', 'iniciada', 'finalizada', 'fallida', 'ausente', 'cancelada'] as const;
export type VpSesionEstado = (typeof VP_SESION_ESTADOS)[number];

export const VP_ARTEFACTO_TIPOS = ['recording', 'audio', 'transcript', 'screenshot', 'document', 'evidence', 'foto', 'adjunto_cliente', 'adjunto_perito', 'adjunto_compania', 'hoja_encargo', 'declaracion'] as const;
export type VpArtefactoTipo = (typeof VP_ARTEFACTO_TIPOS)[number];

export interface VpSesion {
  id: string;
  videoperitacion_id: string;
  agenda_id: string | null;
  external_session_id: string | null;
  estado: VpSesionEstado;
  iniciada_at: string | null;
  finalizada_at: string | null;
  duracion_segundos: number | null;
  participantes_conectados: number;
  participantes: Array<{ role: string; name: string }> | null;
  room_url: string | null;
  expires_at: string | null;
  correlation_id: string | null;
  source_event_id: string | null;
  cancel_reason: string | null;
  incidencias: string | null;
  created_at: string;
}

export interface VpArtefacto {
  id: string;
  videoperitacion_id: string;
  expediente_id: string | null;
  sesion_id: string | null;
  tipo: VpArtefactoTipo;
  origen: 'webhook' | 'manual' | 'perito' | 'sistema' | null;
  storage_path: string | null;
  provider_url: string | null;
  external_ref: string | null;
  nombre_original: string | null;
  mime_type: string | null;
  tamano_bytes: number | null;
  duracion_segundos: number | null;
  estado_disponibilidad: 'pendiente' | 'disponible' | 'expirado' | 'eliminado';
  politica_retencion: string;
  visibility_scope: 'office' | 'perito' | 'all';
  clasificacion: string | null;
  notas: string | null;
  source_event_id: string | null;
  subido_por: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VpTranscripcion {
  id: string;
  artefacto_id: string;
  videoperitacion_id: string;
  sesion_id: string | null;
  idioma: string;
  texto_completo: string;
  resumen: string | null;
  highlights: string[] | null;
  segmentos: Array<{ start: number; end: number; speaker: string; text: string }> | null;
  proveedor: string | null;
  source_event_id: string | null;
  created_at: string;
}

export interface VpAccesoArtefacto {
  id: string;
  artefacto_id: string;
  user_id: string;
  user_role: string;
  access_type: 'view' | 'download' | 'stream';
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface VpConsentimiento {
  id: string;
  videoperitacion_id: string;
  tipo: 'videoperitacion' | 'grabacion_video' | 'grabacion_audio' | 'transcripcion';
  estado: 'pendiente' | 'otorgado' | 'denegado' | 'revocado';
  otorgado_por: string | null;
  otorgado_at: string | null;
  canal: string | null;
  created_at: string;
}

export interface CreateVideoperitacionRequest {
  expediente_id: string;
  perito_id?: string;
  motivo_tecnico?: string;
  prioridad?: 'baja' | 'media' | 'alta' | 'urgente';
  origen?: 'manual' | 'api' | 'webhook' | 'compania';
  referencia_externa?: string;
  deadline?: string;
}

export interface AgendarVpRequest {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  notas?: string;
}

// ─── EP-11B Sprint 3: Cockpit Pericial ───

export const VP_DICTAMEN_ESTADOS = ['borrador', 'emitido', 'validado', 'rechazado', 'requiere_mas_informacion'] as const;
export type VpDictamenEstado = (typeof VP_DICTAMEN_ESTADOS)[number];

export const VP_RESOLUCION_TIPOS = ['aprobacion', 'rechazo', 'solicitud_informacion', 'instruccion_tecnica', 'cierre_revision'] as const;
export type VpResolucionTipo = (typeof VP_RESOLUCION_TIPOS)[number];

export const VP_INSTRUCCION_TIPOS = ['continuidad', 'redireccion', 'suspension', 'ampliacion', 'cierre'] as const;
export type VpInstruccionTipo = (typeof VP_INSTRUCCION_TIPOS)[number];

export const VP_IMPACTO_EXPEDIENTE = ['mantener_pendiente', 'reactivar', 'redirigir', 'cerrar', 'sin_impacto'] as const;
export type VpImpactoExpediente = (typeof VP_IMPACTO_EXPEDIENTE)[number];

export interface VpDictamen {
  id: string;
  videoperitacion_id: string;
  expediente_id: string;
  perito_id: string;
  sesion_id: string | null;
  version: number;
  estado: VpDictamenEstado;
  tipo_resolucion: VpResolucionTipo | null;
  conclusiones: string | null;
  observaciones: string | null;
  hallazgos: Array<{ zona: string; dano: string; gravedad: string; descripcion: string }> | null;
  recomendaciones: string | null;
  motivo_rechazo: string | null;
  informacion_solicitada: string | null;
  instruccion_tecnica: string | null;
  impacto_expediente: VpImpactoExpediente | null;
  expediente_estado_previo: string | null;
  expediente_estado_nuevo: string | null;
  artefactos_revisados: string[];
  sesiones_revisadas: string[];
  emitido_at: string | null;
  validado_at: string | null;
  validado_por: string | null;
  rechazado_at: string | null;
  rechazado_por: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VpDictamenVersion {
  id: string;
  dictamen_id: string;
  version: number;
  estado: string;
  conclusiones: string | null;
  observaciones: string | null;
  hallazgos: any | null;
  recomendaciones: string | null;
  snapshot_at: string;
  snapshot_by: string;
}

export interface VpInstruccion {
  id: string;
  videoperitacion_id: string;
  dictamen_id: string | null;
  expediente_id: string;
  perito_id: string;
  tipo: VpInstruccionTipo;
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'ejecutada';
  respuesta_oficina: string | null;
  respondido_por: string | null;
  respondido_at: string | null;
  created_by: string;
  created_at: string;
}

// ─── EP-11B Sprint 4: Informe Técnico + Valoración ──────────────────

export const VP_INFORME_ESTADOS = ['borrador', 'en_revision', 'validado', 'rectificado', 'enviado'] as const;
export type VpInformeEstado = typeof VP_INFORME_ESTADOS[number];

export const VP_VALORACION_ESTADOS = ['borrador', 'calculada', 'validada', 'rectificada'] as const;
export type VpValoracionEstado = typeof VP_VALORACION_ESTADOS[number];

export interface VpInforme {
  id: string;
  videoperitacion_id: string;
  expediente_id: string;
  estado: VpInformeEstado;
  version: number;
  datos_expediente: Record<string, any>;
  datos_encargo: Record<string, any>;
  datos_videoperitacion: Record<string, any>;
  resumen_sesion: Record<string, any>;
  evidencias_principales: string[];
  hallazgos: any[];
  conclusiones: string | null;
  extractos_transcripcion: any[];
  resolucion_pericial: Record<string, any>;
  observaciones_finales: string | null;
  dictamen_id: string | null;
  valoracion_id: string | null;
  creado_por: string;
  validado_por: string | null;
  validado_at: string | null;
  enviado_at: string | null;
  rectificado_at: string | null;
  rectificado_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface VpInformeVersion {
  id: string;
  informe_id: string;
  version: number;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  contenido_snapshot: Record<string, any>;
  creado_por: string;
  motivo: string | null;
  created_at: string;
}

export interface VpValoracion {
  id: string;
  videoperitacion_id: string;
  expediente_id: string;
  estado: VpValoracionEstado;
  baremo_id: string | null;
  baremo_version: number | null;
  baremo_nombre: string | null;
  importe_total: number;
  importe_baremo: number;
  importe_ajustado: number;
  desviacion_total: number;
  calculado_por: string | null;
  calculado_at: string | null;
  validado_por: string | null;
  validado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VpValoracionLinea {
  id: string;
  valoracion_id: string;
  partida_baremo_id: string | null;
  codigo: string | null;
  descripcion: string;
  especialidad: string | null;
  unidad: string | null;
  precio_unitario_baremo: number;
  cantidad: number;
  precio_unitario_aplicado: number;
  importe: number;
  es_ajuste_manual: boolean;
  ajustado_por: string | null;
  motivo_ajuste: string | null;
  fuera_de_baremo: boolean;
  observaciones: string | null;
  orden: number;
  created_at: string;
}

// ─── EP-11B Sprint 5: Facturación VP + Envío + Documento Final ──────

export const VP_DOCUMENTO_ESTADOS = ['generando', 'generado', 'firmado', 'enviado', 'error'] as const;
export type VpDocumentoEstado = typeof VP_DOCUMENTO_ESTADOS[number];

export const VP_ENVIO_ESTADOS = ['pendiente', 'enviando', 'enviado', 'error', 'acusado'] as const;
export type VpEnvioEstado = typeof VP_ENVIO_ESTADOS[number];

export const VP_ENVIO_CANALES = ['email', 'api', 'portal', 'manual'] as const;
export type VpEnvioCanal = typeof VP_ENVIO_CANALES[number];

export interface VpDocumentoFinal {
  id: string;
  videoperitacion_id: string;
  informe_id: string;
  expediente_id: string;
  version: number;
  estado: VpDocumentoEstado;
  contenido_json: Record<string, any>;
  storage_path: string | null;
  nombre_archivo: string | null;
  formato: string;
  tamano_bytes: number | null;
  config_branding: Record<string, any>;
  generado_por: string;
  generado_at: string;
  firmado_at: string | null;
  error_detalle: string | null;
  created_at: string;
  updated_at: string;
}

export interface VpFactura {
  id: string;
  videoperitacion_id: string;
  factura_id: string;
  expediente_id: string;
  valoracion_id: string | null;
  informe_id: string | null;
  importe_valoracion: number | null;
  baremo_id: string | null;
  baremo_version: number | null;
  emitida_por: string;
  emitida_at: string;
  notas: string | null;
  created_at: string;
}

export interface VpEnvio {
  id: string;
  videoperitacion_id: string;
  expediente_id: string;
  documento_final_id: string | null;
  factura_id: string | null;
  canal: VpEnvioCanal;
  destinatario_email: string | null;
  destinatario_nombre: string | null;
  estado: VpEnvioEstado;
  intento_numero: number;
  enviado_at: string | null;
  error_detalle: string | null;
  acuse_at: string | null;
  acuse_detalle: string | null;
  enviado_por: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
