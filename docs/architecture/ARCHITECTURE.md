# Arquitectura Principal — ERP Siniestros Hogar

## Visión general

Sistema ERP para gestión del ciclo de vida completo de expedientes de siniestros del hogar.
Arquitectura event-driven, orientada a bandejas operativas, con máquina de estados estricta.

## Capas

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React + TypeScript + Vite)           │
│  backoffice / operator-pwa / portales           │
├─────────────────────────────────────────────────┤
│  Edge API (Cloudflare Workers)                  │
│  casos de uso / validación / orquestación       │
│  transiciones de estado / eventos / permisos    │
├─────────────────────────────────────────────────┤
│  Persistencia (Supabase PostgreSQL)             │
│  datos transaccionales / auditoría / catálogos  │
├─────────────────────────────────────────────────┤
│  Storage (Supabase Storage)                     │
│  evidencias / fotos / documentos / firmas       │
├─────────────────────────────────────────────────┤
│  Mensajería (Resend)                            │
│  emails transaccionales / webhooks              │
├─────────────────────────────────────────────────┤
│  Async (Cloudflare Queues + Cron Triggers)      │
│  watchdogs / PDF / reintentos / DLQ             │
└─────────────────────────────────────────────────┘
```

## Principios clave

1. **Expediente como aggregate root** — toda operación pivota sobre expediente.
2. **Máquina de estados centralizada** — transiciones validadas en backend, nunca en frontend.
3. **Event-driven** — toda mutación relevante publica un evento de dominio.
4. **Auditoría total** — toda acción deja traza inmutable.
5. **Bandejas operativas** — el trabajo llega al usuario, no al revés.
6. **Offline-first para campo** — PWA con sync queue.
7. **Seguridad desde día 1** — RLS, RBAC, signed URLs, rate limiting.

## Flujo principal

```
Ingesta → NUEVO → Asignación → EN_PLANIFICACION → Cita → EN_CURSO
→ Parte → FINALIZADO → Factura → FACTURADO → Cobro → COBRADO → CERRADO
```

Con ramas: PENDIENTE_MATERIAL, PENDIENTE_PERITO, PENDIENTE_CLIENTE, CANCELADO.

## Comunicación entre capas

- UI → Edge API: HTTP REST (JSON)
- Edge API → Supabase: supabase-js (transacciones SQL)
- Edge API → Queues: Cloudflare Queues (eventos async)
- Edge API → Storage: signed URLs
- Edge API → Resend: API REST
- Cron Triggers → Edge API: scheduled handlers (watchdogs)
- Supabase Realtime → UI: websocket (actualizaciones en vivo)

## Segregación de datos por rol

| Rol | Acceso |
|-----|--------|
| admin | Todo |
| supervisor | Expedientes de su ámbito + métricas |
| tramitador | Expedientes asignados + bandejas |
| operario | Solo sus citas y expedientes asignados |
| proveedor | Solo pedidos dirigidos a él |
| perito | Solo expedientes asignados pericialmente |
| financiero | Facturación + cobros |
| direccion | BI + métricas agregadas |
| cliente_final | Solo su expediente vía portal |
