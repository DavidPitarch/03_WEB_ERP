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
];
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
];
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
];
// ─── Origen del expediente ───
export const EXPEDIENTE_ORIGENES = ['manual', 'api', 'webhook', 'email', 'import'];
// ─── R1-B: Operator PWA types ───
export const RESULTADO_VISITA = ['completada', 'pendiente', 'ausente', 'requiere_material'];
export const EVIDENCIA_CLASIFICACION = ['antes', 'durante', 'despues', 'general'];
// ─── R2-A.2: Tareas, Alertas, Baremos, Presupuestos ───
export const TAREA_ESTADOS = ['pendiente', 'en_progreso', 'pospuesta', 'resuelta', 'cancelada'];
export const ALERTA_TIPOS = ['tarea_vencida', 'sla_proximo', 'parte_pendiente_antiguo', 'pendiente_sin_revision', 'informe_caducado', 'custom'];
export const ALERTA_ESTADOS = ['activa', 'pospuesta', 'resuelta', 'descartada'];
export const CAUSA_PENDIENTE = ['material', 'perito', 'cliente_ausente', 'cliente_rechaza', 'acceso_impedido', 'condiciones_meteorologicas', 'otra'];
// ─── EP-08: Facturación, cobro y tesorería ───
export const FACTURA_ESTADOS = ['borrador', 'emitida', 'enviada', 'cobrada', 'anulada'];
export const ESTADO_COBRO = ['pendiente', 'vencida', 'reclamada', 'cobrada', 'incobrable'];
export const CANAL_ENVIO = ['email', 'api', 'portal', 'manual'];
// ─── EP-09: Proveedores y logística de materiales ───
export const PEDIDO_ESTADOS = ['pendiente', 'enviado', 'confirmado', 'listo_para_recoger', 'recogido', 'caducado', 'cancelado'];
// ─── EP-10: BI, Reporting y Autofacturación ───
export const AUTOFACTURA_ESTADOS = ['borrador', 'revisada', 'emitida', 'anulada'];
// ─── EP-11: Portal de peritos ───
export const DICTAMEN_ESTADOS = ['borrador', 'emitido', 'revisado', 'aceptado', 'rechazado'];
export const EVIDENCIA_DICTAMEN_CLASIFICACION = ['dano', 'causa', 'contexto', 'detalle'];
// ─── EP-11B: Videoperitación ───
export const VP_ESTADOS = [
    'encargo_recibido', 'pendiente_contacto', 'contactado', 'agendado',
    'link_enviado', 'sesion_programada', 'sesion_en_curso', 'sesion_finalizada',
    'pendiente_perito', 'revision_pericial',
    'pendiente_informe', 'informe_borrador', 'informe_validado',
    'valoracion_calculada', 'facturado', 'enviado', 'cerrado',
    'cancelado', 'sesion_fallida', 'cliente_ausente',
];
export const VP_COMUNICACION_TIPOS = ['llamada_entrante', 'llamada_saliente', 'email_entrante', 'email_saliente', 'nota_interna', 'sistema'];
export const VP_SESION_ESTADOS = ['pendiente', 'creada', 'iniciada', 'finalizada', 'fallida', 'ausente', 'cancelada'];
export const VP_ARTEFACTO_TIPOS = ['recording', 'audio', 'transcript', 'screenshot', 'document', 'evidence', 'foto', 'adjunto_cliente', 'adjunto_perito', 'adjunto_compania', 'hoja_encargo', 'declaracion'];
// ─── EP-11B Sprint 3: Cockpit Pericial ───
export const VP_DICTAMEN_ESTADOS = ['borrador', 'emitido', 'validado', 'rechazado', 'requiere_mas_informacion'];
export const VP_RESOLUCION_TIPOS = ['aprobacion', 'rechazo', 'solicitud_informacion', 'instruccion_tecnica', 'cierre_revision'];
export const VP_INSTRUCCION_TIPOS = ['continuidad', 'redireccion', 'suspension', 'ampliacion', 'cierre'];
export const VP_IMPACTO_EXPEDIENTE = ['mantener_pendiente', 'reactivar', 'redirigir', 'cerrar', 'sin_impacto'];
// ─── EP-11B Sprint 4: Informe Técnico + Valoración ──────────────────
export const VP_INFORME_ESTADOS = ['borrador', 'en_revision', 'validado', 'rectificado', 'enviado'];
export const VP_VALORACION_ESTADOS = ['borrador', 'calculada', 'validada', 'rectificada'];
// ─── EP-11B Sprint 5: Facturación VP + Envío + Documento Final ──────
export const VP_DOCUMENTO_ESTADOS = ['generando', 'generado', 'firmado', 'enviado', 'error'];
export const VP_ENVIO_ESTADOS = ['pendiente', 'enviando', 'enviado', 'error', 'acusado'];
export const VP_ENVIO_CANALES = ['email', 'api', 'portal', 'manual'];
