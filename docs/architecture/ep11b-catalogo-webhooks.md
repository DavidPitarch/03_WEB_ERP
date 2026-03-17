# EP-11B — Catálogo de webhooks de videoperitación

## Endpoint receptor

```
POST /api/v1/public/videoperitacion/webhooks/provider
```

- **Público**: sin auth middleware (accesible desde plataforma externa)
- **Seguridad**: validación HMAC-SHA256 con `VP_WEBHOOK_SECRET`
- **Rate limit**: 100 req/min
- **Idempotencia**: deduplicación por `event_id` en `vp_webhook_logs`
- **Respuesta**: 200 inmediato, procesamiento async si necesario

## Header de seguridad

```
X-VP-Signature: sha256=<HMAC-SHA256(payload, VP_WEBHOOK_SECRET)>
X-VP-Event-Id: <uuid>
X-VP-Event-Type: <event_type>
X-VP-Timestamp: <ISO8601>
```

## Validación

```typescript
function validateSignature(payload: string, signature: string, secret: string): boolean {
  const expected = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(payload)
  );
  const expectedHex = 'sha256=' + [...new Uint8Array(expected)].map(b => b.toString(16).padStart(2, '0')).join('');
  return expectedHex === signature;
}
```

## Eventos soportados

### session.created
Cuando la plataforma externa crea la sala de sesión.

```json
{
  "event_id": "evt-uuid",
  "event_type": "session.created",
  "timestamp": "2026-03-15T10:00:00Z",
  "data": {
    "session_id": "ext-session-123",
    "correlation_id": "vp-uuid-from-erp",
    "room_url": "https://provider.com/room/abc",
    "expires_at": "2026-03-15T12:00:00Z"
  }
}
```

**Acción ERP**: Crear/actualizar `vp_sesiones` con external_session_id, estado='creada'.

### session.started
Cuando al menos 2 participantes están conectados.

```json
{
  "event_id": "evt-uuid",
  "event_type": "session.started",
  "data": {
    "session_id": "ext-session-123",
    "started_at": "2026-03-15T10:05:00Z",
    "participants": [
      { "role": "perito", "name": "Dr. García" },
      { "role": "cliente", "name": "Juan Pérez" }
    ]
  }
}
```

**Acción ERP**: Actualizar sesión estado='iniciada', iniciada_at. Actualizar VP estado='sesion_en_curso'. Evento: VideoperitacionSesionIniciada.

### session.ended
Cuando la sesión finaliza normalmente.

```json
{
  "event_id": "evt-uuid",
  "event_type": "session.ended",
  "data": {
    "session_id": "ext-session-123",
    "ended_at": "2026-03-15T10:45:00Z",
    "duration_seconds": 2400,
    "participants_count": 2
  }
}
```

**Acción ERP**: Actualizar sesión estado='finalizada', finalizada_at, duracion_segundos. Actualizar VP estado='sesion_finalizada'. Evento: VideoperitacionSesionFinalizada.

### recording.ready
Grabación de vídeo disponible.

```json
{
  "event_id": "evt-uuid",
  "event_type": "recording.ready",
  "data": {
    "session_id": "ext-session-123",
    "recording_url": "https://provider.com/recordings/xyz",
    "duration_seconds": 2400,
    "size_bytes": 524288000,
    "format": "mp4",
    "expires_at": "2026-06-15T00:00:00Z"
  }
}
```

**Acción ERP**: Insertar en `vp_grabaciones` (Sprint 2). Evento: GrabacionVideoperitacionRegistrada.

### audio.ready
Audio extraído disponible por separado.

```json
{
  "event_id": "evt-uuid",
  "event_type": "audio.ready",
  "data": {
    "session_id": "ext-session-123",
    "audio_url": "https://provider.com/audio/xyz",
    "duration_seconds": 2400,
    "size_bytes": 25600000,
    "format": "mp3"
  }
}
```

**Acción ERP**: Insertar en `vp_audios` (Sprint 2). Evento: AudioVideoperitacionRegistrado.

### transcript.ready
Transcripción automática disponible.

```json
{
  "event_id": "evt-uuid",
  "event_type": "transcript.ready",
  "data": {
    "session_id": "ext-session-123",
    "transcript_url": "https://provider.com/transcripts/xyz",
    "language": "es",
    "text": "...",
    "summary": "...",
    "highlights": ["..."],
    "segments": [
      { "start": 0, "end": 5.2, "speaker": "perito", "text": "..." }
    ]
  }
}
```

**Acción ERP**: Insertar en `vp_transcripciones` (Sprint 2). Evento: TranscripcionVideoperitacionRecibida.

### session.failed
Fallo técnico en la sesión.

```json
{
  "event_id": "evt-uuid",
  "event_type": "session.failed",
  "data": {
    "session_id": "ext-session-123",
    "reason": "network_error",
    "details": "Connection lost after 30s"
  }
}
```

**Acción ERP**: Actualizar sesión estado='fallida'. Actualizar VP estado='sesion_fallida'. Generar alerta.

### participant.absent
Participante no se conectó en el tiempo esperado.

```json
{
  "event_id": "evt-uuid",
  "event_type": "participant.absent",
  "data": {
    "session_id": "ext-session-123",
    "absent_role": "cliente",
    "waited_seconds": 600
  }
}
```

**Acción ERP**: Actualizar VP estado='cliente_ausente'. Registrar intento fallido. Generar alerta.

## Procesamiento

```
Webhook recibido
  → Validar firma HMAC
  → Verificar event_id no duplicado (vp_webhook_logs)
  → Insertar en vp_webhook_logs (processed=false)
  → Responder 200
  → Procesar evento:
    → Lookup sesion por external_session_id
    → Actualizar entidades
    → Insertar domain events
    → Marcar webhook como processed
  → Si error: marcar error en vp_webhook_logs, no retry automático v1
```

## Reintento por parte del proveedor

El ERP debe:
- Responder 200 siempre que el payload sea parseable (incluso si procesamiento falla)
- Si responde 4xx/5xx, el proveedor reintentará (típicamente 3 veces con backoff)
- La idempotencia por event_id protege contra duplicados en reintentos
