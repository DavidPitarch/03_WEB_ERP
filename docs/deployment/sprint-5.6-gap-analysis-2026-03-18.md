# Sprint 5.6 - Gap analysis

Fecha: 2026-03-18
Objetivo: cerrar el `NO-GO condicionado` heredado de Sprint 5.5
Resultado: gaps cerrados
EP-12: sigue cerrado

## 1. Gaps de entrada

| ID | Gap heredado | Estado inicial |
|---|---|---|
| G1 | validacion E2E del acceso documental desde backend remoto | abierto |
| G2 | dataset VP real para validacion positiva completa de permisos | abierto |
| G3 | evidencia remota de watchdogs / jobs | abierto |

## 2. Cierre ejecutado

| ID | Resolucion | Evidencia | Estado final |
|---|---|---|---|
| G1 | signed URL y proxy/backend remoto validados extremo a extremo; acceso directo denegado | `docs/deployment/sprint-5.6-remote-validation-2026-03-18.md` | cerrado |
| G2 | dataset VP realista sembrado y permisos validados en positivo para perito y en negativo para operario | `docs/deployment/sprint-5.6-remote-validation-2026-03-18.md` | cerrado |
| G3 | endpoint interno protegido para scheduled tasks, ejecucion remota y efectos persistidos en pedido/factura | `docs/deployment/sprint-5.6-remote-validation-2026-03-18.md` | cerrado |

## 3. Archivos, scripts y configuracion tocados

- [internal.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/routes/internal.ts)
- [scheduled.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/scheduled.ts)
- [index.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/index.ts)
- [sprint56-seed-vp-dataset.mjs](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/scripts/sprint56-seed-vp-dataset.mjs)
- [sprint56-validate-remote-gate.mjs](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/scripts/sprint56-validate-remote-gate.mjs)
- [20260318213000_fix_vp_perito_rls.sql](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/supabase/migrations/20260318213000_fix_vp_perito_rls.sql)

Configuracion remota verificada:

- worker `erp-siniestros-api` desplegado en Cloudflare Workers
- schedules activos `0 7 * * *` y `0 13 * * *`
- variables remotas conservadas con `--keep-vars`

## 4. Riesgos residuales

- no queda gap bloqueante para abrir EP-12 Sprint 1
- el dataset inicial `sprint56-2026-03-18` quedo parcial y solo debe considerarse evidencia de iteracion fallida, no dataset de referencia
- conviene mantener el endpoint interno de scheduled tasks solo para `admin` y fuera de superficies publicas

## 5. Decision

- Sprint 5.6 queda cerrado
- el gate final pasa de `NO-GO condicionado` a `GO`
- EP-12 sigue cerrado por decision de project management, pero ya puede proponerse su apertura tecnica
