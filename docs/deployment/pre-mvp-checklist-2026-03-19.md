# Checklist Pre-MVP — Estado al 2026-03-19

Base: Auditoría Integral + Plan de Remediación PM aprobado 2026-03-19.

Leyenda: ✅ sí | ❌ no | ⚠️ parcial | 🔍 no verificable sin deploy remoto

---

## BLOQUE A — SEGURIDAD Y ACCESO

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| A1 | RLS habilitada en todas las tablas sensibles | ⚠️ | Corregida en migración 20260319120000. Pendiente aplicar en remoto. |
| A2 | vp_facturas restringida a roles financieros | ✅ | Migration 20260319120000 — solo admin/supervisor/financiero/direccion |
| A3 | vp_envios restringida a office roles | ✅ | Migration 20260319120000 |
| A4 | vp_documento_final sin acceso a operarios/externos | ✅ | Migration 20260319120000 |
| A5 | Perito no puede leer facturas VP | ✅ | Route-level: VIDEOPERITACION_ROLES excluye perito. RLS: vp_facturas no incluye 'perito' |
| A6 | Endpoints VP protegidos por authMiddleware + requireRoles | ✅ | index.ts:134 `protectRouteGroup('/videoperitaciones', requireRoles(VIDEOPERITACION_ROLES))` |
| A7 | /internal/run-scheduled restringido a admin | ✅ | index.ts:135 `protectRouteGroup('/internal', requireRoles(['admin']))` |
| A8 | Rate limiting en endpoints públicos | ✅ | rateLimit(30, 60_000) en /public/customer-tracking |
| A9 | Signed URLs con TTL 900s para artefactos VP | ✅ | vp-access.ts VP_SIGNED_URL_TTL_SECONDS = 900 |
| A10 | RBAC mapeado a rutas críticas | ✅ | index.ts — todos los grupos de rutas con requireRoles |
| A11 | Customer tracking — tokens con expiración y max_uses | ✅ | Migration 20260318230000 + validateCustomerTrackingToken |
| A12 | VP webhook secret verificado | 🔍 | VP_WEBHOOK_SECRET configurado como env var; no verificable sin deploy |

---

## BLOQUE B — OPERATIVO Y FUNCIONAL

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| B1 | Ciclo expediente E2E: intake → campo → cierre → factura | ✅ | Rutas completas en edge-api |
| B2 | Operator PWA con parte digital y evidencias | ✅ | operator-pwa implementado |
| B3 | Motor SLA y alertas automáticas via cron | ✅ | scheduled.ts — detecta tareas, pedidos, facturas vencidas |
| B4 | Videoperitaciones — ciclo completo VP | ✅ | EP-11B Sprints 1-5 implementados |
| B5 | Facturación VP con bridge vp_facturas | ✅ | Migration 00016 + routes/videoperitaciones.ts |
| B6 | Envío de informe VP con retry y acuse | ✅ | EP-11B Sprint 5 — vp_envios |
| B7 | Customer tracking — token + vista pública | ✅ | Migration 20260318230000 + routes/customer-tracking.ts |
| B8 | Customer tracking — envío automático de email al emitir link | ❌ | Fuera de scope de esta remediación. Reubicado a EP-12 Sprint 1. |
| B9 | PDF real de partes de operario | ❌ | STUB. Ver /docs/deployment/pdf-pipeline-stub-status.md |
| B10 | Presupuestos y baremos | ✅ | EP-08 implementado |
| B11 | Autofacturación a proveedores | ✅ | routes/autofacturas.ts |
| B12 | Dashboard KPIs y rentabilidad | ✅ | EP-10 — vistas analíticas SQL + routes/dashboard.ts |
| B13 | Pedidos de material con confirmación por token | ✅ | routes/pedidos.ts + public confirm endpoint |

---

## BLOQUE C — OBSERVABILIDAD Y OPERACIÓN

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| C1 | Logs estructurados JSON por request | ✅ | requestLoggerMiddleware — middleware/request-logger.ts |
| C2 | correlation_id en cada request y respuesta | ✅ | Header x-correlation-id en request y response |
| C3 | Logs JSON en scheduled worker | ✅ | scheduled.ts — JSON.stringify en todas las fases |
| C4 | Health check con estado degraded si faltan secrets | ✅ | GET /health — 207 degraded si RESEND_API_KEY / VP_WEBHOOK_SECRET / CONFIRM_BASE_URL ausentes |
| C5 | Error reporting externo (Sentry o equivalente) | ❌ | No implementado. Deuda técnica aceptable temporalmente. |
| C6 | Alerting en producción para errores 5xx | 🔍 | Depende de plataforma de deploy (Cloudflare Workers dashboard). No verificable. |
| C7 | Auditoría de acciones críticas en tabla `audit_log` | ✅ | insertAudit() en todas las mutaciones críticas |
| C8 | Domain events para trazabilidad agregada | ✅ | insertDomainEvent() en flujos transaccionales |

---

## BLOQUE D — CONFIGURACIÓN Y DESPLIEGUE

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| D1 | wrangler.toml con bloque [env.production] | ❌ | Pendiente P1.3 |
| D2 | Secrets de producción en Cloudflare (SUPABASE_URL, keys, RESEND, etc.) | 🔍 | No verificable localmente. Requiere configuración manual. |
| D3 | CI/CD activo (typecheck + test + build en PR) | ❌ | Pendiente P2.1 |
| D4 | ENVIRONMENT = 'production' en deploy real | ❌ | Pendiente P1.3 |
| D5 | ALLOWED_ORIGINS configurado para dominio de producción | 🔍 | Pendiente configuración de secret en producción |
| D6 | Supabase migración 20260319120000 aplicada en remoto | ❌ | Pendiente ejecución manual o supabase db push |

---

## BLOQUE E — CALIDAD DE CÓDIGO

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| E1 | pnpm typecheck verde en edge-api | ✅ | Verde pre-commit (según sprint gate anterior) |
| E2 | pnpm test verde en edge-api | ✅ | 100+ tests pasando pre-commit |
| E3 | pnpm build verde en backoffice-web y operator-pwa | ✅ | Verde pre-commit (según sprint gate anterior) |
| E4 | Sin console.log no estructurado en rutas críticas | ⚠️ | scheduled.ts corregido. Posibles console.log residuales en rutas (no auditado) |
| E5 | Bug historial_pedido.estado_anterior corregido | ✅ | scheduled.ts — p.estado en lugar de 'enviado' hardcodeado |

---

## BLOQUE F — DATOS Y DEMO

| # | Criterio | Estado | Evidencia / Nota |
|---|---------|--------|-----------------|
| F1 | Dataset seed con expedientes en todos los estados | ⚠️ | Pendiente P2.2 — 7 expedientes actuales, insuficiente para demo |
| F2 | Seed con VPs completas (agendado + facturado) | ❌ | Pendiente P2.2 |
| F3 | Dashboard con KPIs > 0 significativos | ❌ | Depende de P2.2 |
| F4 | Alertas activas visibles en bandeja | ⚠️ | Existen algunas, no son suficientes para demo convincente |

---

## BLOQUE G — MÓDULOS PENDIENTES O INCOMPLETOS

| Módulo | Estado | Notar en demo |
|--------|--------|--------------|
| PDF pipeline (partes operario) | ❌ STUB | Banner "PDF pendiente" — NO prometer descarga |
| Portal peritos (apps/expert-portal) | ❌ Directorio vacío | No mostrar |
| Portal cliente (apps/customer-portal) | ❌ Directorio vacío | No mostrar |
| Portal proveedor (apps/supplier-portal) | ❌ Directorio vacío | No mostrar |
| Email automático al emitir tracking link | ❌ EP-12 Sprint 1 | No prometer automatización todavía |
| ETL/migración PWGS→ERP | ❌ Solo docs | No mostrar como operativo |
| Arquitectura DDD (packages/application, /infrastructure) | ❌ Vacíos | No vender como fortaleza técnica |
| Firma digital de documentos VP | ❌ Solo columna DB | No mostrar |

---

## VEREDICTO FINAL (2026-03-19)

| Escenario | Estado |
|-----------|--------|
| Demo a negocio | ⚠️ **Posible tras completar P1 + P2.2** |
| Feedback operativo interno | ⚠️ **Posible tras completar P1 completo + P2 completo** |
| Piloto controlado externo | ❌ **Requiere P3.1 (PDF real) + dry-run ETL + D1-D6** |

Próxima acción bloqueante: aplicar migración 20260319120000 en Supabase remoto + completar P1.3 (wrangler.toml producción).
