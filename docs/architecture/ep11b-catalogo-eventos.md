# EP-11B — Catálogo de eventos de dominio

## Eventos internos del módulo VP

| Evento | Trigger | Payload |
|---|---|---|
| VideoperitacionCreada | POST /videoperitaciones | { numero_caso, expediente_id, perito_id, origen } |
| VideoperitacionEncargoRecibido | POST /:id/registrar-encargo | { tipo, videoperitacion_id } |
| VideoperitacionContactoIntentado | POST /:id/registrar-intento-contacto | { canal, resultado, intento_numero } |
| VideoperitacionAgendada | POST /:id/agendar | { fecha, hora_inicio, hora_fin, agenda_id } |
| VideoperitacionReprogramada | POST /:id/reprogramar | { agenda_anterior_id, agenda_nueva_id, motivo } |
| VideoperitacionCancelada | POST /:id/cancelar | { motivo, estado_anterior } |
| LinkVideoperitacionEnviado | POST /:id/enviar-link | { agenda_id, link_token, canal } |
| VideoperitacionSesionIniciada | Webhook session.started | { session_id, participantes } |
| VideoperitacionSesionFinalizada | Webhook session.ended | { session_id, duracion_segundos } |
| EvidenciaVideoperitacionRecibida | POST /:id/registrar-artefacto (Sprint 2) | { artefacto_id, tipo } |
| GrabacionVideoperitacionRegistrada | Webhook recording.ready (Sprint 2) | { recording_url, duracion } |
| AudioVideoperitacionRegistrado | Webhook audio.ready (Sprint 2) | { audio_url, duracion } |
| TranscripcionVideoperitacionRecibida | Webhook transcript.ready (Sprint 2) | { language, has_summary } |
| InformeVideoperitacionGenerado | POST /:id/generar-informe (Sprint 3) | { informe_id, version } |
| InformeVideoperitacionValidado | POST /:id/validar-informe (Sprint 3) | { informe_id, validado_por } |
| ValoracionVideoperitacionCalculada | POST /:id/calcular-valoracion (Sprint 4) | { valoracion_id, total, baremo_version } |
| FacturaVideoperitacionEmitida | POST /:id/emitir-factura (Sprint 5) | { factura_id, total } |
| InformeVideoperitacionEnviado | POST /:id/enviar-informe (Sprint 5) | { canal, destinatario } |

## Eventos que generan timeline en expediente

Todos los eventos VP se insertan automáticamente como comunicación tipo 'sistema' en el expediente vinculado para mantener la timeline unificada.

## Eventos que generan alertas

| Evento | Condición | Alerta |
|---|---|---|
| VideoperitacionCreada | deadline < 48h | Prioridad alta |
| VideoperitacionContactoIntentado | 3+ intentos sin contacto | Escalar a supervisor |
| LinkVideoperitacionEnviado | Sin sesión en 48h post-link | Recordatorio |
| VideoperitacionSesionFinalizada | Sin informe en 72h | Alerta perito |
| participant.absent | 2+ ausencias | Escalar a supervisor |
| session.failed | Error técnico | Alerta inmediata |

## Integración con sistema de eventos existente

Los eventos VP se insertan en la tabla `domain_events` existente con:
- `aggregate_type = 'videoperitacion'`
- `aggregate_id = videoperitacion.id`
- `correlation_id` para vincular eventos de una misma VP
