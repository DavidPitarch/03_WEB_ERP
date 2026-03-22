import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { getRequestIp } from '../http/request-metadata';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { insertExpedienteTimelineEntry } from '../services/expediente-timeline';
import { buildCustomerTrackingActionMetadata, buildCustomerTrackingContact, buildCustomerTrackingTimeline, buildCustomerTrackingView, canConfirmCustomerAppointment, canRequestCustomerReschedule, hashCustomerTrackingToken, validateCustomerTrackingToken, } from '../services/customer-tracking';
import { sendCustomerTrackingEmail } from '../services/email-sender';
export const customerTrackingPublicRoutes = new Hono();
export const customerTrackingAdminRoutes = new Hono();
const DEFAULT_TOKEN_TTL_HOURS = 72;
const MAX_TOKEN_TTL_HOURS = 168;
const DEFAULT_TOKEN_MAX_USES = 25;
const DEFAULT_RESCHEDULE_MIN_HOURS = 4;
// ─── Helpers ─────────────────────────────────────────────────────────────────
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
/** Construye la URL pública del portal de cliente. En desarrollo usa fallback. */
function buildTrackingUrl(env, rawToken) {
    const base = env.CONFIRM_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5173';
    return `${base}/customer-tracking/${rawToken}`;
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
    if (future.data?.id)
        return future.data;
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
    if (!expediente)
        return null;
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
        .update({ use_count: token.use_count + 1, last_used_at: new Date().toISOString() })
        .eq('id', token.id);
}
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST / — Emitir enlace de seguimiento + enviar email al asegurado
// ─────────────────────────────────────────────────────────────────────────────
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
    // Cargar expediente con datos del asegurado y compañía para el email
    const { data: expediente } = await supabase
        .from('expedientes')
        .select('id, numero_expediente, asegurados(nombre, apellidos, email), companias(nombre)')
        .eq('id', body.expediente_id)
        .maybeSingle();
    if (!expediente?.id) {
        return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
    }
    // Revocar tokens activos anteriores
    const now = new Date().toISOString();
    const { data: activeTokens } = await supabase
        .from('customer_tracking_tokens')
        .select('id')
        .eq('expediente_id', body.expediente_id)
        .is('revoked_at', null);
    if ((activeTokens ?? []).length > 0) {
        await supabase
            .from('customer_tracking_tokens')
            .update({ revoked_at: now, revoked_by: user.id, revoke_reason: 'replaced_by_new_issue' })
            .eq('expediente_id', body.expediente_id)
            .is('revoked_at', null);
    }
    // Generar token
    const rawToken = crypto.randomUUID();
    const tokenHash = await hashCustomerTrackingToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    const trackingUrl = buildTrackingUrl(c.env, rawToken);
    const { data: tokenRow, error: tokenError } = await supabase
        .from('customer_tracking_tokens')
        .insert({
        expediente_id: body.expediente_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        max_uses: maxUses,
        created_by: user.id,
        tracking_url: trackingUrl,
    })
        .select('id')
        .single();
    if (tokenError || !tokenRow?.id) {
        return c.json(err('DB_ERROR', tokenError?.message ?? 'No se pudo emitir el enlace'), 500);
    }
    // Datos del asegurado
    const asegurado = expediente.asegurados ?? null;
    const aseguradoEmail = asegurado?.email ?? null;
    const aseguradoNombre = [asegurado?.nombre, asegurado?.apellidos].filter(Boolean).join(' ') || 'cliente';
    const companiaLabel = expediente.companias?.nombre ?? null;
    // ── Trazabilidad: access log + audit + domain event + timeline ────────────
    await Promise.all([
        insertAccessLog(supabase, {
            tokenId: tokenRow.id,
            expedienteId: body.expediente_id,
            action: 'emitir_link',
            ok: true,
            ip,
            userAgent,
            detalle: {
                expires_at: expiresAt,
                tracking_url: trackingUrl,
                revoked_previous_count: (activeTokens ?? []).length,
                has_email: Boolean(aseguradoEmail),
            },
        }),
        insertAudit(supabase, {
            tabla: 'customer_tracking_tokens',
            registro_id: tokenRow.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { expediente_id: body.expediente_id, expires_at: expiresAt, max_uses: maxUses, tracking_url: trackingUrl },
            ip: ip ?? undefined,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: body.expediente_id,
            aggregate_type: 'expediente',
            event_type: 'CustomerTrackingLinkEmitido',
            payload: { token_id: tokenRow.id, expediente_id: body.expediente_id, expires_at: expiresAt, has_email: Boolean(aseguradoEmail) },
            actor_id: user.id,
        }),
        insertExpedienteTimelineEntry(supabase, {
            expedienteId: body.expediente_id,
            actorId: user.id,
            actorScope: 'sistema',
            actorName: 'Backoffice',
            type: 'sistema',
            subject: 'Enlace de seguimiento emitido',
            content: aseguradoEmail
                ? `Se ha generado y enviado un enlace de seguimiento al cliente (${aseguradoEmail}). Caduca el ${expiresAt.slice(0, 10)}.`
                : 'Se ha generado un enlace de seguimiento. El asegurado no tiene email: distribución manual.',
            metadata: buildCustomerTrackingActionMetadata('Enlace de seguimiento emitido', 'emitir_link'),
        }),
    ]);
    // ── Envío de email ────────────────────────────────────────────────────────
    let emailSent = false;
    let emailStatus = 'no_email';
    if (aseguradoEmail) {
        const emailResult = await sendCustomerTrackingEmail(supabase, c.env.RESEND_API_KEY, {
            tokenId: tokenRow.id,
            to: aseguradoEmail,
            aseguradoNombre,
            numeroExpediente: expediente.numero_expediente,
            companiaLabel,
            trackingUrl,
            expiresAt,
        }, user.id);
        emailSent = emailResult.success;
        emailStatus = emailResult.dryRun ? 'dry_run' : emailResult.success ? 'sent' : 'failed';
        // Si no hay key de email, el status ya queda en dry_run (no interrumpe el flujo)
    }
    else {
        // Marcar explícitamente que no había email de destino
        await supabase
            .from('customer_tracking_tokens')
            .update({ email_status: 'no_email' })
            .eq('id', tokenRow.id);
    }
    const response = {
        expediente_id: body.expediente_id,
        token: rawToken,
        path: `/customer-tracking/${rawToken}`,
        tracking_url: trackingUrl,
        expires_at: expiresAt,
        revoked_previous_count: (activeTokens ?? []).length,
        email_sent: emailSent,
        email_status: emailStatus,
    };
    return c.json({ data: response, error: null }, 201);
});
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /:tokenId/revocar — Revocar un token activo explícitamente
// ─────────────────────────────────────────────────────────────────────────────
customerTrackingAdminRoutes.post('/:tokenId/revocar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const ip = getRequestIp(c);
    const tokenId = c.req.param('tokenId');
    const { data: tokenRow } = await supabase
        .from('customer_tracking_tokens')
        .select('id, expediente_id, revoked_at')
        .eq('id', tokenId)
        .maybeSingle();
    if (!tokenRow?.id) {
        return c.json(err('NOT_FOUND', 'Token no encontrado'), 404);
    }
    if (tokenRow.revoked_at) {
        return c.json(err('ALREADY_REVOKED', 'El token ya está revocado'), 409);
    }
    const now = new Date().toISOString();
    await supabase
        .from('customer_tracking_tokens')
        .update({ revoked_at: now, revoked_by: user.id, revoke_reason: 'manual_revocation' })
        .eq('id', tokenId);
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'customer_tracking_tokens',
            registro_id: tokenId,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { revoked_at: now, revoke_reason: 'manual_revocation' },
            ip: ip ?? undefined,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: tokenRow.expediente_id,
            aggregate_type: 'expediente',
            event_type: 'CustomerTrackingLinkRevocado',
            payload: { token_id: tokenId, expediente_id: tokenRow.expediente_id, revoked_at: now },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { revoked: true, token_id: tokenId, revoked_at: now }, error: null });
});
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /reenviar — Reenviar email del enlace activo de un expediente
// ─────────────────────────────────────────────────────────────────────────────
customerTrackingAdminRoutes.post('/reenviar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({ expediente_id: '' }));
    if (!body.expediente_id) {
        return c.json(err('VALIDATION', 'expediente_id es requerido'), 422);
    }
    // Obtener token activo
    const { data: activeToken } = await supabase
        .from('customer_tracking_tokens')
        .select('id, tracking_url, expires_at')
        .eq('expediente_id', body.expediente_id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!activeToken?.id) {
        return c.json(err('NOT_FOUND', 'No hay enlace activo para este expediente. Emite uno nuevo.'), 404);
    }
    // Comprobar que no esté expirado
    if (new Date(activeToken.expires_at) < new Date()) {
        return c.json(err('TOKEN_EXPIRADO', 'El enlace activo ha expirado. Emite uno nuevo.'), 410);
    }
    // Datos del asegurado
    const { data: expediente } = await supabase
        .from('expedientes')
        .select('numero_expediente, asegurados(nombre, apellidos, email), companias(nombre)')
        .eq('id', body.expediente_id)
        .maybeSingle();
    if (!expediente) {
        return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
    }
    const asegurado = expediente.asegurados ?? null;
    const aseguradoEmail = asegurado?.email ?? null;
    if (!aseguradoEmail) {
        return c.json(err('NO_EMAIL', 'El asegurado no tiene email registrado. Distribuye el enlace manualmente.'), 422);
    }
    const aseguradoNombre = [asegurado?.nombre, asegurado?.apellidos].filter(Boolean).join(' ') || 'cliente';
    const companiaLabel = expediente.companias?.nombre ?? null;
    const trackingUrl = activeToken.tracking_url ?? buildTrackingUrl(c.env, '');
    const emailResult = await sendCustomerTrackingEmail(supabase, c.env.RESEND_API_KEY, {
        tokenId: activeToken.id,
        to: aseguradoEmail,
        aseguradoNombre,
        numeroExpediente: expediente.numero_expediente,
        companiaLabel,
        trackingUrl,
        expiresAt: activeToken.expires_at,
    }, user.id);
    return c.json({
        data: {
            reenvio: true,
            email_sent: emailResult.success,
            email_status: emailResult.dryRun ? 'dry_run' : emailResult.success ? 'sent' : 'failed',
        },
        error: null,
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /:token — Vista de seguimiento del cliente
// ─────────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:token/confirmar-cita
// ─────────────────────────────────────────────────────────────────────────────
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
        .update({ estado: 'confirmada', customer_confirmed_at: now })
        .eq('id', cita.id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
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
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /:token/solicitar-cambio
// ─────────────────────────────────────────────────────────────────────────────
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
    const { error } = await supabase.from('citas').update(updates).eq('id', cita.id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
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
