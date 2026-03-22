import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import type {
  AutocitaConfirmarResponse,
  AutocitaIssueLinkRequest,
  AutocitaIssueLinkResponse,
  AutocitaSeleccionarRequest,
  AutocitaSeleccionarResponse,
  AutocitaSlotsResponse,
  AutocitaTokenScope,
  AutocitaView,
} from '@erp/types';
import { getRequestIp } from '../http/request-metadata';
import type { Env } from '../types';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { insertExpedienteTimelineEntry } from '../services/expediente-timeline';
import {
  buildCustomerTrackingActionMetadata,
  buildAuthorizedTechnicianLabel,
} from '../services/customer-tracking';
import {
  consumeAutocitaToken,
  countCambiosExpediente,
  findAutocitaTokenByRawValue,
  hashAutocitaToken,
  insertAutocitaSeleccion,
  resolveAutocitaConfig,
  validateAutocitaToken,
} from '../services/autocita-tokens';
import {
  computeAvailableSlots,
  parseSlotId,
  resolveFranjaFin,
  validateSlotStillAvailable,
} from '../services/autocita-engine';
import { notifyAutocita } from '../services/autocita-notifications';
import { validate, validationError } from '../validation/schema';
import { autocitaIssueLinkSchema, autocitaSeleccionarSchema } from '../validation/autocita.schema';

export const autocitaPublicRoutes = new Hono<{ Bindings: Env }>();
export const autocitaAdminRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_TTL_HOURS = 72;
const MAX_TTL_HOURS = 168;
const DEFAULT_MAX_USES = 3;

function getServiceClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function getUserAgent(c: any): string | null {
  return c.req.header('user-agent') ?? null;
}

function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST / — emitir enlace de autocita
// ─────────────────────────────────────────────────────────────────────────────
autocitaAdminRoutes.post('/', async (c) => {
  const user = c.get('user');
  const supabase = c.get('supabase');
  const ip = getRequestIp(c);
  const userAgent = getUserAgent(c);

  const body = await c.req.json<AutocitaIssueLinkRequest>();
  const validation = validate(body, autocitaIssueLinkSchema);
  if (!validation.ok) return validationError(c, validation.errors);

  const scope: AutocitaTokenScope = body.scope ?? 'ambos';
  const ttlHours = Math.min(MAX_TTL_HOURS, Math.max(1, Number(body.ttl_hours) || DEFAULT_TTL_HOURS));
  const maxUses = Math.max(1, Number(body.max_uses) || DEFAULT_MAX_USES);

  const { data: expediente } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, compania_id')
    .eq('id', body.expediente_id)
    .maybeSingle();

  if (!expediente?.id) {
    return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
  }

  // Resolve current cita for context
  const { data: cita } = await supabase
    .from('citas')
    .select('id')
    .eq('expediente_id', body.expediente_id)
    .not('estado', 'in', '(cancelada,no_show)')
    .gte('fecha', new Date().toISOString().slice(0, 10))
    .order('fecha', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Revoke any existing active autocita tokens for this expediente
  const now = new Date().toISOString();
  await supabase
    .from('autocita_tokens')
    .update({ revoked_at: now, revoked_by: user.id, revoke_reason: 'replaced_by_new_issue' })
    .eq('expediente_id', body.expediente_id)
    .is('revoked_at', null);

  const rawToken = crypto.randomUUID();
  const tokenHash = await hashAutocitaToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const { data: tokenRow, error: insertError } = await supabase
    .from('autocita_tokens')
    .insert({
      expediente_id: body.expediente_id,
      cita_id_origen: cita?.id ?? null,
      compania_id: expediente.compania_id ?? null,
      token_hash: tokenHash,
      scope,
      expires_at: expiresAt,
      max_uses: maxUses,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertError || !tokenRow?.id) {
    return c.json(err('DB_ERROR', insertError?.message ?? 'No se pudo emitir el enlace'), 500);
  }

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'autocita_tokens',
      registro_id: tokenRow.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: { expediente_id: body.expediente_id, scope, expires_at: expiresAt, max_uses: maxUses },
      ip: ip ?? undefined,
    }),
    insertDomainEvent(supabase, {
      aggregate_id: body.expediente_id,
      aggregate_type: 'expediente',
      event_type: 'AutocitaTokenEmitido',
      payload: { token_id: tokenRow.id, expediente_id: body.expediente_id, scope, expires_at: expiresAt },
      actor_id: user.id,
    }),
  ]);

  const response: AutocitaIssueLinkResponse = {
    expediente_id: body.expediente_id,
    token: rawToken,
    path: `/autocita/${rawToken}`,
    scope,
    expires_at: expiresAt,
  };

  return c.json({ data: response, error: null }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:token — vista inicial de autocita
// ─────────────────────────────────────────────────────────────────────────────
autocitaPublicRoutes.get('/:token', async (c) => {
  const supabase = getServiceClient(c.env);
  const rawToken = c.req.param('token');
  const ip = getRequestIp(c);
  const userAgent = getUserAgent(c);

  const token = await findAutocitaTokenByRawValue(supabase, rawToken);
  const validation = validateAutocitaToken(token);

  if (!validation.ok) {
    return c.json(err(validation.code, 'El enlace no es válido o ha expirado'), validation.status);
  }

  const { data: expediente } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, estado, tipo_siniestro, codigo_postal, empresa_facturadora_id, fecha_limite_sla, companias(config), operarios(nombre, apellidos, user_id)')
    .eq('id', token!.expediente_id)
    .single();

  if (!expediente) {
    return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
  }

  const STATUS_LABELS: Record<string, string> = {
    NUEVO: 'Recibido', NO_ASIGNADO: 'Pendiente de asignación', EN_PLANIFICACION: 'Planificando visita',
    EN_CURSO: 'En intervención', PENDIENTE: 'Pendiente', PENDIENTE_MATERIAL: 'Pendiente de material',
    PENDIENTE_PERITO: 'Pendiente de peritación', PENDIENTE_CLIENTE: 'Pendiente de cliente',
    FINALIZADO: 'Finalizado', FACTURADO: 'Cierre administrativo', COBRADO: 'Cerrado económicamente',
    CERRADO: 'Cerrado', CANCELADO: 'Cancelado',
  };

  const { data: cita } = await supabase
    .from('citas')
    .select('id, fecha, franja_inicio, franja_fin, estado')
    .eq('expediente_id', token!.expediente_id)
    .not('estado', 'in', '(cancelada,no_show)')
    .gte('fecha', new Date().toISOString().slice(0, 10))
    .order('fecha', { ascending: true })
    .limit(1)
    .maybeSingle();

  const companiaConfig = (expediente as any).companias?.config ?? null;
  const cfg = resolveAutocitaConfig(companiaConfig);

  const cambiosUsados = await countCambiosExpediente(supabase, token!.expediente_id);
  const cambiosRestantes = Math.max(0, cfg.maxCambiosPorExpediente - cambiosUsados);

  const operario = (expediente as any).operarios ?? null;
  const now = new Date();
  let canConfirm = false;
  let canRequestChange = false;

  if (cita?.id) {
    const citaEnd = new Date(`${cita.fecha}T${cita.franja_fin}`);
    canConfirm = ['programada', 'confirmada'].includes(cita.estado) && citaEnd > now;
    const citaStart = new Date(`${cita.fecha}T${cita.franja_inicio}`);
    canRequestChange = ['programada', 'confirmada'].includes(cita.estado) &&
      (citaStart.getTime() - now.getTime()) >= 4 * 60 * 60 * 1000 &&
      cambiosRestantes > 0;
  }

  const slaFechaLimite = (expediente as any).fecha_limite_sla ?? null;

  const view: AutocitaView = {
    expediente: {
      numero_expediente: expediente.numero_expediente,
      estado_label: STATUS_LABELS[expediente.estado] ?? expediente.estado,
      tipo_siniestro: expediente.tipo_siniestro,
    },
    cita_propuesta: cita ? {
      cita_id: cita.id,
      fecha: cita.fecha,
      franja_inicio: cita.franja_inicio,
      franja_fin: cita.franja_fin,
      estado: cita.estado,
      tecnico: buildAuthorizedTechnicianLabel(operario),
      can_confirm: token!.scope !== 'seleccionar' && canConfirm,
      can_request_change: token!.scope !== 'confirmar' && canRequestChange,
      cambios_restantes: cambiosRestantes,
    } : null,
    sla: slaFechaLimite ? {
      estado: new Date(slaFechaLimite) < now ? 'vencido' : 'ok',
      fecha_limite: slaFechaLimite,
    } : null,
    scope: token!.scope,
  };

  await Promise.all([
    consumeAutocitaToken(supabase, token!),
    insertAutocitaSeleccion(supabase, {
      tokenId: token!.id,
      expedienteId: token!.expediente_id,
      citaId: cita?.id ?? null,
      accion: 'confirmacion_propuesta',
      ip,
      userAgent,
      detalle: { phase: 'view' },
    }),
  ]);

  return c.json({ data: view, error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:token/slots — huecos disponibles
// ─────────────────────────────────────────────────────────────────────────────
autocitaPublicRoutes.get('/:token/slots', async (c) => {
  const supabase = getServiceClient(c.env);
  const rawToken = c.req.param('token');

  const token = await findAutocitaTokenByRawValue(supabase, rawToken);
  const validation = validateAutocitaToken(token);

  if (!validation.ok) {
    return c.json(err(validation.code, 'El enlace no es válido o ha expirado'), validation.status);
  }

  if (token!.scope === 'confirmar') {
    return c.json(err('SCOPE_INVALIDO', 'Este enlace no permite selección de huecos'), 403);
  }

  const cambiosUsados = await countCambiosExpediente(supabase, token!.expediente_id);

  const { data: expediente } = await supabase
    .from('expedientes')
    .select('id, tipo_siniestro, codigo_postal, provincia, empresa_facturadora_id, fecha_limite_sla, operario_id, companias(config)')
    .eq('id', token!.expediente_id)
    .single();

  if (!expediente?.operario_id) {
    return c.json({ data: { slots: [], total: 0, cambios_restantes: 0, mensaje_sin_huecos: 'No hay operario asignado al expediente.' } as AutocitaSlotsResponse, error: null });
  }

  const companiaConfig = (expediente as any).companias?.config ?? null;
  const cfg = resolveAutocitaConfig(companiaConfig);
  const cambiosRestantes = Math.max(0, cfg.maxCambiosPorExpediente - cambiosUsados);

  if (cambiosRestantes <= 0) {
    return c.json(err('LIMITE_CAMBIOS', 'Has alcanzado el límite de cambios permitidos. Contacta con la oficina.'), 403);
  }

  const { data: operario } = await supabase
    .from('operarios')
    .select('id, zonas_cp, gremios')
    .eq('id', expediente.operario_id)
    .single();

  if (!operario) {
    return c.json({ data: { slots: [], total: 0, cambios_restantes: cambiosRestantes, mensaje_sin_huecos: 'No hay operario disponible.' } as AutocitaSlotsResponse, error: null });
  }

  // Resolve comunidad from provincia (simplified mapping for SLA check)
  const provinciaComunidadMap: Record<string, string> = {
    '08': 'CAT', '17': 'CAT', '25': 'CAT', '43': 'CAT',
    '28': 'MAD',
    '46': 'VAL', '03': 'VAL', '12': 'VAL',
  };
  const provinciaCode = expediente.provincia?.slice(0, 2) ?? null;
  const comunidad = provinciaCode ? (provinciaComunidadMap[provinciaCode] ?? null) : null;

  const slots = await computeAvailableSlots({
    supabase,
    operarioId: operario.id,
    operarioZonasCp: operario.zonas_cp ?? [],
    operarioGremios: operario.gremios ?? [],
    expedienteCodigoPostal: expediente.codigo_postal ?? '',
    expedienteTipoSiniestro: expediente.tipo_siniestro ?? '',
    expedienteEmpresaId: expediente.empresa_facturadora_id ?? null,
    expedienteProvincia: provinciaCode,
    expedienteComunidad: comunidad,
    slaFechaLimite: expediente.fecha_limite_sla ?? null,
    maxSlots: cfg.maxSlotsMostrados,
    diasMaxSeleccion: cfg.diasMaxSeleccion,
    margenAvisoH: cfg.margenAvisoH,
    bufferSlaH: cfg.bufferSlaH,
  });

  const response: AutocitaSlotsResponse = {
    slots,
    total: slots.length,
    cambios_restantes: cambiosRestantes,
    mensaje_sin_huecos: slots.length === 0 ? 'No hay franjas disponibles en los próximos días. Contacta con la oficina.' : null,
  };

  return c.json({ data: response, error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:token/confirmar — confirmar cita propuesta
// ─────────────────────────────────────────────────────────────────────────────
autocitaPublicRoutes.post('/:token/confirmar', async (c) => {
  const supabase = getServiceClient(c.env);
  const rawToken = c.req.param('token');
  const ip = getRequestIp(c);
  const userAgent = getUserAgent(c);

  const token = await findAutocitaTokenByRawValue(supabase, rawToken);
  const validation = validateAutocitaToken(token);

  if (!validation.ok) {
    return c.json(err(validation.code, 'El enlace no es válido o ha expirado'), validation.status);
  }

  if (token!.scope === 'seleccionar') {
    return c.json(err('SCOPE_INVALIDO', 'Este enlace no permite confirmar la cita propuesta'), 403);
  }

  const { data: cita } = await supabase
    .from('citas')
    .select('id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, customer_confirmed_at')
    .eq('id', token!.cita_id_origen!)
    .maybeSingle();

  if (!cita?.id) {
    // Fall back to current cita if cita_id_origen is null
    const { data: currentCita } = await supabase
      .from('citas')
      .select('id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, customer_confirmed_at')
      .eq('expediente_id', token!.expediente_id)
      .not('estado', 'in', '(cancelada,no_show)')
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!currentCita?.id) {
      return c.json(err('NOT_FOUND', 'No hay una cita disponible para confirmar'), 404);
    }

    return confirmCita(supabase, currentCita, token!, ip, userAgent, c);
  }

  return confirmCita(supabase, cita, token!, ip, userAgent, c);
});

async function confirmCita(
  supabase: any,
  cita: any,
  token: any,
  ip: string | null,
  userAgent: string | null,
  c: any,
) {
  if (!['programada', 'confirmada'].includes(cita.estado)) {
    return c.json(err('ESTADO_INVALIDO', 'La cita no puede confirmarse en su estado actual'), 422);
  }

  if (cita.customer_confirmed_at) {
    return c.json(err('YA_CONFIRMADA', 'Esta cita ya fue confirmada'), 409);
  }

  const now = new Date();
  const citaEnd = new Date(`${cita.fecha}T${cita.franja_fin}`);
  if (citaEnd <= now) {
    return c.json(err('CITA_PASADA', 'No se puede confirmar una cita que ya ha pasado'), 422);
  }

  const confirmedAt = now.toISOString();
  const { error: updateError } = await supabase
    .from('citas')
    .update({ estado: 'confirmada', customer_confirmed_at: confirmedAt })
    .eq('id', cita.id);

  if (updateError) {
    return c.json(err('DB_ERROR', updateError.message), 500);
  }

  // Resolve operario user_id for notification
  const { data: operarioRow } = await supabase
    .from('operarios')
    .select('user_id')
    .eq('id', cita.operario_id)
    .maybeSingle();

  await Promise.all([
    consumeAutocitaToken(supabase, token),
    insertAutocitaSeleccion(supabase, {
      tokenId: token.id,
      expedienteId: token.expediente_id,
      citaId: cita.id,
      accion: 'confirmacion_propuesta',
      slotFecha: cita.fecha,
      slotFranjaInicio: cita.franja_inicio,
      slotFranjaFin: cita.franja_fin,
      ip,
      userAgent,
    }),
    insertExpedienteTimelineEntry(supabase, {
      expedienteId: token.expediente_id,
      actorId: token.created_by,
      actorScope: 'sistema',
      actorName: 'Portal cliente (Autocita)',
      type: 'sistema',
      subject: 'Cliente confirma cita (Autocita)',
      content: `El cliente ha confirmado la cita del ${cita.fecha} ${cita.franja_inicio}-${cita.franja_fin} a través del enlace de autocita.`,
      metadata: buildCustomerTrackingActionMetadata('Cita confirmada por cliente', 'autocita_confirmar'),
    }),
    insertAudit(supabase, {
      tabla: 'citas',
      registro_id: cita.id,
      accion: 'UPDATE',
      actor_id: token.created_by,
      cambios: { estado: 'confirmada', customer_confirmed_at: confirmedAt, source: 'autocita' },
      ip: ip ?? undefined,
    }),
    insertDomainEvent(supabase, {
      aggregate_id: cita.id,
      aggregate_type: 'cita',
      event_type: 'AutocitaCitaConfirmada',
      payload: { expediente_id: token.expediente_id, cita_id: cita.id, token_id: token.id },
      actor_id: token.created_by,
    }),
    notifyAutocita({
      supabase,
      event: 'cita_confirmada',
      expedienteId: token.expediente_id,
      citaId: cita.id,
      operarioUserId: operarioRow?.user_id ?? null,
      detalle: `Cita confirmada: ${cita.fecha} ${cita.franja_inicio}-${cita.franja_fin}`,
    }),
  ]);

  const response: AutocitaConfirmarResponse = {
    cita_id: cita.id,
    confirmada: true,
    confirmed_at: confirmedAt,
  };

  return c.json({ data: response, error: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:token/seleccionar — elegir un hueco alternativo
// ─────────────────────────────────────────────────────────────────────────────
autocitaPublicRoutes.post('/:token/seleccionar', async (c) => {
  const supabase = getServiceClient(c.env);
  const rawToken = c.req.param('token');
  const ip = getRequestIp(c);
  const userAgent = getUserAgent(c);

  const token = await findAutocitaTokenByRawValue(supabase, rawToken);
  const validation = validateAutocitaToken(token);

  if (!validation.ok) {
    return c.json(err(validation.code, 'El enlace no es válido o ha expirado'), validation.status);
  }

  if (token!.scope === 'confirmar') {
    return c.json(err('SCOPE_INVALIDO', 'Este enlace no permite seleccionar huecos alternativos'), 403);
  }

  let body: AutocitaSeleccionarRequest;
  try {
    body = await c.req.json<AutocitaSeleccionarRequest>();
  } catch {
    return c.json(err('VALIDATION', 'Body inválido'), 422);
  }

  const schemaResult = validate(body, autocitaSeleccionarSchema);
  if (!schemaResult.ok) return validationError(c, schemaResult.errors);

  // Check cambios limit
  const { data: expediente } = await supabase
    .from('expedientes')
    .select('id, operario_id, tipo_siniestro, codigo_postal, provincia, empresa_facturadora_id, fecha_limite_sla, companias(config)')
    .eq('id', token!.expediente_id)
    .single();

  if (!expediente) {
    return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
  }

  const companiaConfig = (expediente as any).companias?.config ?? null;
  const cfg = resolveAutocitaConfig(companiaConfig);
  const cambiosUsados = await countCambiosExpediente(supabase, token!.expediente_id);

  if (cambiosUsados >= cfg.maxCambiosPorExpediente) {
    await Promise.all([
      insertDomainEvent(supabase, {
        aggregate_id: token!.expediente_id,
        aggregate_type: 'expediente',
        event_type: 'AutocitaLimiteCambiosAlcanzado',
        payload: { expediente_id: token!.expediente_id, cambios_count: cambiosUsados },
        actor_id: token!.created_by,
      }),
      notifyAutocita({
        supabase,
        event: 'limite_cambios_alcanzado',
        expedienteId: token!.expediente_id,
        detalle: `Se alcanzó el límite de ${cfg.maxCambiosPorExpediente} cambios.`,
      }),
    ]);
    return c.json(err('LIMITE_CAMBIOS', 'Has alcanzado el límite de cambios permitidos. Contacta con la oficina.'), 403);
  }

  // Parse slot_id
  const slotParts = parseSlotId(body.slot_id);
  if (!slotParts) {
    return c.json(err('SLOT_INVALIDO', 'El identificador de hueco no es válido'), 404);
  }

  const { operarioId, fecha, franjaInicio } = slotParts;
  const franjaFin = resolveFranjaFin(franjaInicio);
  if (!franjaFin) {
    return c.json(err('SLOT_INVALIDO', 'La franja horaria del hueco no es válida'), 422);
  }

  // Verify operario belongs to expediente
  if (operarioId !== expediente.operario_id) {
    return c.json(err('SLOT_INVALIDO', 'El hueco no pertenece al operario asignado'), 404);
  }

  const provinciaCode = expediente.provincia?.slice(0, 2) ?? null;
  const provinciaComunidadMap: Record<string, string> = {
    '08': 'CAT', '17': 'CAT', '25': 'CAT', '43': 'CAT',
    '28': 'MAD',
    '46': 'VAL', '03': 'VAL', '12': 'VAL',
  };
  const comunidad = provinciaCode ? (provinciaComunidadMap[provinciaCode] ?? null) : null;

  // Validate slot is still available (race condition protection)
  const slotCheck = await validateSlotStillAvailable(supabase, {
    operarioId,
    fecha,
    franjaInicio,
    franjaFin,
    empresaId: expediente.empresa_facturadora_id ?? null,
    provincia: provinciaCode,
    comunidad,
  });

  if (!slotCheck.ok) {
    await Promise.all([
      insertAutocitaSeleccion(supabase, {
        tokenId: token!.id,
        expedienteId: token!.expediente_id,
        accion: 'slot_no_disponible',
        slotFecha: fecha,
        slotFranjaInicio: franjaInicio,
        slotFranjaFin: franjaFin,
        ip,
        userAgent,
        detalle: { reason: slotCheck.reason, slot_id: body.slot_id },
      }),
      insertDomainEvent(supabase, {
        aggregate_id: token!.expediente_id,
        aggregate_type: 'expediente',
        event_type: 'AutocitaSlotNoDisponible',
        payload: { expediente_id: token!.expediente_id, slot_id: body.slot_id, reason: slotCheck.reason },
        actor_id: token!.created_by,
      }),
      notifyAutocita({
        supabase,
        event: 'slot_no_disponible',
        expedienteId: token!.expediente_id,
        detalle: `Hueco ${fecha} ${franjaInicio} ya no disponible (${slotCheck.reason}).`,
      }),
    ]);
    return c.json(err('SLOT_NO_DISPONIBLE', 'El hueco seleccionado ya no está disponible. Por favor, elige otro.'), 409);
  }

  // Cancel existing cita and create new one
  const now = new Date().toISOString();

  // Get current active cita to cancel
  const { data: citaActual } = await supabase
    .from('citas')
    .select('id')
    .eq('expediente_id', token!.expediente_id)
    .not('estado', 'in', '(cancelada,no_show)')
    .order('fecha', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (citaActual?.id) {
    await supabase
      .from('citas')
      .update({ estado: 'cancelada' })
      .eq('id', citaActual.id);
  }

  // Create new cita
  const { data: nuevaCita, error: citaError } = await supabase
    .from('citas')
    .insert({
      expediente_id: token!.expediente_id,
      operario_id: operarioId,
      fecha,
      franja_inicio: franjaInicio,
      franja_fin: franjaFin,
      estado: 'programada',
      notas: 'Cita creada via autocita por el cliente',
    })
    .select('id')
    .single();

  if (citaError || !nuevaCita?.id) {
    return c.json(err('DB_ERROR', citaError?.message ?? 'No se pudo crear la nueva cita'), 500);
  }

  // Resolve operario user_id for notification
  const { data: operarioRow } = await supabase
    .from('operarios')
    .select('user_id')
    .eq('id', operarioId)
    .maybeSingle();

  await Promise.all([
    consumeAutocitaToken(supabase, token!),
    insertAutocitaSeleccion(supabase, {
      tokenId: token!.id,
      expedienteId: token!.expediente_id,
      citaId: nuevaCita.id,
      accion: 'seleccion_hueco',
      slotFecha: fecha,
      slotFranjaInicio: franjaInicio,
      slotFranjaFin: franjaFin,
      ip,
      userAgent,
      detalle: { slot_id: body.slot_id, cita_cancelada_id: citaActual?.id ?? null },
    }),
    insertExpedienteTimelineEntry(supabase, {
      expedienteId: token!.expediente_id,
      actorId: token!.created_by,
      actorScope: 'sistema',
      actorName: 'Portal cliente (Autocita)',
      type: 'sistema',
      subject: 'Cliente selecciona nueva franja (Autocita)',
      content: `El cliente ha seleccionado el hueco ${fecha} ${franjaInicio}-${franjaFin} a través del enlace de autocita.`,
      metadata: buildCustomerTrackingActionMetadata('Nueva franja seleccionada por cliente', 'autocita_seleccionar'),
    }),
    insertAudit(supabase, {
      tabla: 'citas',
      registro_id: nuevaCita.id,
      accion: 'INSERT',
      actor_id: token!.created_by,
      cambios: { fecha, franja_inicio: franjaInicio, franja_fin: franjaFin, source: 'autocita' },
      ip: ip ?? undefined,
    }),
    insertDomainEvent(supabase, {
      aggregate_id: nuevaCita.id,
      aggregate_type: 'cita',
      event_type: 'AutocitaSlotSeleccionado',
      payload: {
        cita_id: nuevaCita.id,
        expediente_id: token!.expediente_id,
        fecha,
        franja_inicio: franjaInicio,
        franja_fin: franjaFin,
        cita_cancelada_id: citaActual?.id ?? null,
        token_id: token!.id,
      },
      actor_id: token!.created_by,
    }),
    notifyAutocita({
      supabase,
      event: 'slot_seleccionado',
      expedienteId: token!.expediente_id,
      citaId: nuevaCita.id,
      operarioUserId: operarioRow?.user_id ?? null,
      detalle: `Nueva cita: ${fecha} ${franjaInicio}-${franjaFin}`,
    }),
  ]);

  const response: AutocitaSeleccionarResponse = {
    cita_id: nuevaCita.id,
    nueva_fecha: fecha,
    nueva_franja_inicio: franjaInicio,
    nueva_franja_fin: franjaFin,
    confirmacion_automatica: false,
  };

  return c.json({ data: response, error: null });
});
