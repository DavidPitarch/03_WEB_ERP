# ADR-003: Edge API en Cloudflare Workers

## Estado: Aceptado

## Contexto
Necesitamos un backend que valide, orqueste y mute el estado del sistema. Debe ser rápido, seguro y escalable.

## Decisión
Cloudflare Workers con Hono como framework HTTP. Hono es ligero, tipado, compatible con Workers y soporta middleware.

## Razones
- Latencia baja (edge).
- Sin cold starts relevantes.
- Integración nativa con Queues y Cron Triggers.
- Hono: ~14KB, API similar a Express, middleware ecosystem.

## Consecuencias
- Sin acceso a Node.js APIs completas (Workers runtime).
- Supabase client funciona en Workers.
- Límite de 128MB RAM por request (suficiente para API).
