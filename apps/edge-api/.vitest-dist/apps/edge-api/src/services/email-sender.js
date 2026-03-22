import { insertDomainEvent } from './audit';
export async function sendEmail(apiKey, params) {
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
        const data = await res.json();
        return { success: true, messageId: data.id, dryRun: false };
    }
    catch (err) {
        return { success: false, error: err.message, dryRun: false };
    }
}
// ─── Envío de factura por email ───
export async function sendFacturaEmail(supabase, apiKey, factura, actorId) {
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
export async function sendCustomerTrackingEmail(supabase, apiKey, params, actorId) {
    const nombreDisplay = params.aseguradoNombre.trim() || 'cliente';
    const expiresFormatted = (() => {
        try {
            return new Intl.DateTimeFormat('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            }).format(new Date(params.expiresAt));
        }
        catch {
            return params.expiresAt.slice(0, 10);
        }
    })();
    const companiaLine = params.companiaLabel ? ` · ${params.companiaLabel}` : '';
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Seguimiento de tu expediente ${params.numeroExpediente}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,.10);
                    overflow:hidden;max-width:600px;width:100%;">

        <!-- Cabecera -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8 0%,#0e7490 100%);
                     padding:36px 40px 28px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:.15em;
                      text-transform:uppercase;color:rgba(255,255,255,.75);font-weight:700;">
              Portal de Transparencia
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;line-height:1.2;">
              Seguimiento de tu expediente
            </h1>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px 40px 20px;">
            <p style="margin:0 0 16px;font-size:16px;color:#334155;line-height:1.5;">
              Hola, <strong>${nombreDisplay}</strong>
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              Hemos activado tu acceso personal al seguimiento del expediente
              <strong style="color:#1d4ed8;">${params.numeroExpediente}</strong>.
              Desde este portal podrás consultar el estado actual, ver los detalles
              de la próxima cita y confirmar o solicitar cambios de horario.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:4px 0 32px;">
                  <a href="${params.trackingUrl}"
                     style="display:inline-block;padding:14px 36px;background:#1d4ed8;
                            color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;
                            border-radius:10px;letter-spacing:.02em;">
                    Ver estado de mi expediente
                  </a>
                </td>
              </tr>
            </table>

            <!-- Referencia -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="background:#f0f9ff;border:1px solid #bae6fd;
                          border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;
                            letter-spacing:.08em;color:#0369a1;font-weight:700;">
                    Referencia del expediente
                  </p>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#0c4a6e;">
                    ${params.numeroExpediente}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
              Este enlace es personal e intransferible. Estará activo hasta el
              <strong style="color:#334155;">${expiresFormatted}</strong>.
              Si no reconoces esta comunicación o tienes cualquier duda, contacta
              directamente con la oficina gestora.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
              Si el botón no funciona, copia este enlace en tu navegador:<br>
              <span style="color:#1d4ed8;">${params.trackingUrl}</span>
            </p>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                     padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Equipo de Gestión de Siniestros${companiaLine}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const result = await sendEmail(apiKey, {
        to: params.to,
        subject: `Seguimiento de tu expediente ${params.numeroExpediente}`,
        html,
        from: 'Equipo de Gestión de Siniestros <noreply@erp-siniestros.com>',
    });
    const emailStatus = result.dryRun ? 'dry_run' : result.success ? 'sent' : 'failed';
    await supabase
        .from('customer_tracking_tokens')
        .update({
        email_sent_at: new Date().toISOString(),
        email_status: emailStatus,
        email_error: result.error ?? null,
    })
        .eq('id', params.tokenId);
    if (result.success) {
        await insertDomainEvent(supabase, {
            aggregate_id: params.tokenId,
            aggregate_type: 'customer_tracking_token',
            event_type: 'CustomerTrackingEmailEnviado',
            payload: {
                token_id: params.tokenId,
                numero_expediente: params.numeroExpediente,
                email: params.to,
                dry_run: result.dryRun,
                message_id: result.messageId ?? null,
            },
            actor_id: actorId,
        });
    }
    return result;
}
// ─── Envío de pedido al proveedor por email ───
export async function sendPedidoEmail(supabase, apiKey, pedido, actorId) {
    const lineasHtml = pedido.lineas.map(l => `<tr><td>${l.descripcion}</td><td>${l.cantidad}</td><td>${l.unidad}</td></tr>`).join('');
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
