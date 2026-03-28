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
  tramitador_id: string | null;
  fecha_asignacion_tramitador: string | null;
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

export type CompaniaTipo = 'compania' | 'correduria' | 'administrador_fincas';

export type CompaniaSistema =
  | 'ADMINISTRADOR_FINCA' | 'ASITUR' | 'FAMAEX' | 'FUNCIONA' | 'GENERALI'
  | 'IMA' | 'RNET_EMAIL' | 'LAGUNARO' | 'LDWEB' | 'MULTIASISTENCIA_WS'
  | 'MUTUA' | 'NINGUNO' | 'PAP' | 'PELAYO' | 'SICI' | 'VERYFICA';

export interface CompaniaEspecialidad {
  id: string;
  compania_id: string;
  especialidad_id: string;
  dias_caducidad: number;
  dias_caducidad_confirmar: number;
  created_at: string;
  updated_at: string;
  especialidades?: {
    id: string;
    nombre: string;
    codigo: string | null;
    activa: boolean;
    orden: number;
  };
}

export interface Compania {
  id: string;
  nombre: string;
  codigo: string;
  cif?: string | null;
  activa: boolean;
  tipo: CompaniaTipo;
  sistema_integracion?: CompaniaSistema | null;
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
  user_id: string | null;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string | null;
  gremios: string[];
  zonas_cp: string[];
  activo: boolean;
  created_at: string;
  updated_at?: string;
  // Datos personales
  razon_social?: string | null;
  direccion?: string | null;
  poblacion?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  provincia?: string | null;
  telf2?: string | null;
  fax?: string | null;
  tipo_identificacion?: string | null;
  nif?: string | null;
  persona_contacto?: string | null;
  // Datos bancarios
  iban_1?: string | null;
  iban_2?: string | null;
  iban_3?: string | null;
  iban_4?: string | null;
  iban_5?: string | null;
  iban_6?: string | null;
  numero_entidad?: string | null;
  numero_oficina?: string | null;
  numero_control?: string | null;
  numero_cuenta?: string | null;
  cuenta_bancaria?: string | null;
  // Datos fiscales
  subcuenta_operario?: string | null;
  prefijo_autofactura?: string | null;
  tipo_operario?: string | null;
  nomina?: number | null;
  precio_hora?: number | null;
  // Config financiera
  irpf?: boolean;
  tipo_descuento?: string | null;
  descuento_negociado?: number | null;
  permitir_incrementos?: boolean;
  // Comunicaciones
  automatico_sms?: boolean;
  automatico_email?: boolean;
  opcion_finaliza_visita?: boolean;
  supervisor?: boolean;
  bloquear_fotos?: boolean;
  // APP móvil
  usa_app_movil?: boolean;
  ocultar_baremo_app?: boolean;
  ocultar_precio_baremo?: boolean;
  fichaje_activo?: boolean;
  horas_convenio_dia?: number | null;
  jornada_laboral?: string | null;
  plataforma_pas?: boolean;
  app_pwgs?: boolean;
  // Opciones generales
  preferente?: boolean;
  establecer_iva?: boolean;
  iva_operario?: number | null;
  puede_segunda_visita?: boolean;
  genera_presupuestos?: string | null;
  autoaprobado?: boolean;
  mostrar_datos_perito?: boolean;
  observaciones?: string | null;
  // Acceso intranet
  usuario_intranet?: string | null;
  contrasena_intranet?: string | null;
  email_aplicacion?: string | null;
  contrasena_email_app?: string | null;
  // Foto
  foto_path?: string | null;
  // Arrays
  tipos_servicio?: string[];
  // Estado especial
  bloqueado?: boolean;
  es_subcontratado?: boolean;
}

export interface OperarioEspecialidad {
  id: string;
  operario_id: string;
  especialidad_id: string;
  es_principal: boolean;
  created_at: string;
  especialidades?: {
    id: string;
    nombre: string;
    codigo: string | null;
    activa: boolean;
  };
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
  'ClienteSolicitaCambioCita',
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
  'AutocitaTokenEmitido',
  'AutocitaCitaConfirmada',
  'AutocitaCambioSolicitado',
  'AutocitaSlotSeleccionado',
  'AutocitaSlotNoDisponible',
  'AutocitaLimiteCambiosAlcanzado',
  'AutocitaTokenExpirado',
  // EP-12 Customer Tracking
  'CustomerTrackingLinkEmitido',
  'CustomerTrackingLinkRevocado',
  'CustomerTrackingEmailEnviado',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// ─── Geo Planning ───

export type GeoStatus = 'pending' | 'ok' | 'failed' | 'manual';
export type SlaStatus = 'ok' | 'urgente' | 'vencido' | 'sin_sla';

/** Expediente enriquecido para el mapa (view v_geo_expedientes) */
export interface GeoExpediente {
  id: string;
  numero_expediente: string;
  estado: ExpedienteEstado;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  fecha_encargo: string;
  fecha_limite_sla: string | null;
  operario_id: string | null;
  operario_nombre: string | null;
  compania_id: string;
  compania_nombre: string | null;
  tipo_siniestro: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  lat: number;
  lng: number;
  geo_status: GeoStatus;
  sla_status: SlaStatus;
  citas_hoy: number;
}

/** Operario enriquecido con carga del día para el mapa (view v_operario_carga) */
export interface GeoOperario {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  gremios: string[];
  zonas_cp: string[];
  activo: boolean;
  base_lat: number | null;
  base_lng: number | null;
  citas_hoy: number;
  citas_semana: number;
  ultima_cita_fecha: string | null;
  overloaded: boolean;
  carga_pct: number;
}

/** Punto para el mapa de calor */
export interface HeatPoint {
  cp: string;
  lat: number;
  lng: number;
  count: number;
  urgentes: number;
  intensity: number;
}

/** Sugerencia del Smart Dispatch */
export interface DispatchSuggestion {
  expediente_id: string;
  expediente_num: string;
  expediente_dir: string;
  operario_id: string;
  operario_nombre: string;
  distance_km: number;
  score: number;
  citas_hoy: number;
  conflicts: string[];
  reason: string;
}

/** Filtros activos del mapa */
export interface GeoMapFilters {
  estado: string[];
  prioridad: string[];
  operario_id: string;
  compania_id: string;
  gremio: string;
  fecha_ini: string;
  fecha_fin: string;
  solo_sin_asignar: boolean;
  solo_urgentes: boolean;
}

/** Posición en tiempo real de un operario */
export interface OperarioPosition {
  operario_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  recorded_at: string;
}

// ─── Eventos de dominio geo ───
export const GEO_EVENT_TYPES = [
  'GeoExpedienteGeocodificado',
  'GeoAsignacionCreada',
  'GeoAsignacionRechazada',
  'GeoSobrecargaDetectada',
  'GeoPosicionActualizada',
] as const;

export type GeoEventType = (typeof GEO_EVENT_TYPES)[number];

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

export interface SlaCalcResult {
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

// ─── Ep-13: Config. emisión ───

export const TIPO_DOCUMENTO_SERIE = [
  'factura', 'factura_simplificada', 'autofactura', 'abono', 'rectificativa',
] as const;
export type TipoDocumentoSerie = (typeof TIPO_DOCUMENTO_SERIE)[number];

export const TIPO_TERCERO_SERIE = [
  'compania', 'cliente_final', 'operario_autonomo', 'proveedor', 'grupo_empresa', 'cualquiera',
] as const;
export type TipoTerceroSerie = (typeof TIPO_TERCERO_SERIE)[number];

export const FLUJO_ORIGEN_SERIE = [
  'expediente', 'videoperitacion', 'manual', 'subcontrata', 'cualquiera',
] as const;
export type FlujoOrigenSerie = (typeof FLUJO_ORIGEN_SERIE)[number];

export const SISTEMA_FISCAL = ['ninguno', 'ticketbai', 'facturae', 'verifactu'] as const;
export type SistemaFiscal = (typeof SISTEMA_FISCAL)[number];

export interface ReglaNumeracion {
  id: string;
  empresa_facturadora_id: string | null;
  nombre: string;
  descripcion: string | null;
  separador_prefijo: string;
  separador_anio: string;
  incluir_anio: boolean;
  formato_anio: 'YYYY' | 'YY';
  longitud_contador: number;
  reset_anual: boolean;
  activa: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CuentaBancariaEmpresa {
  id: string;
  empresa_facturadora_id: string;
  iban: string;
  bic_swift: string | null;
  nombre_banco: string;
  titular: string;
  moneda: string;
  es_principal: boolean;
  activa: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SerieFacturacion {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
  empresa_facturadora_id: string;
  tipo: 'ordinaria' | 'rectificativa' | 'abono';
  tipo_documento: TipoDocumentoSerie;
  tipo_tercero: TipoTerceroSerie;
  flujo_origen: FlujoOrigenSerie;
  regla_numeracion_id: string | null;
  cuenta_bancaria_id: string | null;
  forma_pago_default: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  ejercicio_fiscal: string | null;
  contador_actual: number;
  activa: boolean;
  version: number;
  notas: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  regla_numeracion?: ReglaNumeracion;
  cuenta_bancaria?: CuentaBancariaEmpresa;
}

export interface AsignacionSerie {
  id: string;
  empresa_facturadora_id: string;
  serie_id: string;
  tipo_documento: TipoDocumentoSerie;
  tipo_tercero: Exclude<TipoTerceroSerie, 'cualquiera'> | null;
  flujo_origen: Exclude<FlujoOrigenSerie, 'cualquiera'> | null;
  compania_id: string | null;
  prioridad: number;
  activa: boolean;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  serie?: Pick<SerieFacturacion, 'id' | 'codigo' | 'nombre' | 'prefijo'>;
  compania?: { id: string; nombre: string } | null;
}

export interface ConfigEmisionEmpresa {
  id: string;
  empresa_facturadora_id: string;
  generar_pdf: boolean;
  firma_digital: boolean;
  sistema_fiscal: SistemaFiscal;
  envio_automatico: boolean;
  canal_envio_default: CanalEnvio;
  email_remitente: string | null;
  cc_contabilidad: string | null;
  dias_vencimiento: number;
  iva_porcentaje_default: number;
  recargo_equivalencia: number;
  cuenta_bancaria_id: string | null;
  plantilla_pdf: string;
  logo_storage_path: string | null;
  pie_factura: string | null;
  notas_legales: string | null;
  abono_referencia_obligatoria: boolean;
  autofactura_requiere_aceptacion: boolean;
  version: number;
  updated_by: string | null;
  updated_at: string;
  cuenta_bancaria?: CuentaBancariaEmpresa;
}

export interface SerieHistorialEntry {
  id: string;
  serie_id: string;
  version_numero: number;
  datos_anteriores: Partial<SerieFacturacion>;
  datos_nuevos: Partial<SerieFacturacion>;
  motivo_cambio: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface CreateSerieRequest {
  codigo: string;
  nombre: string;
  prefijo: string;
  empresa_facturadora_id: string;
  tipo_documento: TipoDocumentoSerie;
  tipo_tercero?: TipoTerceroSerie;
  flujo_origen?: FlujoOrigenSerie;
  regla_numeracion_id?: string;
  cuenta_bancaria_id?: string;
  forma_pago_default?: string;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  ejercicio_fiscal?: string;
  notas?: string;
}

export interface UpdateSerieRequest extends Partial<CreateSerieRequest> {
  version: number;
  motivo_cambio?: string;
}

export interface ResolverSerieRequest {
  empresa_facturadora_id: string;
  tipo_documento: TipoDocumentoSerie;
  tipo_tercero?: TipoTerceroSerie;
  flujo_origen?: FlujoOrigenSerie;
  compania_id?: string;
}

export interface ResolverSerieResult {
  serie: SerieFacturacion | null;
  asignacion_id?: string;
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
  tipo_identificacion: 'N.I.F.' | 'C.I.F.' | 'N.I.E.' | 'OTROS' | null;
  cif: string | null;
  telefono: string | null;
  fax: string | null;
  email: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  provincia: string | null;
  iban_1: string | null;
  iban_2: string | null;
  iban_3: string | null;
  iban_4: string | null;
  iban_5: string | null;
  iban_6: string | null;
  limite_dias: number | null;
  utiliza_panel: boolean;
  autofactura: boolean;
  id_operario: string | null;
  canal_preferido: 'email' | 'portal' | 'telefono' | 'manual';
  especialidades: string[];
  activo: boolean;
  notas: string | null;
  usuario: string | null;
  contrasena: string | null;
  email_app: string | null;
  contrasena_email_app: string | null;
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
  tipo_identificacion?: 'N.I.F.' | 'C.I.F.' | 'N.I.E.' | 'OTROS';
  cif?: string;
  telefono?: string;
  fax?: string;
  email?: string;
  direccion?: string;
  codigo_postal?: string;
  localidad?: string;
  provincia?: string;
  iban_1?: string;
  iban_2?: string;
  iban_3?: string;
  iban_4?: string;
  iban_5?: string;
  iban_6?: string;
  limite_dias?: number;
  utiliza_panel?: boolean;
  autofactura?: boolean;
  id_operario?: string;
  canal_preferido?: 'email' | 'portal' | 'telefono' | 'manual';
  especialidades?: string[];
  notas?: string;
  usuario?: string;
  contrasena?: string;
  email_app?: string;
  contrasena_email_app?: string;
}

// ─── Baremos Plantilla (gestión de tarifas: Cliente / Operario / Proveedor) ───

export type BaremoTipo = 'Cliente' | 'Operario' | 'Proveedor';

export interface BaremoPlantilla {
  id: string;
  nombre: string;
  tipo: BaremoTipo;
  fecha_inicio: string; // ISO date YYYY-MM-DD
  fecha_fin: string;    // ISO date YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface BaremoPlantillaTrabajo {
  id: string;
  baremo_id: string;
  codigo: string | null;
  codigo_relacion: string | null;
  nombre: string;
  precio_cliente: number | null;   // solo tipo Cliente
  precio_operario: number;
  precio_libre: boolean;
  solo_operario: boolean;          // solo tipo Cliente
  cantidad_fija: number;
  especialidad_id: string | null;
  created_at: string;
  especialidades?: { id: string; nombre: string } | null;
}

export interface BaremoPlantillaProveedor {
  id: string;
  baremo_id: string;
  proveedor_id: string;
  created_at: string;
  proveedores?: { id: string; nombre: string } | null;
}

export interface CreateBaremoPlantillaRequest {
  nombre: string;
  tipo: BaremoTipo;
  fecha_inicio: string;
  fecha_fin: string;
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

// EP-12: Customer tracking

export interface CustomerTrackingIssueLinkRequest {
  expediente_id: string;
  ttl_hours?: number;
  max_uses?: number;
}

export interface CustomerTrackingIssueLinkResponse {
  expediente_id: string;
  token: string;
  path: string;
  /** URL completa del portal cliente, construida con CONFIRM_BASE_URL. */
  tracking_url: string;
  expires_at: string;
  revoked_previous_count: number;
  /** true si el email se intentó y fue aceptado (incluye dry_run). */
  email_sent: boolean;
  /** Estado del intento de envío. no_email = el asegurado no tiene email. */
  email_status: 'sent' | 'dry_run' | 'failed' | 'no_email';
}

export interface CustomerTrackingConfirmCitaResponse {
  cita_id: string;
  estado: string;
  customer_confirmed_at: string;
}

export interface CustomerTrackingSolicitarCambioRequest {
  franja_solicitada: string;
  motivo: string;
}

export interface CustomerTrackingSolicitarCambioResponse {
  cita_id: string;
  estado: string;
  customer_reschedule_requested_at: string;
  customer_reschedule_status: string;
}

export interface CustomerTrackingTimelineItem {
  id: string;
  type: 'estado' | 'cita' | 'accion_cliente';
  title: string;
  detail: string | null;
  created_at: string;
}

export interface CustomerTrackingContact {
  label: string;
  telefono: string | null;
  email: string | null;
}

export interface CustomerTrackingView {
  expediente: {
    id: string;
    numero_expediente: string;
    estado: string;
    estado_label: string;
    estado_resumen: string;
    tipo_siniestro: string;
    updated_at: string;
  };
  cita: {
    id: string;
    fecha: string;
    franja_inicio: string;
    franja_fin: string;
    estado: string;
    estado_label: string;
    tecnico: {
      identificacion: string | null;
    } | null;
    customer_confirmed_at: string | null;
    customer_reschedule_requested_at: string | null;
    customer_reschedule_requested_slot: string | null;
    customer_reschedule_status: string | null;
    can_confirm: boolean;
    can_request_change: boolean;
  } | null;
  contacto: CustomerTrackingContact | null;
  timeline: CustomerTrackingTimelineItem[];
}

// ═══════════════════════════════════════════════════════════════
//  MÓDULO: CALENDARIO OPERATIVO
// ═══════════════════════════════════════════════════════════════

export type CalAmbito =
  | 'nacional'
  | 'autonomico'
  | 'provincial'
  | 'local'
  | 'empresa';

export type CalAusenciaTipo =
  | 'vacacion'
  | 'baja_medica'
  | 'baja_laboral'
  | 'asunto_personal'
  | 'permiso_retribuido'
  | 'bloqueo';

export type CalAusenciaEstado =
  | 'solicitada'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada';

export type CalGuardiaTipo =
  | 'guardia'
  | 'reten'
  | 'turno_especial'
  | 'disponibilidad_ampliada';

export type CalExcepcionTipo =
  | 'cita_en_festivo'
  | 'cita_en_ausencia'
  | 'fuera_horario'
  | 'cita_en_bloqueo';

export type CalTipoEvento = 'festivo' | 'ausencia' | 'guardia';

// ─── Entidades ───────────────────────────────────────────────────────────────

export interface CalFestivo {
  id: string;
  fecha: string;                   // YYYY-MM-DD
  nombre: string;
  ambito: CalAmbito;
  comunidad_autonoma?: string | null;
  provincia?: string | null;
  municipio?: string | null;
  empresa_id?: string | null;
  activo: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface CalAusencia {
  id: string;
  operario_id: string;
  tipo: CalAusenciaTipo;
  fecha_inicio: string;            // YYYY-MM-DD
  fecha_fin: string;               // YYYY-MM-DD
  motivo?: string | null;
  estado: CalAusenciaEstado;
  aprobada_por?: string | null;
  aprobada_at?: string | null;
  motivo_rechazo?: string | null;
  citas_afectadas_count: number;
  sla_pausado: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // join
  operarios?: { nombre: string; apellidos: string } | null;
}

export interface CalGuardia {
  id: string;
  operario_id: string;
  tipo: CalGuardiaTipo;
  fecha_inicio: string;            // ISO timestamp
  fecha_fin: string;               // ISO timestamp
  zona_cp?: string[] | null;
  especialidades?: string[] | null;
  observaciones?: string | null;
  activa: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // join
  operarios?: { nombre: string; apellidos: string } | null;
}

export interface CalReglaDisponibilidad {
  id: string;
  empresa_id?: string | null;
  zona_cp?: string | null;
  especialidad?: string | null;
  dias_semana: number[];           // 0=domingo, 1=lunes … 6=sábado
  hora_inicio: string;             // HH:MM
  hora_fin: string;                // HH:MM
  vigente_desde: string;           // YYYY-MM-DD
  vigente_hasta?: string | null;   // YYYY-MM-DD
  activa: boolean;
  descripcion?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CalExcepcion {
  id: string;
  tipo_excepcion: CalExcepcionTipo;
  referencia_id?: string | null;
  referencia_tabla?: string | null;
  justificacion: string;
  aprobada_por?: string | null;
  aprobada_at?: string | null;
  created_by: string;
  created_at: string;
}

// ─── Resultado de disponibilidad ────────────────────────────────────────────

export interface DisponibilidadBloqueMotivo {
  tipo: 'festivo' | 'ausencia' | 'fuera_horario' | 'guardia_otro';
  descripcion: string;
  referencia_id?: string | null;
}

export interface DisponibilidadCheck {
  disponible: boolean;
  motivos_bloqueo: DisponibilidadBloqueMotivo[];
  tiene_guardia: boolean;
  ausencia_activa?: CalAusencia | null;
}

// ─── Evento unificado (vista v_calendario_operativo) ────────────────────────

export interface CalEventoUnificado {
  tipo_evento: CalTipoEvento;
  id: string;
  operario_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  titulo: string;
  subtipo: string;
  empresa_id: string | null;
  metadata: Record<string, unknown>;
}

// ─── Requests ────────────────────────────────────────────────────────────────

export interface CreateCalFestivoRequest {
  fecha: string;
  nombre: string;
  ambito: CalAmbito;
  comunidad_autonoma?: string;
  provincia?: string;
  municipio?: string;
  empresa_id?: string;
}

export interface CreateCalAusenciaRequest {
  operario_id: string;
  tipo: CalAusenciaTipo;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string;
}

export interface UpdateCalAusenciaRequest {
  fecha_inicio?: string;
  fecha_fin?: string;
  motivo?: string;
  estado?: CalAusenciaEstado;
}

export interface CreateCalGuardiaRequest {
  operario_id: string;
  tipo: CalGuardiaTipo;
  fecha_inicio: string;
  fecha_fin: string;
  zona_cp?: string[];
  especialidades?: string[];
  observaciones?: string;
}

export interface CreateCalReglaRequest {
  empresa_id?: string;
  zona_cp?: string;
  especialidad?: string;
  dias_semana?: number[];
  hora_inicio?: string;
  hora_fin?: string;
  vigente_desde?: string;
  vigente_hasta?: string;
  descripcion?: string;
}

export interface AprobarAusenciaRequest {
  ausencia_id: string;
}

export interface RechazarAusenciaRequest {
  ausencia_id: string;
  motivo_rechazo: string;
}

// ─── MÓDULO AUTOCITA ────────────────────────────────────────────────────────

export type AutocitaTokenScope = 'confirmar' | 'seleccionar' | 'ambos';
export type AutocitaTokenEstado = 'pendiente' | 'usado' | 'expirado' | 'revocado';
export type AutocitaAccion = 'confirmacion_propuesta' | 'seleccion_hueco' | 'cambio_solicitado' | 'slot_no_disponible';

export interface AutocitaSlot {
  id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  alerta_sla: boolean;
}

export interface AutocitaConfig {
  max_slots_mostrados: number;
  dias_max_seleccion: number;
  margen_aviso_h: number;
  buffer_sla_h: number;
  permite_seleccion_libre: boolean;
  max_cambios_por_expediente: number;
}

export interface AutocitaView {
  expediente: {
    numero_expediente: string;
    estado_label: string;
    tipo_siniestro: string;
  };
  cita_propuesta: {
    cita_id: string;
    fecha: string;
    franja_inicio: string;
    franja_fin: string;
    estado: string;
    tecnico: string | null;
    can_confirm: boolean;
    can_request_change: boolean;
    cambios_restantes: number;
  } | null;
  sla: {
    estado: string;
    fecha_limite: string | null;
  } | null;
  scope: AutocitaTokenScope;
}

// ─── Autocita — API requests / responses ────────────────────────────────────

export interface AutocitaIssueLinkRequest {
  expediente_id: string;
  scope?: AutocitaTokenScope;
  ttl_hours?: number;
  max_uses?: number;
}

export interface AutocitaIssueLinkResponse {
  expediente_id: string;
  token: string;
  path: string;
  scope: AutocitaTokenScope;
  expires_at: string;
}

export interface AutocitaSlotsResponse {
  slots: AutocitaSlot[];
  total: number;
  cambios_restantes: number;
  mensaje_sin_huecos: string | null;
}

export interface AutocitaConfirmarResponse {
  cita_id: string;
  confirmada: boolean;
  confirmed_at: string;
}

export interface AutocitaSeleccionarRequest {
  slot_id: string;
}

export interface AutocitaSeleccionarResponse {
  cita_id: string;
  nueva_fecha: string;
  nueva_franja_inicio: string;
  nueva_franja_fin: string;
  confirmacion_automatica: boolean;
}

// ─── UCT: Usuarios y Cargas de Trabajo ───

export type TramitadorNivel = 'tramitador' | 'facturacion' | 'redes' | 'administrador' | 'super_administrador';
export type TramitadorSemaforo = 'verde' | 'amarillo' | 'rojo';
export type HistorialAsignacionTipo =
  | 'asignacion_inicial'
  | 'reasignacion_manual'
  | 'reasignacion_automatica'
  | 'reasignacion_masiva'
  | 'desasignacion';
export type ReglaRepartoTipo = 'manual' | 'round_robin' | 'weighted' | 'rule_based' | 'sla_priority';
export type AlertaCargaTipo = 'umbral_carga' | 'carga_maxima' | 'sla_vencidos' | 'sin_tramitador' | 'expedientes_bloqueados';
export type AlertaSeveridad = 'info' | 'warning' | 'critical';

export interface Tramitador {
  id: string;
  user_id: string;
  empresa_facturadora_id: string | null;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  nivel: TramitadorNivel;
  max_expedientes_activos: number;
  max_urgentes: number;
  max_por_compania: number | null;
  umbral_alerta_pct: number;
  especialidades_siniestro: string[];
  companias_preferentes: string[];
  zonas_cp: string[];
  activo: boolean;
  fecha_alta: string;
  fecha_baja: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CargaTramitador {
  tramitador_id: string;
  nombre_completo: string;
  nombre: string;
  apellidos: string;
  empresa_facturadora_id: string | null;
  activo: boolean;
  nivel: TramitadorNivel;
  max_expedientes_activos: number;
  max_urgentes: number;
  umbral_alerta_pct: number;
  total_activos: number;
  total_urgentes: number;
  total_sla_vencidos: number;
  total_sin_cita: number;
  total_bloqueados: number;
  porcentaje_carga: number;
  semaforo: TramitadorSemaforo;
  last_refresh: string;
}

export interface HistorialAsignacion {
  id: string;
  expediente_id: string;
  tramitador_anterior_id: string | null;
  tramitador_nuevo_id: string | null;
  tipo: HistorialAsignacionTipo;
  motivo: string | null;
  motivo_codigo: string | null;
  actor_id: string | null;
  actor_tipo: 'usuario' | 'sistema';
  batch_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReglaReparto {
  id: string;
  empresa_facturadora_id: string | null;
  nombre: string;
  descripcion: string | null;
  tipo: ReglaRepartoTipo;
  activa: boolean;
  prioridad_orden: number;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertaCarga {
  id: string;
  tramitador_id: string | null;
  tipo: AlertaCargaTipo;
  severidad: AlertaSeveridad;
  mensaje: string;
  valor_umbral: number | null;
  valor_actual: number | null;
  resuelta: boolean;
  resuelta_at: string | null;
  resuelta_por: string | null;
  created_at: string;
}

export interface TramitadorReglaPreasignacion {
  id: string;
  tramitador_id: string;
  empresa_facturadora_id: string | null;
  compania_id: string | null;
  tipo_siniestro: string | null;
  zona_cp_patron: string | null;
  prioridad: string | null;
  peso: number;
  activa: boolean;
  descripcion: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO SINIESTROS — tipos para las vistas operativas Activos / Finalizados /
// Seguimiento. Estos tipos son la vista desnormalizada que devuelve la API para
// renderizar las tablas y la ficha de seguimiento del expediente.
// ─────────────────────────────────────────────────────────────────────────────

export const ESTADOS_ACTIVOS = [
  'NUEVO', 'NO_ASIGNADO', 'EN_PLANIFICACION', 'EN_CURSO',
  'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE',
] as const;

export const ESTADOS_FINALIZADOS = [
  'FINALIZADO', 'FACTURADO', 'COBRADO', 'CERRADO',
] as const;

export const TIPOS_DANO = [
  'AGUA', 'ELECTRICIDAD', 'INCENDIO', 'MANTENIMIENTO',
  'ROTURA LOZA SANITARIA', 'MARMOL/CRISTALES', 'CONEXION',
  'ASISTENCIA', 'PISOS TURISTICOS', 'RESTO',
  'VIDEOPERITACION', 'Servicio Prestación',
  'ACTIVOS ADECUACIONES', 'ACTIVOS INCIDENTAL',
] as const;

export type TipoDano = (typeof TIPOS_DANO)[number];

// ── Filtros de búsqueda ───────────────────────────────────────────────────────

export interface SiniestrosActivosFilters {
  search?: string;
  tipo?: string;           // filtro tipos (Calidad, FRAUDE, +30 dias, etc.)
  urgente?: boolean;
  vip?: boolean;
  tipo_dano?: string;
  estado?: string;         // estado FSM o sub-estado
  tramitador_id?: string;
  operario_id?: string;
  page?: number;
  per_page?: number;
}

export interface SiniestrosFinalizadosFilters extends SiniestrosActivosFilters {
  pendientes_cobrar?: boolean;
  tipo_factura?: 'Factura' | 'Abono' | 'Albarán' | 'Presupuesto';
  serie_factura?: string;
  numero_factura?: string;
  anyo_factura?: string;
  importe_desde?: number;
  importe_hasta?: number;
  facturas_enviadas?: boolean;
  facturas_cobradas?: boolean;
}

// ── Fila en la tabla de activos ───────────────────────────────────────────────

export interface SiniestroActivoRow {
  id: string;
  numero_expediente: string;
  codigo_externo: string | null;
  compania: { id: string; nombre: string; codigo: string };
  estado: ExpedienteEstado;
  tramitador: { id: string; nombre: string; apellidos: string } | null;
  tipo_dano: string;
  etiquetas: string[];
  urgente: boolean;
  vip: boolean;
  pausado: boolean;
  fecha_alta_asegurado: string | null;
  dias_apertura: number;
  fecha_espera: string | null;
  fecha_espera_vencida: boolean;
  dias_sin_actualizar: number;
  asegurado: { nombre: string; apellidos: string };
  operario: { id: string; nombre: string; apellidos: string } | null;
  perito_asignado: boolean;
  tiene_trabajos: boolean;
  tiene_trabajos_reclamados: boolean;
  tiene_presupuesto: boolean;
  tiene_factura: boolean;
}

// ── Fila en la tabla de finalizados (extiende activos + datos financieros) ────

export interface SiniestroFacturaRow {
  id: string;
  numero_factura: string;
  tipo: 'Factura' | 'Abono' | 'Albarán' | 'Presupuesto';
  base_imponible: number;
  iva: number;
  total: number;
  enviada: boolean;
  fecha_autorizacion: string | null;
  cobrada: boolean;
  fecha_emision: string | null;
  fecha_factura: string | null;
}

export interface SiniestroFinalizadoRow extends SiniestroActivoRow {
  fecha_emision_factura: string | null;
  fecha_factura: string | null;
  facturas: SiniestroFacturaRow[];
}

// ── Paginación genérica de listas ─────────────────────────────────────────────

export interface SiniestrosListResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export type SiniestrosActivosResult = SiniestrosListResult<SiniestroActivoRow>;
export type SiniestrosFinalizadosResult = SiniestrosListResult<SiniestroFinalizadoRow>;

// ── Estadísticas por estado (para contadores en filtro desplegable) ────────────

export interface SiniestroEstadoCounter {
  estado: string;
  total: number;
}

// ── Detalle completo para la ficha de seguimiento ────────────────────────────

export interface SeguimientoAsegurado {
  id: string;
  nombre: string;
  apellidos: string;
  // Teléfono 1
  telefono: string | null;
  telefono_desc: string | null;
  telefono_movil?: boolean;
  // Teléfono 2
  telefono2: string | null;
  telefono2_desc: string | null;
  telefono2_movil?: boolean;
  // Teléfono 3 (B1-S5)
  telefono3?: string | null;
  telefono3_desc?: string | null;
  telefono3_movil?: boolean;
  // Prioridad: 1=Tel1, 2=Tel2, 3=Tel3
  telefono_prioridad?: number;
  // Email
  email: string | null;
  // Consentimiento
  consentimiento_com: 'acepta' | 'rechaza' | null;
  consentimiento_tipo?: 'sms' | 'email' | 'ambos' | null;
  // Datos personales
  nif: string | null;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

export interface SeguimientoVisita {
  id: string;
  fecha_hora: string;
  estado: string;
  notas: string | null;
  /** G2: Datos adicionales por visita (campo libre) */
  campo_2?: string | null;
  operario: {
    id: string;
    nombre: string;
    apellidos: string;
    telefono: string;
  } | null;
  fotos_antes: Array<{ id: string; archivo: string; descripcion: string | null }>;
  fotos_despues: Array<{ id: string; archivo: string; descripcion: string | null }>;
}

export interface SeguimientoPedido {
  id: string;
  numero_pedido: string | null;
  proveedor: { id: string; nombre: string } | null;
  descripcion: string;
  fecha_creacion: string;
  fecha_limite: string | null;
  estado: string;
}

export interface SeguimientoIncidencia {
  id: string;
  fecha: string;
  origen: string | null;
  tipologia: string | null;
  texto: string;
  nivel_rga: string | null;
  imputada_a: string | null;
  procedente: boolean;
  creado_por: string | null;
  created_at: string;
  // B3 extended fields
  tipo_incidencia?: string | null;
  plataforma_usuario_nombre?: string | null;
  interna?: boolean;
  proc_incidencia?: string | null;
}

export interface SeguimientoComunicacion {
  id: string;
  tipo: 'sms' | 'email' | 'llamada' | 'nota';
  destinatario: string | null;
  contenido: string;
  fecha_envio: string;
}

export interface SeguimientoDocumento {
  id: string;
  tipo_documento: string;
  archivo: string;
  descripcion: string | null;
  fecha_subida: string;
  signed_url?: string;
}

export interface SeguimientoPresupuesto {
  id: string;
  numero: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  importe: number;
  fecha_creacion: string;
}

export interface SeguimientoExpediente {
  // ── Core ──────────────────────────────────────────────────────────────────
  id: string;
  numero_expediente: string;
  codigo_externo: string | null;
  tipo_dano: string;
  /** G1: Especialidad del siniestro (carpintería, fontanería, etc.) */
  especialidad?: string | null;
  estado: ExpedienteEstado;
  /** Estado operacional del tramitador, independiente del FSM estado (B1-S3) */
  pendiente_de?: string | null;
  etiquetas: string[];
  pausado: boolean;
  urgente: boolean;
  vip: boolean;
  fecha_espera: string | null;
  fecha_alta_asegurado: string | null;
  notas: string | null;
  origen: string | null;
  descripcion: string;
  // ── Personas ──────────────────────────────────────────────────────────────
  compania: { id: string; nombre: string; codigo: string };
  asegurado: SeguimientoAsegurado;
  tramitador: { id: string; nombre: string; apellidos: string } | null;
  operario: {
    id: string;
    nombre: string;
    apellidos: string;
    telefono: string;
  } | null;
  perito: { id: string; nombre: string } | null;
  // ── B1-S3: Tipos de compañía y eventos ────────────────────────────────────
  tipos_compania?: TipoCompania[];
  eventos?: EventoCompania[];
  // ── B1-S1: Presencia / bloqueo ────────────────────────────────────────────
  presencia?: ExpedientePresencia | null;
  // ── Secciones operativas ──────────────────────────────────────────────────
  visitas: SeguimientoVisita[];
  pedidos: SeguimientoPedido[];
  incidencias: SeguimientoIncidencia[];
  comunicaciones: SeguimientoComunicacion[];
  documentos: SeguimientoDocumento[];
  presupuestos: SeguimientoPresupuesto[];
  facturas: SiniestroFacturaRow[];
  // ── B2: Bloque 2 (opcionales para retrocompatibilidad) ────────────────────
  /** Trabajos con estado No iniciado / Subsanado (S8.4) */
  trabajos?: TrabajoExpediente[];
  /** Notas de tramitadores (S10) */
  notas_tramitador?: NotaInterna[];
  /** Notas de operarios (S10) */
  notas_operario?: NotaInterna[];
  /** Comunicaciones con la aseguradora / ASITUR (S9) */
  comunicaciones_asitur?: ComunicacionAsitur[];
  // ── B3: Bloque 3 (opcionales) ────────────────────────────────────────────
  /** Campos adicionales para informe fotográfico (S13) */
  campos_adicionales?: CamposAdicionalesExpediente | null;
}

// ── Requests de mutación ──────────────────────────────────────────────────────

export interface UpdateSiniestroRequest {
  tipo_dano?: string;
  /** G1: Especialidad del siniestro */
  especialidad?: string | null;
  estado?: ExpedienteEstado;
  tramitador_id?: string | null;
  operario_id?: string | null;
  pausado?: boolean;
  urgente?: boolean;
  vip?: boolean;
  fecha_espera?: string | null;
  notas?: string | null;
  etiquetas?: string[];
}

export interface CreateIncidenciaRequest {
  expediente_id: string;
  fecha?: string;
  origen?: string;
  tipologia?: string;
  texto: string;
  nivel_rga?: string;
  imputada_a?: string;
  procedente?: boolean;
  // B3 extended fields
  tipo_incidencia?: string | null;
  plataforma_usuario_nombre?: string | null;
  interna?: boolean;
  proc_incidencia?: string | null;
}

export interface UpdateFacturaSiniestroRequest {
  factura_id: string;
  enviada?: boolean;
  cobrada?: boolean;
  fecha_autorizacion?: string | null;
}

// ═══════════════════════════════════════════════════════════════
//  MÓDULO SEGUIMIENTO — BLOQUE 1 (Secciones 1-5)
// ═══════════════════════════════════════════════════════════════

// ── S3: Opciones "Expediente pendiente de" (operacional, ≠ FSM estado) ────────
export const PENDIENTE_DE_OPTIONS = [
  // Estados de gestión
  '1ª cita',
  'Asegurado',
  'Asegurado 1º contacto',
  'ASIGNACION ANDALUCIA',
  'ASIGNACIÓN VALENCIA',
  'Autovisita Albañilería 1h',
  'Autovisita Albañilería 2h',
  'Autovisita Fontanería 90 min',
  'Autovisita Pintura 1h',
  'Autovisita Pintura 2h',
  'Bricos',
  'Compañía',
  'Compañía Caser para cerrar',
  'Compañía Multiasistencia para Cerrar',
  'Confirmar cita',
  'Control de cita',
  'Encuesta de Calidad',
  'Factura IPAS',
  'Finalizado',
  'Gestión factura',
  'Gremio externo',
  'Ingreso',
  'Localizador Fugas',
  'Materiales',
  'Otra reparación',
  'Perito',
  'Perjudicado',
  'Presupuesto',
  'Reclamación',
  'Resp. Técnico',
  'Revisión tras visita',
  'Técnico',
  'Trabajos verticales',
  'Valoración',
  'Visita revisada',
  // Especialidades técnicas
  '72h SEGURCAIXA',
  'Activos inmobiliarios',
  'Albañilería',
  'ASIGNACION HACER RUTA',
  'ASIGNAR CITA ALBAÑILERIA',
  'ASIGNAR CITA PINTURA',
  'Caducados',
  'CAMARA TERMOGRAFICA',
  'Carpintería',
  'Cerrajería',
  'Cristalería',
  'Electricidad',
  'Fontanería',
  'Gestión de cobro',
  'Limpieza',
  'Marmolería',
  'Otros',
  'Persianas',
  'Pintura',
  'Pladur',
  'Revisión operario',
  'Revisión tramitación',
  'Saneamiento',
  'Sellado bañera',
  'Solador',
  'Tapicería',
  'Trabajos verticales',
  'Valorar daños',
  'Videoperitacion',
] as const;

export type PendienteDeOption = (typeof PENDIENTE_DE_OPTIONS)[number];

// ── S1: Presencia / Bloqueo colaborativo ──────────────────────────────────────

export interface ExpedientePresencia {
  user_id: string;
  user_nombre: string;
  locked_at: string;
  last_heartbeat: string;
  /** true si el bloqueo es del usuario actual */
  es_propio?: boolean;
  /** true si el heartbeat tiene más de 2 minutos (bloqueo expirado) */
  expirado?: boolean;
}

// ── S3: Tipos de compañía dinámicos ───────────────────────────────────────────

export interface TipoCompania {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
  /** true si este tipo está activo para el expediente actual */
  seleccionado?: boolean;
}

// ── S3: Eventos ejecutables ────────────────────────────────────────────────────

export interface EventoCompania {
  id: string;
  nombre: string;
  tipo_evento: 'autovisita' | 'notificacion' | 'cambio_estado' | 'cambio_pendiente_de' | 'tarea';
  configuracion: Record<string, unknown>;
  orden: number;
}

// ── S5: Texto predefinido SMS/email ───────────────────────────────────────────

export interface TextoPredefinido {
  id: string;
  tipo: 'sms' | 'email';
  nombre: string;
  asunto: string | null;
  cuerpo: string;
}

// ── Extensiones de SeguimientoAsegurado (Bloque 1) ────────────────────────────
// Se añaden campos opcionales para no romper el contrato existente.

export interface SeguimientoAseguradoComunicaciones {
  id: string;
  nombre: string;
  apellidos: string;
  nif: string | null;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  // Teléfono 1
  telefono: string | null;
  telefono_desc: string | null;
  telefono_movil: boolean;
  // Teléfono 2
  telefono2: string | null;
  telefono2_desc: string | null;
  telefono2_movil: boolean;
  // Teléfono 3 (nuevo)
  telefono3: string | null;
  telefono3_desc: string | null;
  telefono3_movil: boolean;
  // Prioridad de contacto: 1=Tel1, 2=Tel2, 3=Tel3
  telefono_prioridad: number;
  // Email
  email: string | null;
  // Consentimiento
  consentimiento_com: 'acepta' | 'rechaza' | null;
  consentimiento_tipo: 'sms' | 'email' | 'ambos' | null;
}

// ── SeguimientoExpediente extendido (Bloque 1) ────────────────────────────────

export interface SeguimientoExpedienteB1 extends SeguimientoExpediente {
  /** Estado operacional del tramitador (≠ FSM estado) */
  pendiente_de: string | null;
  /** Tipos de compañía disponibles y cuáles están activos para este expediente */
  tipos_compania: TipoCompania[];
  /** Eventos ejecutables configurados para la compañía de este expediente */
  eventos: EventoCompania[];
  /** Presencia actual (quién tiene el expediente abierto) */
  presencia: ExpedientePresencia | null;
  /** Asegurado con campos extendidos de comunicaciones */
  asegurado: SeguimientoAseguradoComunicaciones;
}

// ── Requests nuevos ───────────────────────────────────────────────────────────

export interface UpdatePendienteDeRequest {
  pendiente_de: string | null;
}

export interface UpdateTiposCompaniaRequest {
  /** IDs de tipos_compania activos para este expediente */
  tipo_ids: string[];
}

export interface EjecutarEventoRequest {
  expediente_id: string;
  evento_id: string;
}

export interface EnviarSmsRequest {
  telefono: string;
  texto: string;
  texto_predefinido_id?: string;
}

export interface EnviarEmailRequest {
  email: string;
  asunto: string;
  cuerpo: string;
  texto_predefinido_id?: string;
}

export interface EnviarPanelClienteRequest {
  /** 'sms' | 'email' */
  canal: 'sms' | 'email';
  /** teléfono si canal=sms */
  telefono?: string;
  /** email si canal=email */
  email?: string;
}

export interface UpdateComunicacionesAseguradoRequest {
  asegurado_id: string;
  consentimiento_com?: 'acepta' | 'rechaza';
  consentimiento_tipo?: 'sms' | 'email' | 'ambos';
  telefono?: string;
  telefono_desc?: string;
  telefono_movil?: boolean;
  telefono_prioridad?: number;
  telefono2?: string;
  telefono2_desc?: string;
  telefono2_movil?: boolean;
  telefono3?: string;
  telefono3_desc?: string;
  telefono3_movil?: boolean;
  email?: string;
}

// ═══════════════════════════════════════════════════════════════
//  MÓDULO SEGUIMIENTO — BLOQUE 2 (Secciones 6-10)
// ═══════════════════════════════════════════════════════════════

// ── S8.4: Trabajos por expediente ─────────────────────────────────────────────

export interface TrabajoExpediente {
  id: string;
  expediente_id: string;
  operario_id: string | null;
  operario_nombre: string | null;
  especialidad: string | null;
  descripcion: string;
  estado: 'No iniciado' | 'Subsanado';
  fecha_asignacion: string | null;
  fecha_cita: string | null;
  fecha_finalizacion: string | null;
  orden: number;
  created_at: string;
}

// ── S9: Comunicaciones ASITUR / INTERPWGS ─────────────────────────────────────

export const TIPOS_MENSAJE_ASITUR = [
  { value: 'INFOGENERALENVIAR',                label: 'INFO ENVIADO' },
  { value: 'INFOGENERALRECIBIR',               label: 'INFO RECIBIDO' },
  { value: 'Relato',                           label: 'Relato' },
  { value: 'Peticion_intervencion_perito',     label: 'Petición intervención de perito' },
  { value: 'Peticion_intervencion_proveedor',  label: 'Petición intervención de otro proveedor' },
  { value: 'Solicitud_instrucciones_cobertura',label: 'Solicitud instrucciones de cobertura' },
  { value: 'Recibidas_instrucciones_periciales', label: 'Recibidas instrucciones periciales' },
  { value: 'Recibidas_instrucciones_asegurado',  label: 'Recibidas instrucciones asegurado' },
  { value: 'Informacion_solicitada_ASITUR',    label: 'Información solicitada por ASITUR' },
  { value: 'Solicitud_instrucciones_ASITUR',   label: 'Solicitud de instrucciones a ASITUR' },
  { value: 'Enviar_presupuesto',               label: 'Enviar presupuesto/valoración de daños' },
  { value: 'TERMINAR',                         label: 'TERMINAR' },
] as const;

export type TipoMensajeAsitur = (typeof TIPOS_MENSAJE_ASITUR)[number]['value'];

export interface ComunicacionAsitur {
  id: string;
  expediente_id: string;
  tipo_mensaje: TipoMensajeAsitur;
  contenido: string;
  adjunto_path: string | null;
  adjunto_nombre: string | null;
  direccion: 'entrante' | 'saliente';
  actor_nombre: string;
  leido: boolean;
  created_at: string;
}

// ── S10: Notas internas ───────────────────────────────────────────────────────

export interface NotaInterna {
  id: string;
  expediente_id: string;
  tipo: 'tramitador' | 'operario';
  texto: string;
  autor_id: string | null;
  autor_nombre: string;
  alarma_fecha: string | null;
  alarma_usuario_nombre: string | null;
  alarma_tipo: string | null;
  alarma_estado: 'Activada' | 'Desactivada';
  realizado: boolean;
  created_at: string;
}

// ── Extensión SeguimientoExpediente con datos Bloque 2 ────────────────────────

export interface SeguimientoExpedienteB2 extends SeguimientoExpediente {
  /** Estado operacional del tramitador (≠ FSM estado) — heredado B1 */
  pendiente_de: string | null;
  tipos_compania: TipoCompania[];
  eventos: EventoCompania[];
  presencia: ExpedientePresencia | null;
  asegurado: SeguimientoAseguradoComunicaciones;
  /** Trabajos por expediente con estados No iniciado / Subsanado (S8.4) */
  trabajos: TrabajoExpediente[];
  /** Notas de tramitadores (S10) */
  notas_tramitador: NotaInterna[];
  /** Notas de operarios (S10) */
  notas_operario: NotaInterna[];
  /** Comunicaciones ASITUR (S9) */
  comunicaciones_asitur: ComunicacionAsitur[];
}

// ── Requests Bloque 2 ─────────────────────────────────────────────────────────

export interface CreatePedidoExpedienteRequest {
  /** expediente_id se pasa via URL en el endpoint, no en el body */
  proveedor_id: string;
  descripcion: string;
  fecha_limite?: string | null;
}

export interface UpdatePedidoExpedienteRequest {
  estado?: string;
  fecha_limite?: string | null;
}

export interface CreateTrabajoRequest {
  operario_id?: string | null;
  operario_nombre?: string | null;
  especialidad?: string | null;
  descripcion: string;
  fecha_asignacion?: string | null;
  fecha_cita?: string | null;
  orden?: number;
}

export interface UpdateTrabajoEstadoRequest {
  estado: 'No iniciado' | 'Subsanado';
}

export interface CreateNotaRequest {
  tipo: 'tramitador' | 'operario';
  texto: string;
  alarma_fecha?: string | null;
  alarma_usuario_id?: string | null;
  alarma_usuario_nombre?: string | null;
  alarma_tipo?: string | null;
}

export interface EnviarMensajeAsiturRequest {
  tipo_mensaje: TipoMensajeAsitur;
  contenido: string;
  /** File object para adjunto — manejado en el hook con FormData */
  adjunto_nombre?: string | null;
  adjunto_path?: string | null;
}

export interface MarcarNotaRealizadaRequest {
  realizado: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  MÓDULO SEGUIMIENTO — BLOQUE 3 (Secciones 11-15)
// ═══════════════════════════════════════════════════════════════

// ── S11: Catálogos de incidencias ─────────────────────────────────────────────

export const TIPO_INCIDENCIA_OPTIONS = [
  { value: 'Operario',   label: 'Incidencia operario' },
  { value: 'Tramitador', label: 'Incidencia tramitador' },
  { value: 'Compañía',   label: 'Incidencia recibida de compañía' },
] as const;

export const TIPOLOGIA_INCIDENCIA_OPTIONS = [
  'Fotografías',
  'Trabajos mal ejecutados',
  'Comportamiento incorrecto',
  'Retraso en ejecución',
  'Retraso factura',
  'Daños a terceros',
  'Impagos a proveedores',
  'Material incorrecto',
  'Presupuesto',
  'Quejas',
  'Reclamación',
  'Otros',
] as const;

export const PROC_INCIDENCIA_OPTIONS = [
  { value: 'Procedente',    label: 'Procedente (Sí)' },
  { value: 'No procedente', label: 'No procedente' },
  { value: 'No procede',    label: 'No procede' },
] as const;

// ── S12: Encuesta ─────────────────────────────────────────────────────────────

export const TIPO_ENCUESTA_OPTIONS = [
  'Sigue tu expediente',
  'Calidad del servicio',
  'Atención al asegurado',
  'Satisfacción global',
] as const;

export interface EnviarEncuestaRequest {
  visita_id?: string | null;
  tipo_encuesta: string;
}

// ── S13: Informe fotográfico — campos adicionales ─────────────────────────────

export interface CamposAdicionalesExpediente {
  id: string;
  expediente_id: string;
  campo_82: string | null;   // Material
  campo_83: string | null;   // Marca / Modelo
  campo_84: string | null;   // Medidas
  campo_85: string | null;   // Entrada
  campo_86: string | null;   // Salida
  campo_87: string | null;   // Nombre quien recoge
  campo_88: string | null;   // DNI / Fecha recogida
  campo_89: string | null;   // Delegación
  updated_at: string;
}

export interface UpsertCamposAdicionalesRequest {
  campo_82?: string | null;
  campo_83?: string | null;
  campo_84?: string | null;
  campo_85?: string | null;
  campo_86?: string | null;
  campo_87?: string | null;
  campo_88?: string | null;
  campo_89?: string | null;
}

// ── S14: Adjuntos y Email ─────────────────────────────────────────────────────

export interface AdjuntoUploadInitRequest {
  nombre_original: string;
  mime_type: string;
}

export interface AdjuntoUploadInitResponse {
  signed_url: string;
  storage_path: string;
}

export interface RegistrarAdjuntoRequest {
  tipo_documento: string;
  descripcion?: string | null;
  storage_path: string;
  nombre_original?: string | null;
  mime_type?: string | null;
}

export interface EnviarEmailAdjuntosRequest {
  email_destino: string;
  email_libre?: string | null;
  asunto: string;
  cuerpo: string;
  adjunto_ids?: string[];
}

// ── S15: SMS programado ───────────────────────────────────────────────────────

export interface EnviarSmsExpedienteRequest {
  destinatario_nombre: string;
  numero: string;
  texto: string;
  fecha_programada?: string | null;
}

export interface SmsProgramado {
  id: string;
  expediente_id: string;
  destinatario_nombre: string;
  numero: string;
  texto: string;
  fecha_programada: string | null;
  estado: 'pendiente' | 'enviado' | 'fallido' | 'cancelado';
  enviado_at: string | null;
  created_at: string;
}

// ── S16: Email al operario ────────────────────────────────────────────────────

export interface EnviarEmailOperarioRequest {
  email_destino: string;
  email_libre?: string | null;
  nombre_destino?: string | null;
  asunto?: string | null;
  cuerpo: string;
}

export interface EmailExpedienteLog {
  id: string;
  expediente_id: string;
  email_destino: string;
  email_libre: string | null;
  nombre_destino: string | null;
  asunto: string | null;
  cuerpo: string;
  created_at: string;
}

// ── G1: Especialidades del siniestro ──────────────────────────────────────────

export const ESPECIALIDADES_SINIESTRO = [
  'Fontanería',
  'Electricidad',
  'Albañilería',
  'Carpintería',
  'Pintura',
  'Cerrajería',
  'Cristalería',
  'Climatización',
  'Jardinería',
  'Electrodomésticos',
  'Impermeabilización',
  'Telecomunicaciones',
  'Desatascos',
  'Control de plagas',
  'Mudanzas',
  'Otros',
] as const;

// ── G2: Datos adicionales por visita ──────────────────────────────────────────

export interface ActualizarCampoVisitaRequest {
  campo_2: string | null;
}

// ── G3: Plantillas de documento / Generación desde S12 ───────────────────────

export interface PlantillaDocumento {
  id: string;
  nombre: string;
  seccion: string | null;
  activa: boolean;
}

export interface GenerarDocumentoExpedienteRequest {
  plantilla_id: string;
  visita_id?: string | null;
}

// ── G4: Firma STE Email por visita ────────────────────────────────────────────

export interface EnviarFirmaEmailVisitaRequest {
  visita_id: string;
}
