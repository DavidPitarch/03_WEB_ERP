# ADR-004: Eventos de dominio

## Estado: Aceptado

## Contexto
El sistema necesita desacoplar efectos secundarios (emails, PDFs, notificaciones, watchdogs) de las operaciones principales.

## Decisión
Toda mutación relevante publica un evento de dominio en la tabla `eventos_dominio`. Los eventos se procesan vía Cloudflare Queues. Eventos fallidos van a DLQ con reintentos configurables.

## Esquema del evento
- id, aggregate_id, aggregate_type, event_type, version, payload (JSONB)
- correlation_id, causation_id, actor, occurred_at

## Consecuencias
- Trazabilidad completa de qué causó qué.
- Procesamiento async desacoplado.
- Posibilidad de replay de eventos.
