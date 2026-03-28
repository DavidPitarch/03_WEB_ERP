/**
 * Cloudflare Queue consumer — async document and notification pipeline.
 *
 * Two queues are handled here (distinguished by batch.queue):
 *   domain-events      — main processing queue
 *   domain-events-dlq  — dead-letter queue (messages exhausted max_retries)
 *
 * Message types:
 *   generate_pdf          — build HTML document for a validated parte, upload to Storage
 *   domain_event_fanout   — dispatch email notifications for key domain events
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './types';
import { sendEmail, sendFacturaEmail } from './services/email-sender';
import { insertDomainEvent } from './services/audit';

// ─── Message schema ────────────────────────────────────────────────────────

export type QueueMsg =
  | {
      type: 'generate_pdf';
      parte_id: string;
      expediente_id: string;
      documento_id: string;
      actor_id: string;
      numero_expediente: string;
    }
  | {
      type: 'domain_event_fanout';
      /** Optional — used to mark eventos_dominio.processed when available */
      evento_id?: string;
      event_type: string;
      aggregate_id: string;
      aggregate_type: string;
      payload: Record<string, unknown>;
      actor_id: string;
    };

// ─── Queue entry point ─────────────────────────────────────────────────────

export async function queue(
  batch: MessageBatch<QueueMsg>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Dead-letter queue — create admin alert for every failed message
  if (batch.queue === 'domain-events-dlq') {
    await handleDeadLetter(supabase, batch);
    batch.ackAll();
    return;
  }

  // Main queue — process messages individually so one failure doesn't block others
  for (const message of batch.messages) {
    try {
      const msg = message.body;
      if (msg.type === 'generate_pdf') {
        await handlePdfGeneration(supabase, msg);
      } else if (msg.type === 'domain_event_fanout') {
        await handleDomainEventFanout(supabase, env, msg);
      } else {
        console.warn('[queue] Unknown message type:', (msg as any).type);
      }
      message.ack();
    } catch (err) {
      console.error('[queue] Error processing message:', err instanceof Error ? err.message : err);
      message.retry();
    }
  }
}

// ─── PDF / HTML document generation ───────────────────────────────────────

async function handlePdfGeneration(
  supabase: SupabaseClient,
  msg: Extract<QueueMsg, { type: 'generate_pdf' }>
): Promise<void> {
  // Fetch parte with related expediente data
  const { data: parte, error: parteErr } = await supabase
    .from('partes_operario')
    .select('*, expedientes(numero_expediente, tipo_siniestro, direccion_siniestro, localidad)')
    .eq('id', msg.parte_id)
    .single();

  if (parteErr || !parte) {
    // Permanent failure — no point retrying
    await (supabase as any)
      .from('documentos')
      .update({ estado: 'error', error_detalle: parteErr?.message ?? 'Parte no encontrado' })
      .eq('id', msg.documento_id);
    console.error('[queue:pdf] Parte not found, marking documento as error:', msg.parte_id);
    return; // ack'd by the caller — don't throw
  }

  // Build the document as HTML (CF Workers have no native PDF renderer)
  const html = buildParteHtml(parte, msg.numero_expediente);
  const bytes = new TextEncoder().encode(html);
  const storagePath = `documentos/${msg.expediente_id}/parte_${msg.parte_id}.html`;

  const { error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(storagePath, bytes, { contentType: 'text/html; charset=utf-8', upsert: true });

  if (uploadErr) {
    // Transient failure — allow retry
    await (supabase as any)
      .from('documentos')
      .update({ estado: 'error', error_detalle: uploadErr.message })
      .eq('id', msg.documento_id);
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  // Mark documento as completado
  await (supabase as any)
    .from('documentos')
    .update({ estado: 'completado', storage_path: storagePath, generado_at: new Date().toISOString() })
    .eq('id', msg.documento_id);

  // Emit domain event
  await insertDomainEvent(supabase, {
    aggregate_id: msg.parte_id,
    aggregate_type: 'parte_operario',
    event_type: 'DocumentoGenerado',
    payload: { documento_id: msg.documento_id, storage_path: storagePath, tipo: 'html' },
    actor_id: msg.actor_id,
  });

  console.log(JSON.stringify({ level: 'info', job: 'generate_pdf', documento_id: msg.documento_id, storage_path: storagePath }));
}

function buildParteHtml(parte: Record<string, any>, numeroExpediente: string): string {
  const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date());
  const exp = parte.expedientes ?? {};

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Parte de Intervención — ${escHtml(numeroExpediente)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:40px;color:#1a1a1a;max-width:800px}
    h1{color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:8px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;padding:12px;background:#f8fafc;border-radius:8px}
    .section{margin:24px 0}
    .section h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
    .section p{margin:6px 0;white-space:pre-wrap}
    .field{margin:4px 0;font-size:14px}
    .label{font-weight:700;color:#334155}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;background:#dbeafe;color:#1e40af}
    .firma-ok{margin-top:32px;padding:12px;border:1px dashed #94a3b8;border-radius:8px;color:#475569;font-size:13px}
    @media print{body{margin:20px}}
  </style>
</head>
<body>
  <h1>Parte de Intervención</h1>

  <div class="meta">
    <div class="field"><span class="label">Expediente:</span> ${escHtml(numeroExpediente)}</div>
    <div class="field"><span class="label">Fecha:</span> ${escHtml(fecha)}</div>
    <div class="field"><span class="label">Tipo:</span> ${escHtml(exp.tipo_siniestro ?? '—')}</div>
    <div class="field"><span class="label">Dirección:</span> ${escHtml(exp.direccion_siniestro ?? '—')}, ${escHtml(exp.localidad ?? '')}</div>
  </div>

  <div class="section">
    <h2>Resultado de la visita</h2>
    <div class="field">
      <span class="badge">${escHtml(parte.resultado ?? '—')}</span>
      ${parte.motivo_resultado ? `<span style="margin-left:8px">${escHtml(parte.motivo_resultado)}</span>` : ''}
    </div>
    <div class="field"><span class="label">Requiere nueva visita:</span> ${parte.requiere_nueva_visita ? 'Sí' : 'No'}</div>
  </div>

  <div class="section">
    <h2>Trabajos realizados</h2>
    <p>${escHtml(parte.trabajos_realizados ?? '—')}</p>
  </div>

  ${parte.trabajos_pendientes ? `
  <div class="section">
    <h2>Trabajos pendientes</h2>
    <p>${escHtml(parte.trabajos_pendientes)}</p>
  </div>` : ''}

  ${parte.materiales_utilizados ? `
  <div class="section">
    <h2>Materiales utilizados</h2>
    <p>${escHtml(parte.materiales_utilizados)}</p>
  </div>` : ''}

  ${parte.observaciones ? `
  <div class="section">
    <h2>Observaciones</h2>
    <p>${escHtml(parte.observaciones)}</p>
  </div>` : ''}

  <div class="firma-ok">
    ${parte.firma_storage_path
      ? '✓ Firma del cliente adjunta en el sistema'
      : 'Sin firma del cliente'}
  </div>
</body>
</html>`;
}

/** Minimal HTML escaping to prevent XSS in the generated document */
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Domain event fanout ───────────────────────────────────────────────────

async function handleDomainEventFanout(
  supabase: SupabaseClient,
  env: Env,
  msg: Extract<QueueMsg, { type: 'domain_event_fanout' }>
): Promise<void> {
  switch (msg.event_type) {
    case 'FacturaEmitida':
      await fanoutFacturaEmitida(supabase, env, msg);
      break;
    case 'AutocitaCitaConfirmada':
    case 'AutocitaSlotSeleccionado':
      await fanoutCitaConfirmada(supabase, env, msg);
      break;
    default:
      // Unknown event — log and move on (don't retry)
      console.log('[queue:fanout] No handler registered for event_type:', msg.event_type);
      return;
  }

  // Mark evento_dominio as processed when evento_id is available
  if (msg.evento_id) {
    await (supabase as any)
      .from('eventos_dominio')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', msg.evento_id);
  }
}

async function fanoutFacturaEmitida(
  supabase: SupabaseClient,
  env: Env,
  msg: Extract<QueueMsg, { type: 'domain_event_fanout' }>
): Promise<void> {
  const { data: factura } = await supabase
    .from('facturas')
    .select('id, numero_factura, total, expediente_id, expedientes(numero_expediente), companias(nombre, email)')
    .eq('id', msg.aggregate_id)
    .single();

  if (!factura) {
    console.warn('[queue:fanout] Factura not found:', msg.aggregate_id);
    return;
  }

  const compania = (factura as any).companias;
  if (!compania?.email) {
    console.log('[queue:fanout] Compañía sin email — skipping:', msg.aggregate_id);
    return;
  }

  await sendFacturaEmail(
    supabase,
    env.RESEND_API_KEY,
    {
      id: (factura as any).id,
      numero_factura: (factura as any).numero_factura,
      total: (factura as any).total,
      compania_email: compania.email,
      compania_nombre: compania.nombre,
      empresa_nombre: 'ERP Siniestros',
      expediente_numero: (factura as any).expedientes?.numero_expediente ?? '—',
    },
    msg.actor_id
  );
}

async function fanoutCitaConfirmada(
  supabase: SupabaseClient,
  env: Env,
  msg: Extract<QueueMsg, { type: 'domain_event_fanout' }>
): Promise<void> {
  const expedienteId = msg.payload.expediente_id as string | undefined;
  if (!expedienteId) return;

  // Notify the expediente tramitador
  const { data: exp } = await supabase
    .from('expedientes')
    .select('numero_expediente, tipo_siniestro, profiles!tramitador_id(email)')
    .eq('id', expedienteId)
    .single();

  const tramitadorEmail = (exp as any)?.profiles?.email;
  if (!tramitadorEmail) return;

  await sendEmail(env.RESEND_API_KEY, {
    to: tramitadorEmail,
    subject: `Cita confirmada por el asegurado — ${(exp as any)?.numero_expediente ?? ''}`,
    html: `
      <p>El asegurado ha confirmado una cita para el expediente
      <strong>${(exp as any)?.numero_expediente ?? expedienteId}</strong>.</p>
      <p>Tipo de siniestro: ${(exp as any)?.tipo_siniestro ?? '—'}</p>
      <p>Evento: <em>${msg.event_type}</em></p>
    `,
  });
}

// ─── Dead-letter queue handler ─────────────────────────────────────────────

async function handleDeadLetter(
  supabase: SupabaseClient,
  batch: MessageBatch<QueueMsg>
): Promise<void> {
  for (const message of batch.messages) {
    const msg = message.body;
    const description = `type=${msg.type}, event_type=${'event_type' in msg ? msg.event_type : '—'}, aggregate_id=${'aggregate_id' in msg ? msg.aggregate_id : '—'}`;

    console.error('[queue:dlq] Dead-lettered message:', description);

    // Create an admin alerta so it's visible in the backoffice
    await (supabase as any).from('alertas').insert({
      tipo: 'queue_dead_letter',
      nivel: 'critica',
      titulo: 'Mensaje en Dead-Letter Queue',
      descripcion: `Un mensaje no pudo procesarse tras los reintentos máximos. ${description}`,
      metadata: { queue_message: msg },
      created_at: new Date().toISOString(),
    });
  }
}
