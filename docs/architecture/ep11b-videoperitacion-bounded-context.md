# EP-11B — Videoperitación: Bounded Context

## Visión
Módulo completo de videoperitación que cubre el ciclo desde la recepción del encargo hasta la facturación del servicio, integrado con plataforma externa de vídeo.

## Entidades del dominio

### Core (Sprint 1)
| Entidad | Descripción |
|---|---|
| `vp_videoperitaciones` | Caso principal, vinculado a expediente |
| `vp_encargos` | Hoja de encargo + declaración siniestro |
| `vp_comunicaciones` | Comunicaciones entrantes/salientes del caso |
| `vp_intentos_contacto` | Registro de intentos de contacto con cliente |
| `vp_agenda` | Citas de videoperitación (franja, enlace, estado) |
| `vp_sesiones` | Sesiones de videoperitación (inicio, fin, duración) |
| `vp_consentimientos` | Consentimiento grabación/audio/transcripción |
| `vp_webhook_logs` | Logs de webhooks recibidos de plataforma externa |

### Extendidas (Sprints 2-5)
| Entidad | Sprint |
|---|---|
| `vp_artefactos` | 2 — fotos, docs, capturas, adjuntos |
| `vp_grabaciones` | 2 — metadato vídeo (ref externa) |
| `vp_audios` | 2 — metadato audio (ref externa) |
| `vp_transcripciones` | 2 — texto + resumen + highlights |
| `vp_informes` | 3 — informe pericial VP con versionado |
| `vp_valoraciones` | 4 — valoración económica |
| `vp_valoracion_lineas` | 4 — desglose por partida baremo |
| `vp_facturacion` | 5 — factura servicio VP |

## Estados del caso de videoperitación

```
encargo_recibido → pendiente_contacto → contactado → agendado →
  link_enviado → sesion_programada → sesion_en_curso → sesion_finalizada →
  pendiente_informe → informe_borrador → informe_validado →
  valoracion_calculada → facturado → enviado → cerrado
```

Estados terminales: `cancelado`, `cerrado`
Estados de error: `sesion_fallida`, `cliente_ausente`

## Eventos de dominio

### Internos
- VideoperitacionCreada
- VideoperitacionEncargoRecibido
- VideoperitacionContactoIntentado
- VideoperitacionAgendada
- VideoperitacionReprogramada
- VideoperitacionCancelada
- LinkVideoperitacionEnviado
- VideoperitacionSesionIniciada
- VideoperitacionSesionFinalizada
- EvidenciaVideoperitacionRecibida
- GrabacionVideoperitacionRegistrada
- AudioVideoperitacionRegistrado
- TranscripcionVideoperitacionRecibida
- InformeVideoperitacionGenerado
- InformeVideoperitacionValidado
- ValoracionVideoperitacionCalculada
- FacturaVideoperitacionEmitida
- InformeVideoperitacionEnviado

### Webhooks externos esperados
| Webhook | Mapeo interno |
|---|---|
| `session.created` | Actualizar vp_sesiones |
| `session.started` | VideoperitacionSesionIniciada |
| `session.ended` | VideoperitacionSesionFinalizada |
| `recording.ready` | GrabacionVideoperitacionRegistrada |
| `audio.ready` | AudioVideoperitacionRegistrado |
| `transcript.ready` | TranscripcionVideoperitacionRecibida |
| `session.failed` | Estado → sesion_fallida |
| `participant.absent` | Estado → cliente_ausente |

## Integración con ERP existente

| Entidad ERP | Relación |
|---|---|
| expedientes | FK videoperitacion → expediente_id |
| peritos | FK videoperitacion → perito_id |
| companias_aseguradoras | FK via expediente |
| asegurados | FK via expediente |
| baremos | Lectura para valoración económica |
| facturas | FK factura_vp → factura_id |
| dictamenes_periciales | FK opcional informe_vp → dictamen_id |
| timeline (comunicaciones) | Inserción automática |
| audit_log | Todas las acciones |
| domain_events | Todos los eventos |

## Modelo de integración externa

```typescript
// Adapter interface — vendor-agnostic
interface VideoProviderAdapter {
  createSession(params: CreateSessionParams): Promise<SessionResult>;
  generateLink(sessionId: string, role: 'perito' | 'cliente'): Promise<string>;
  getSessionStatus(sessionId: string): Promise<SessionStatus>;
  getRecording(sessionId: string): Promise<RecordingMeta | null>;
  getTranscript(sessionId: string): Promise<TranscriptResult | null>;
  validateWebhookSignature(payload: string, signature: string): boolean;
}
```

## Política de consentimiento y retención

| Tipo | Obligatorio | Base legal | Retención |
|---|---|---|---|
| Videoperitación | Sí | Ejecución contrato seguro | Duración expediente + 5 años |
| Grabación vídeo | Sí (informar) | Interés legítimo | 1 año o fin reclamación |
| Audio | Sí (informar) | Interés legítimo | 1 año o fin reclamación |
| Transcripción | No requiere extra | Derivada de audio | Igual que audio |
| Datos personales | Consentimiento | RGPD Art. 6 | Según política empresa |

Acceso a grabaciones/audio/transcripciones restringido por rol: solo admin, supervisor, perito asignado.

## Catálogo de webhooks

Endpoint: `POST /api/v1/public/videoperitacion/webhooks/provider`

Seguridad:
- Validación de firma HMAC-SHA256 en header `X-VP-Signature`
- Secret configurado en env `VP_WEBHOOK_SECRET`
- Idempotencia por `event_id` (deduplicación en vp_webhook_logs)
- Rate limit: 100 req/min
- Respuesta 200 inmediata, procesamiento async si es pesado
