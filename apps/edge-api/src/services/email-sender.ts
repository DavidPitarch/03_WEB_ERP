import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAudit, insertDomainEvent } from './audit';

// ─── Email sender — Primera integración real desacoplada ───
// Usa fetch a un endpoint HTTP (Resend API). En producción se configura
// RESEND_API_KEY en el Worker. Si no existe, opera en modo dry-run con log.

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string }[];
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  dryRun: boolean;
}

export async function sendEmail(
  apiKey: string | undefined,
  params: EmailParams
): Promise<SendResult> {
  const from = params.from ?? 'ERP Siniestros <noreply@erp-siniestros.com>';

  // Dry-run si no hay API key
  if (!apiKey) {
    console.log('[EMAIL-DRY-RUN]', { to: params.to, subject: params.subject });
    return { success: true, dryRun: true, messageId: `dry-${Date.now()}` };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Resend ${res.status}: ${err}`, dryRun: false };
    }

    const data = await res.json() as { id: string };
    return { success: true, messageId: data.id, dryRun: false };
  } catch (err: any) {
    return { success: false, error: err.message, dryRun: false };
  }
}

// ─── Envío de factura por email ───
export async function sendFacturaEmail(
  supabase: SupabaseClient,
  apiKey: string | undefined,
  factura: {
    id: string;
    numero_factura: string;
    total: number;
    compania_email: string;
    compania_nombre: string;
    empresa_nombre: string;
    expediente_numero: string;
  },
  actorId: string
): Promise<SendResult> {
  const result = await sendEmail(apiKey, {
    to: factura.compania_email,
    subject: `Factura ${factura.numero_factura} — ${factura.empresa_nombre}`,
    html: `
      <h2>Factura ${factura.numero_factura}</h2>
      <p>Estimado/a ${factura.compania_nombre},</p>
      <p>Adjuntamos factura correspondiente al expediente <strong>${factura.expediente_numero}</strong>.</p>
      <table>
        <tr><td><strong>Nº Factura:</strong></td><td>${factura.numero_factura}</td></tr>
        <tr><td><strong>Total:</strong></td><td>${factura.total.toFixed(2)} €</td></tr>
      </table>
      <p>Queda a su disposición para cualquier consulta.</p>
      <p><em>ERP Siniestros — ${factura.empresa_nombre}</em></p>
    `,
  });

  // Registrar intento
  await supabase.from('facturas').update({
    enviada_at: new Date().toISOString(),
    envio_resultado: result.success ? 'ok' : 'error',
    envio_error: result.error ?? null,
    canal_envio: 'email',
    estado: result.success ? 'enviada' : undefined,
  }).eq('id', factura.id);

  if (result.success) {
    await insertDomainEvent(supabase, {
      aggregate_id: factura.id,
      aggregate_type: 'factura',
      event_type: 'FacturaEnviada',
      payload: { canal: 'email', message_id: result.messageId, dry_run: result.dryRun },
      actor_id: actorId,
    });
  }

  return result;
}

// ─── Envío de pedido al proveedor por email ───
export async function sendPedidoEmail(
  supabase: SupabaseClient,
  apiKey: string | undefined,
  pedido: {
    id: string;
    numero_pedido: string;
    proveedor_email: string;
    proveedor_nombre: string;
    expediente_numero: string;
    lineas: { descripcion: string; cantidad: number; unidad: string }[];
    magic_link: string;
  },
  actorId: string
): Promise<SendResult> {
  const lineasHtml = pedido.lineas.map(l =>
    `<tr><td>${l.descripcion}</td><td>${l.cantidad}</td><td>${l.unidad}</td></tr>`
  ).join('');

  const result = await sendEmail(apiKey, {
    to: pedido.proveedor_email,
    subject: `Pedido de material ${pedido.numero_pedido}`,
    html: `
      <h2>Pedido ${pedido.numero_pedido}</h2>
      <p>Estimado/a ${pedido.proveedor_nombre},</p>
      <p>Se requiere el siguiente material para el expediente <strong>${pedido.expediente_numero}</strong>:</p>
      <table border="1" cellpadding="4">
        <tr><th>Material</th><th>Cantidad</th><th>Unidad</th></tr>
        ${lineasHtml}
      </table>
      <p><strong>Para confirmar disponibilidad, haga clic en el siguiente enlace:</strong></p>
      <p><a href="${pedido.magic_link}">${pedido.magic_link}</a></p>
      <p><em>Este enlace es válido durante 7 días.</em></p>
    `,
  });

  // Registrar intento
  await supabase.from('pedidos_material').update({
    enviado_at: new Date().toISOString(),
    envio_error: result.error ?? null,
  }).eq('id', pedido.id);

  return result;
}
