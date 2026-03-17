import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { insertAudit, insertDomainEvent } from '../services/audit';
export const vpWebhooksRoutes = new Hono();
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';
const VALID_EVENTS = new Set([
    'session.created',
    'session.started',
    'session.ended',
    'recording.ready',
    'audio.ready',
    'transcript.ready',
    'session.failed',
    'participant.absent',
]);
// ─── Rate limiter (in-memory, per-isolate) ─────────────────────────────────
const rateBucket = { count: 0, resetAt: 0 };
function checkRateLimit() {
    const now = Date.now();
    if (now > rateBucket.resetAt) {
        rateBucket.count = 0;
        rateBucket.resetAt = now + 60_000;
    }
    rateBucket.count++;
    return rateBucket.count <= 100;
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function err(code, message) {
    return { data: null, error: { code, message } };
}
async function verifySignature(secret, rawBody, signatureHeader) {
    if (!signatureHeader.startsWith('sha256='))
        return false;
    const receivedHex = signatureHeader.slice(7);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const expectedHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    // Timing-safe comparison via double HMAC
    const cmpKey = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const a = await crypto.subtle.sign('HMAC', cmpKey, new TextEncoder().encode(receivedHex));
    const b = await crypto.subtle.sign('HMAC', cmpKey, new TextEncoder().encode(expectedHex));
    const ab = new Uint8Array(a);
    const bb = new Uint8Array(b);
    if (ab.length !== bb.length)
        return false;
    let diff = 0;
    for (let i = 0; i < ab.length; i++)
        diff |= ab[i] ^ bb[i];
    return diff === 0;
}
async function findSession(supabase, externalSessionId) {
    const { data } = await supabase
        .from('vp_sesiones')
        .select('id, videoperitacion_id, estado')
        .eq('external_session_id', externalSessionId)
        .maybeSingle();
    return data;
}
async function getVpExpediente(supabase, vpId) {
    const { data } = await supabase
        .from('videoperitaciones')
        .select('id, expediente_id, estado')
        .eq('id', vpId)
        .single();
    return data;
}
async function insertTimelineAndEvent(supabase, expedienteId, vpId, eventType, message, actorId) {
    // Insert comunicacion (timeline entry)
    await supabase.from('comunicaciones').insert({
        expediente_id: expedienteId,
        tipo: 'nota_interna',
        emisor_tipo: 'sistema',
        emisor_id: actorId,
        contenido: message,
        metadata: { source: 'vp_webhook', event_type: eventType, videoperitacion_id: vpId },
    });
    // Insert domain event
    await insertDomainEvent(supabase, {
        aggregate_id: vpId,
        aggregate_type: 'videoperitacion',
        event_type: eventType,
        payload: { expediente_id: expedienteId, message },
        actor_id: actorId,
    });
}
// ─── POST /vp-webhooks ─────────────────────────────────────────────────────
vpWebhooksRoutes.post('/', async (c) => {
    // Rate limit
    if (!checkRateLimit()) {
        return c.json(err('RATE_LIMITED', 'Too many requests'), 429);
    }
    const secret = c.env.VP_WEBHOOK_SECRET;
    if (!secret) {
        return c.json(err('CONFIG_ERROR', 'Webhook secret not configured'), 500);
    }
    // Read raw body for signature verification
    const rawBody = await c.req.text();
    // Validate HMAC signature
    const signature = c.req.header('x-vp-signature') ?? '';
    const valid = await verifySignature(secret, rawBody, signature);
    if (!valid) {
        return c.json(err('INVALID_SIGNATURE', 'Signature verification failed'), 401);
    }
    // Parse body
    let payload;
    try {
        payload = JSON.parse(rawBody);
    }
    catch {
        return c.json(err('INVALID_JSON', 'Request body is not valid JSON'), 400);
    }
    const eventId = c.req.header('x-vp-event-id') ?? '';
    const eventType = c.req.header('x-vp-event-type');
    if (!eventId) {
        return c.json(err('MISSING_EVENT_ID', 'x-vp-event-id header is required'), 400);
    }
    if (!eventType || !VALID_EVENTS.has(eventType)) {
        return c.json(err('UNKNOWN_EVENT', `Unsupported event type: ${eventType}`), 400);
    }
    // Create service-role client (no auth needed for public webhook)
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
    // Idempotency check
    const { data: existingLog } = await supabase
        .from('vp_webhook_logs')
        .select('id, processed')
        .eq('event_id', eventId)
        .maybeSingle();
    if (existingLog?.processed) {
        return c.json({ data: { message: 'Event already processed' }, error: null }, 200);
    }
    // Insert or get webhook log
    let logId;
    if (existingLog) {
        logId = existingLog.id;
    }
    else {
        const { data: newLog, error: logErr } = await supabase
            .from('vp_webhook_logs')
            .insert({
            event_id: eventId,
            event_type: eventType,
            payload,
            processed: false,
        })
            .select('id')
            .single();
        if (logErr) {
            return c.json(err('DB_ERROR', logErr.message), 500);
        }
        logId = newLog.id;
    }
    const data = payload.data;
    let sessionId = null;
    let videoperitacionId = null;
    try {
        switch (eventType) {
            // ── session.created ───────────────────────────────────────────────
            case 'session.created': {
                const { session_id, correlation_id, room_url, expires_at } = data;
                // Insert vp_sesiones
                const { data: sesion, error: sesErr } = await supabase
                    .from('vp_sesiones')
                    .insert({
                    external_session_id: session_id,
                    videoperitacion_id: correlation_id,
                    room_url,
                    expires_at,
                    estado: 'creada',
                    created_by: SYSTEM_ACTOR,
                })
                    .select('id')
                    .single();
                if (sesErr)
                    throw new Error(`Insert vp_sesiones: ${sesErr.message}`);
                sessionId = sesion.id;
                videoperitacionId = correlation_id;
                // Update VP estado
                await supabase
                    .from('videoperitaciones')
                    .update({ estado: 'sesion_programada', updated_by: SYSTEM_ACTOR })
                    .eq('id', correlation_id);
                // Link to active agenda entry
                await supabase
                    .from('vp_agenda')
                    .update({ sesion_id: sesion.id })
                    .eq('videoperitacion_id', correlation_id)
                    .is('sesion_id', null);
                const vp = await getVpExpediente(supabase, correlation_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, correlation_id, eventType, `Sesión de videoperitación creada. Sala: ${room_url}`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_sesiones', registro_id: sesion.id, accion: 'INSERT',
                    actor_id: SYSTEM_ACTOR, cambios: { estado: 'creada', room_url },
                });
                break;
            }
            // ── session.started ───────────────────────────────────────────────
            case 'session.started': {
                const { session_id, started_at, participants } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                await supabase
                    .from('vp_sesiones')
                    .update({ estado: 'iniciada', started_at, participants, updated_by: SYSTEM_ACTOR })
                    .eq('id', session.id);
                await supabase
                    .from('videoperitaciones')
                    .update({ estado: 'sesion_en_curso', updated_by: SYSTEM_ACTOR })
                    .eq('id', session.videoperitacion_id);
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Sesión de videoperitación iniciada con ${Array.isArray(participants) ? participants.length : 0} participante(s).`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_sesiones', registro_id: session.id, accion: 'UPDATE',
                    actor_id: SYSTEM_ACTOR, cambios: { estado: 'iniciada', started_at },
                });
                break;
            }
            // ── session.ended ─────────────────────────────────────────────────
            case 'session.ended': {
                const { session_id, ended_at, duration_seconds, participants_count } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                await supabase
                    .from('vp_sesiones')
                    .update({
                    estado: 'finalizada', ended_at, duration_seconds, participants_count,
                    updated_by: SYSTEM_ACTOR,
                })
                    .eq('id', session.id);
                await supabase
                    .from('videoperitaciones')
                    .update({ estado: 'sesion_finalizada', updated_by: SYSTEM_ACTOR })
                    .eq('id', session.videoperitacion_id);
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Sesión de videoperitación finalizada. Duración: ${duration_seconds}s, Participantes: ${participants_count}.`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_sesiones', registro_id: session.id, accion: 'UPDATE',
                    actor_id: SYSTEM_ACTOR, cambios: { estado: 'finalizada', ended_at, duration_seconds },
                });
                break;
            }
            // ── recording.ready ───────────────────────────────────────────────
            case 'recording.ready': {
                const { session_id, recording_url, duration_seconds, size_bytes, format } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                const { data: artefacto, error: artErr } = await supabase
                    .from('vp_artefactos')
                    .insert({
                    sesion_id: session.id,
                    videoperitacion_id: session.videoperitacion_id,
                    tipo: 'recording',
                    origen: 'webhook',
                    url: recording_url,
                    metadata: { duration_seconds, size_bytes, format },
                    created_by: SYSTEM_ACTOR,
                })
                    .select('id')
                    .single();
                if (artErr)
                    throw new Error(`Insert vp_artefactos: ${artErr.message}`);
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Grabación de videoperitación lista. Formato: ${format}, Duración: ${duration_seconds}s.`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_artefactos', registro_id: artefacto.id, accion: 'INSERT',
                    actor_id: SYSTEM_ACTOR, cambios: { tipo: 'recording', url: recording_url },
                });
                break;
            }
            // ── audio.ready ───────────────────────────────────────────────────
            case 'audio.ready': {
                const { session_id, recording_url, duration_seconds, size_bytes, format } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                const { data: artefacto, error: artErr } = await supabase
                    .from('vp_artefactos')
                    .insert({
                    sesion_id: session.id,
                    videoperitacion_id: session.videoperitacion_id,
                    tipo: 'audio',
                    origen: 'webhook',
                    url: recording_url,
                    metadata: { duration_seconds, size_bytes, format },
                    created_by: SYSTEM_ACTOR,
                })
                    .select('id')
                    .single();
                if (artErr)
                    throw new Error(`Insert vp_artefactos: ${artErr.message}`);
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Audio de videoperitación listo. Formato: ${format}, Duración: ${duration_seconds}s.`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_artefactos', registro_id: artefacto.id, accion: 'INSERT',
                    actor_id: SYSTEM_ACTOR, cambios: { tipo: 'audio', url: recording_url },
                });
                break;
            }
            // ── transcript.ready ──────────────────────────────────────────────
            case 'transcript.ready': {
                const { session_id, transcript_url, language, text, summary, highlights, segments } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                // Insert artefacto
                const { data: artefacto, error: artErr } = await supabase
                    .from('vp_artefactos')
                    .insert({
                    sesion_id: session.id,
                    videoperitacion_id: session.videoperitacion_id,
                    tipo: 'transcript',
                    origen: 'webhook',
                    url: transcript_url,
                    metadata: { language, summary, highlights },
                    created_by: SYSTEM_ACTOR,
                })
                    .select('id')
                    .single();
                if (artErr)
                    throw new Error(`Insert vp_artefactos: ${artErr.message}`);
                // Insert full transcription
                const { error: trErr } = await supabase
                    .from('vp_transcripciones')
                    .insert({
                    sesion_id: session.id,
                    videoperitacion_id: session.videoperitacion_id,
                    artefacto_id: artefacto.id,
                    language,
                    text,
                    summary,
                    highlights,
                    segments,
                    created_by: SYSTEM_ACTOR,
                });
                if (trErr)
                    throw new Error(`Insert vp_transcripciones: ${trErr.message}`);
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Transcripción de videoperitación lista. Idioma: ${language}.${summary ? ` Resumen: ${summary.slice(0, 200)}` : ''}`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_artefactos', registro_id: artefacto.id, accion: 'INSERT',
                    actor_id: SYSTEM_ACTOR, cambios: { tipo: 'transcript', language },
                });
                break;
            }
            // ── session.failed ────────────────────────────────────────────────
            case 'session.failed': {
                const { session_id, reason, details } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                await supabase
                    .from('vp_sesiones')
                    .update({ estado: 'fallida', error_reason: reason, error_details: details, updated_by: SYSTEM_ACTOR })
                    .eq('id', session.id);
                await supabase
                    .from('videoperitaciones')
                    .update({ estado: 'sesion_fallida', updated_by: SYSTEM_ACTOR })
                    .eq('id', session.videoperitacion_id);
                // Insert alert
                await supabase.from('alertas').insert({
                    tipo: 'sesion_fallida',
                    titulo: `Sesión de videoperitación fallida`,
                    descripcion: `Motivo: ${reason}. ${details ?? ''}`.trim(),
                    prioridad: 'alta',
                    referencia_tipo: 'videoperitacion',
                    referencia_id: session.videoperitacion_id,
                    created_by: SYSTEM_ACTOR,
                });
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Sesión de videoperitación fallida. Motivo: ${reason}.`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_sesiones', registro_id: session.id, accion: 'UPDATE',
                    actor_id: SYSTEM_ACTOR, cambios: { estado: 'fallida', reason },
                });
                break;
            }
            // ── participant.absent ────────────────────────────────────────────
            case 'participant.absent': {
                const { session_id, absent_role, waited_seconds } = data;
                const session = await findSession(supabase, session_id);
                if (!session)
                    throw new Error(`Session not found: ${session_id}`);
                sessionId = session.id;
                videoperitacionId = session.videoperitacion_id;
                await supabase
                    .from('vp_sesiones')
                    .update({ estado: 'ausente', absent_role, waited_seconds, updated_by: SYSTEM_ACTOR })
                    .eq('id', session.id);
                await supabase
                    .from('videoperitaciones')
                    .update({ estado: 'cliente_ausente', updated_by: SYSTEM_ACTOR })
                    .eq('id', session.videoperitacion_id);
                // Insert alert
                await supabase.from('alertas').insert({
                    tipo: 'participante_ausente',
                    titulo: `Participante ausente en videoperitación`,
                    descripcion: `Rol ausente: ${absent_role}. Tiempo de espera: ${waited_seconds}s.`,
                    prioridad: 'alta',
                    referencia_tipo: 'videoperitacion',
                    referencia_id: session.videoperitacion_id,
                    created_by: SYSTEM_ACTOR,
                });
                const vp = await getVpExpediente(supabase, session.videoperitacion_id);
                if (vp) {
                    await insertTimelineAndEvent(supabase, vp.expediente_id, vp.id, eventType, `Participante ausente (${absent_role}) en videoperitación. Esperó ${waited_seconds}s.`, SYSTEM_ACTOR);
                }
                await insertAudit(supabase, {
                    tabla: 'vp_sesiones', registro_id: session.id, accion: 'UPDATE',
                    actor_id: SYSTEM_ACTOR, cambios: { estado: 'ausente', absent_role, waited_seconds },
                });
                break;
            }
        }
        // Mark webhook log as processed
        await supabase
            .from('vp_webhook_logs')
            .update({
            processed: true,
            session_id: sessionId,
            videoperitacion_id: videoperitacionId,
            processed_at: new Date().toISOString(),
        })
            .eq('id', logId);
        return c.json({ data: { message: 'Event processed', event_type: eventType }, error: null }, 200);
    }
    catch (error) {
        // Log error but don't mark as processed (allows retry)
        await supabase
            .from('vp_webhook_logs')
            .update({ error_message: error.message })
            .eq('id', logId);
        return c.json(err('PROCESSING_ERROR', error.message), 500);
    }
});
