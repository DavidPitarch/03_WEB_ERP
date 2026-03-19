import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { getRequestIp } from '../http/request-metadata';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { insertExpedienteTimelineEntry } from '../services/expediente-timeline';
import { buildCustomerTrackingActionMetadata, buildCustomerTrackingContact, buildCustomerTrackingTimeline, buildCustomerTrackingView, canConfirmCustomerAppointment, canRequestCustomerReschedule, hashCustomerTrackingToken, validateCustomerTrackingToken, } from '../services/customer-tracking';
export const customerTrackingPublicRoutes = new Hono();
export const customerTrackingAdminRoutes = new Hono();
const DEFAULT_TOKEN_TTL_HOURS = 72;
const MAX_TOKEN_TTL_HOURS = 168;
const DEFAULT_TOKEN_MAX_USES = 25;
const DEFAULT_RESCHEDULE_MIN_HOURS = 4;
function getServiceClient(env) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}
function getUserAgent(c) {
    return c.req.header('user-agent') ?? null;
}
function err(code, message) {
    return { data: null, error: { code, message } };
}
async function insertAccessLog(supabase, params) {
    await supabase.from('customer_tracking_access_logs').insert({
        token_id: params.tokenId ?? null,
        expediente_id: params.expedienteId ?? null,
        cita_id: params.citaId ?? null,
        action: params.action,
        ok: params.ok,
        ip: params.ip,
        user_agent: params.userAgent,
        detalle: params.detalle ?? {},
    });
}
async function findTokenByRawValue(supabase, token) {
    const tokenHash = await hashCustomerTrackingToken(token);
    const { data } = await supabase
        .from('customer_tracking_tokens')
        .select('id, expediente_id, token_hash, expires_at, max_uses, use_count, revoked_at, created_by')
        .eq('token_hash', tokenHash)
        .maybeSingle();
    return data ?? null;
}
async function resolveCurrentCita(supabase, expedienteId) {
    const today = new Date().toISOString().slice(0, 10);
    const future = await supabase
        .from('citas')
        .select('id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, customer_confirmed_at, customer_reschedule_requested_at, customer_reschedule_requested_slot, customer_reschedule_status')
        .eq('expediente_id', expedienteId)
        .neq('estado', 'cancelada')
        .gte('fecha', today)
        .order('fecha', { ascending: true })
        .order('franja_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (future.data?.id) {
        return future.data;
    }
    const fallback = await supabase
        .from('citas')
        .select('id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, customer_confirmed_at, customer_reschedule_requested_at, customer_reschedule_requested_slot, customer_reschedule_status')
        .eq('expediente_id', expedienteId)
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: false })
        .order('franja_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
    return fallback.data ?? null;
}
async function resolveCustomerTrackingContext(supabase, expedienteId) {
    const { data: expediente } = await supabase
        .from('expedientes')
        .select('id, numero_expediente, estado, tipo_siniestro, updated_at, companias(nombre, config), operarios(nombre, apellidos)')
        .eq('id', expedienteId)
        .single();
    if (!expediente) {
        return null;
    }
    const cita = await resolveCurrentCita(supabase, expedienteId);
    const [historial, citas, comunicaciones] = await Promise.all([
        supabase.from('historial_estados').select('id, estado_nuevo, created_at').eq('expediente_id', expedienteId).order('created_at', { ascending: false }).limit(10),
        supabase.from('citas').select('id, fecha, franja_inicio, franja_fin, estado, created_at').eq('expediente_id', expedienteId).order('created_at', { ascending: false }).limit(10),
        supabase.from('comunicaciones').select('id, contenido, metadata, created_at').eq('expediente_id', expedienteId).order('created_at', { ascending: false }).limit(20),
    ]);
    const timeline = buildCustomerTrackingTimeline({
        historial: historial.data ?? [],
        citas: citas.data ?? [],
        comunicaciones: comunicaciones.data ?? [],
    });
    const companiaConfig = expediente.companias?.config ?? null;
    const contacto = buildCustomerTrackingContact(companiaConfig);
    return {
        expediente,
        cita,
        operario: expediente.operarios ?? null,
        contacto,
        timeline,
    };
}
async function consumeToken(supabase, token) {
    await supabase
        .from('customer_tracking_tokens')
        .update({
        use_count: token.use_count + 1,
        last_used_at: new Date().toISOString(),
    })
        .eq('id', token.id);
}
customerTrackingAdminRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const ip = getRequestIp(c);
    const userAgent = getUserAgent(c);
    const body = await c.req.json();
    if (!body.expediente_id) {
        return c.json(err('VALIDATION', 'expediente_id es requerido'), 422);
    }
    const ttlHours = Math.min(MAX_TOKEN_TTL_HOURS, Math.max(1, Number(body.ttl_hours) || DEFAULT_TOKEN_TTL_HOURS));
    const maxUses = Math.max(1, Number(body.max_uses) || DEFAULT_TOKEN_MAX_USES);
    const { data: expediente } = await supabase
        .from('expedientes')
        .select('id, numero_expediente')
        .eq('id', body.expediente_id)
        .maybeSingle();
    if (!expediente?.id) {
        return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
    }
    const now = new Date().toISOString();
    const { data: activeTokens } = await supabase
        .from('customer_tracking_tokens')
        .select('id')
        .eq('expediente_id', body.expediente_id)
        .is('revoked_at', null);
    if ((activeTokens ?? []).length > 0) {
        await supabase
            .from('customer_tracking_tokens')
            .update({
            revoked_at: now,
            revoked_by: user.id,
            revoke_reason: 'replaced_by_new_issue',
        })
            .eq('expediente_id', body.expediente_id)
            .is('revoked_at', null);
    }
    const rawToken = crypto.randomUUID();
    const tokenHash = await hashCustomerTrackingToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    const { data: tokenRow, error } = await supabase
        .from('customer_tracking_tokens')
        .insert({
        expediente_id: body.expediente_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        max_uses: maxUses,
        created_by: user.id,
    })
        .select('id')
        .single();
    if (error || !tokenRow?.id) {
        return c.json(err('DB_ERROR', error?.message ?? 'No se pudo emitir el enlace'), 500);
    }
    await Promise.all([
        insertAccessLog(supabase, {
            tokenId: tokenRow.id,
            expedienteId: body.expediente_id,
            action: 'emitir_link',
            ok: true,
            ip,
            userAgent,
            detalle: { expires_at: expiresAt, revoked_previous_count: (activeTokens ?? []).length },
        }),
        insertAudit(supabase, {
            tabla: 'customer_tracking_tokens',
            registro_id: tokenRow.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { expediente_id: body.expediente_id, expires_at: expiresAt, max_uses: maxUses },
            ip: ip ?? undefined,
        }),
    ]);
    const response = {
        expediente_id: body.expediente_id,
        token: rawToken,
        path: `/customer-tracking/${rawToken}`,
        expires_at: expiresAt,
        revoked_previous_count: (activeTokens ?? []).length,
    };
    return c.json({ data: response, error: null }, 201);
});
customerTrackingPublicRoutes.get('/:token', async (c) => {
    const supabase = getServiceClient(c.env);
    const rawToken = c.req.param('token');
    const ip = getRequestIp(c);
    const userAgent = getUserAgent(c);
    const token = await findTokenByRawValue(supabase, rawToken);
    const validation = validateCustomerTrackingToken(token);
    if (!validation.ok) {
        await insertAccessLog(supabase, {
            tokenId: token?.id ?? null,
            expedienteId: token?.expediente_id ?? null,
            action: 'view',
            ok: false,
            ip,
            userAgent,
            detalle: { code: validation.code },
        });
        return c.json(err(validation.code, 'El enlace no es valido o ha expirado'), validation.status);
    }
    const context = await resolveCustomerTrackingContext(supabase, token.expediente_id);
    if (!context) {
        return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
    }
    const view = buildCustomerTrackingView({
        expediente: {
            id: context.expediente.id,
            numero_expediente: context.expediente.numero_expediente,
            estado: context.expediente.estado,
            tipo_siniestro: context.expediente.tipo_siniestro,
            updated_at: context.expediente.updated_at,
        },
        cita: context.cita,
        operario: context.operario,
        contacto: context.contacto,
        timeline: context.timeline,
    });
    await Promise.all([
        consumeToken(supabase, token),
        insertAccessLog(supabase, {
            tokenId: token.id,
            expedienteId: token.expediente_id,
            citaId: context.cita?.id ?? null,
            action: 'view',
            ok: true,
            ip,
            userAgent,
        }),
    ]);
    return c.json({ data: view, error: null });
});
customerTrackingPublicRoutes.post('/:token/confirmar-cita', async (c) => {
    const supabase = getServiceClient(c.env);
    const rawToken = c.req.param('token');
    const ip = getRequestIp(c);
    const userAgent = getUserAgent(c);
    const token = await findTokenByRawValue(supabase, rawToken);
    const validation = validateCustomerTrackingToken(token);
    if (!validation.ok) {
        await insertAccessLog(supabase, {
            tokenId: token?.id ?? null,
            expedienteId: token?.expediente_id ?? null,
            action: 'confirmar_cita',
            ok: false,
            ip,
            userAgent,
            detalle: { code: validation.code },
        });
        return c.json(err(validation.code, 'El enlace no es valido o ha expirado'), validation.status);
    }
    const cita = await resolveCurrentCita(supabase, token.expediente_id);
    if (!cita?.id) {
        return c.json(err('NOT_FOUND', 'No hay una cita disponible para confirmar'), 404);
    }
    if (!canConfirmCustomerAppointment(cita)) {
        return c.json(err('ESTADO_INVALIDO', 'La cita no puede confirmarse desde este enlace'), 422);
    }
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('citas')
        .update({
        estado: 'confirmada',
        customer_confirmed_at: now,
    })
        .eq('id', cita.id);
    if (error) {
        return c.json(err('DB_ERROR', error.message), 500);
    }
    await Promise.all([
        consumeToken(supabase, token),
        insertAccessLog(supabase, {
            tokenId: token.id,
            expedienteId: token.expediente_id,
            citaId: cita.id,
            action: 'confirmar_cita',
            ok: true,
            ip,
            userAgent,
        }),
        insertExpedienteTimelineEntry(supabase, {
            expedienteId: token.expediente_id,
            actorId: token.created_by,
            actorScope: 'sistema',
            actorName: 'Portal cliente',
            type: 'sistema',
            subject: 'Cliente confirma cita',
            content: `El cliente ha confirmado la cita del ${cita.fecha} ${cita.franja_inicio}-${cita.franja_fin}.`,
            metadata: buildCustomerTrackingActionMetadata('Cita confirmada', 'confirmar_cita'),
        }),
        insertAudit(supabase, {
            tabla: 'citas',
            registro_id: cita.id,
            accion: 'UPDATE',
            actor_id: token.created_by,
            cambios: { estado: 'confirmada', customer_confirmed_at: now, source: 'customer_tracking' },
            ip: ip ?? undefined,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: cita.id,
            aggregate_type: 'cita',
            event_type: 'ClienteConfirmaCita',
            payload: { expediente_id: token.expediente_id, cita_id: cita.id },
            actor_id: token.created_by,
        }),
    ]);
    const response = {
        cita_id: cita.id,
        estado: 'confirmada',
        customer_confirmed_at: now,
    };
    return c.json({ data: response, error: null });
});
customerTrackingPublicRoutes.post('/:token/solicitar-cambio', async (c) => {
    const supabase = getServiceClient(c.env);
    const rawToken = c.req.param('token');
    const body = await c.req.json();
    const ip = getRequestIp(c);
    const userAgent = getUserAgent(c);
    if (!body.franja_solicitada?.trim() || !body.motivo?.trim()) {
        return c.json(err('VALIDATION', 'franja_solicitada y motivo son requeridos'), 422);
    }
    const token = await findTokenByRawValue(supabase, rawToken);
    const validation = validateCustomerTrackingToken(token);
    if (!validation.ok) {
        await insertAccessLog(supabase, {
            tokenId: token?.id ?? null,
            expedienteId: token?.expediente_id ?? null,
            action: 'solicitar_cambio',
            ok: false,
            ip,
            userAgent,
            detalle: { code: validation.code },
        });
        return c.json(err(validation.code, 'El enlace no es valido o ha expirado'), validation.status);
    }
    const cita = await resolveCurrentCita(supabase, token.expediente_id);
    if (!cita?.id) {
        return c.json(err('NOT_FOUND', 'No hay una cita disponible para reprogramar'), 404);
    }
    if (!canRequestCustomerReschedule(cita, new Date(), DEFAULT_RESCHEDULE_MIN_HOURS)) {
        return c.json(err('ESTADO_INVALIDO', 'La cita no puede solicitar cambio desde este enlace'), 422);
    }
    const now = new Date().toISOString();
    const updates = {
        customer_reschedule_requested_at: now,
        customer_reschedule_requested_slot: body.franja_solicitada.trim(),
        customer_reschedule_motivo: body.motivo.trim(),
        customer_reschedule_status: 'pendiente',
    };
    const { error } = await supabase
        .from('citas')
        .update(updates)
        .eq('id', cita.id);
    if (error) {
        return c.json(err('DB_ERROR', error.message), 500);
    }
    await Promise.all([
        consumeToken(supabase, token),
        insertAccessLog(supabase, {
            tokenId: token.id,
            expedienteId: token.expediente_id,
            citaId: cita.id,
            action: 'solicitar_cambio',
            ok: true,
            ip,
            userAgent,
            detalle: { franja_solicitada: body.franja_solicitada.trim() },
        }),
        insertExpedienteTimelineEntry(supabase, {
            expedienteId: token.expediente_id,
            actorId: token.created_by,
            actorScope: 'sistema',
            actorName: 'Portal cliente',
            type: 'sistema',
            subject: 'Cliente solicita cambio de cita',
            content: `El cliente solicita nueva franja "${body.franja_solicitada.trim()}" por el motivo: ${body.motivo.trim()}.`,
            metadata: buildCustomerTrackingActionMetadata('Solicitud de cambio recibida', 'solicitar_cambio'),
        }),
        supabase.from('alertas').insert({
            tipo: 'custom',
            titulo: 'Cliente solicita cambio de cita',
            mensaje: `Nueva franja solicitada: ${body.franja_solicitada.trim()}. Motivo: ${body.motivo.trim()}.`,
            expediente_id: token.expediente_id,
            prioridad: 'media',
            estado: 'activa',
        }),
        insertAudit(supabase, {
            tabla: 'citas',
            registro_id: cita.id,
            accion: 'UPDATE',
            actor_id: token.created_by,
            cambios: { ...updates, source: 'customer_tracking' },
            ip: ip ?? undefined,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: cita.id,
            aggregate_type: 'cita',
            event_type: 'ClienteSolicitaCambioCita',
            payload: {
                expediente_id: token.expediente_id,
                cita_id: cita.id,
                franja_solicitada: body.franja_solicitada.trim(),
                motivo: body.motivo.trim(),
            },
            actor_id: token.created_by,
        }),
    ]);
    const response = {
        cita_id: cita.id,
        estado: cita.estado,
        customer_reschedule_requested_at: now,
        customer_reschedule_status: 'pendiente',
    };
    return c.json({ data: response, error: null });
});
