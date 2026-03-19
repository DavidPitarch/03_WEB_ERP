# EP-12 Sprint 1 - Gap analysis

Fecha: 2026-03-18
Estado: vertical slice implementado
Sprint: Customer Tracking basico

## 1. Alcance implementado

- magic link seguro sin login con token temporal, caducidad, limite de usos y revocacion por reemision
- auditoria de accesos y acciones del portal cliente
- vista B2C limitada a estado general, cita actual, contacto y timeline resumida
- informacion de cita y tecnico autorizado
- confirmacion de cita desde portal cliente
- solicitud de cambio de cita con motivo, validaciones de plazo e incompatibilidad, registro en timeline y alerta a oficina
- endpoint interno de emision del enlace desde backoffice
- shell y pagina publica del portal cliente

## 2. Archivos creados o modificados

Backend:

- `apps/edge-api/src/routes/customer-tracking.ts`
- `apps/edge-api/src/services/customer-tracking.ts`
- `apps/edge-api/src/services/customer-tracking.test.ts`
- `apps/edge-api/src/index.ts`
- `packages/types/src/index.ts`

Frontend:

- `apps/backoffice-web/src/main.tsx`
- `apps/backoffice-web/src/pages/CustomerTrackingPage.tsx`
- `apps/backoffice-web/src/components/CustomerPortalShell.tsx`
- `apps/backoffice-web/src/lib/public-api.ts`
- `apps/backoffice-web/src/pages/ExpedienteDetailPage.tsx`
- `apps/backoffice-web/src/styles/global.css`

Modelo:

- `supabase/migrations/20260318230000_ep12_customer_tracking.sql`

## 3. Migracion añadida

La migracion `20260318230000_ep12_customer_tracking.sql` incorpora:

- tabla `customer_tracking_tokens`
- tabla `customer_tracking_access_logs`
- columnas de confirmacion / solicitud de cambio sobre `citas`
- indices y RLS staff para trazabilidad operativa

## 4. Endpoints implementados

Publicos:

- `GET /api/v1/public/customer-tracking/:token`
- `POST /api/v1/public/customer-tracking/:token/confirmar-cita`
- `POST /api/v1/public/customer-tracking/:token/solicitar-cambio`

Interno:

- `POST /api/v1/customer-tracking-links`

## 5. Pantallas y componentes implementados

- `CustomerTrackingPage`
- `CustomerPortalShell`
- bloque de estado general
- bloque de cita
- bloque de contacto
- bloque de timeline B2C
- acciones de confirmar cita y solicitar cambio
- boton de emision de enlace desde detalle de expediente

## 6. Tests implementados

Cobertura añadida en `apps/edge-api/src/services/customer-tracking.test.ts`:

- token valido
- token caducado
- token invalido
- confirmacion permitida / no permitida
- solicitud de cambio con validaciones de plazo e incompatibilidad
- timeline B2C solo con comunicaciones visibles
- no exposicion de campos prohibidos
- identificacion autorizada del tecnico

Verificacion ejecutada:

- `pnpm --filter @erp/edge-api typecheck`
- `pnpm --filter @erp/edge-api test`
- `pnpm --filter @erp/backoffice-web build`

## 7. Riesgos y limitaciones reales

- no se han implementado notificaciones salientes reales al cliente; la notificacion a oficina queda resuelta mediante `alertas`
- el contacto B2C depende de `companias.config.customer_tracking_contact` o `contacto_cliente`; si no existe, el portal muestra una version minima
- no se han expuesto documentos, finanzas, auditoria ni superficies VP
- la timeline B2C es deliberadamente reducida y solo incluye hitos seguros
- la reprogramacion queda como solicitud a oficina; no modifica directamente la franja

## 8. Cierre explicito

- EP-12 Sprint 1 queda abierto e implementado en su vertical slice basico
- NPS y encuesta final siguen cerrados
- EP-12 Sprint 2 sigue cerrado
- no se han abierto nuevas superficies externas adicionales
