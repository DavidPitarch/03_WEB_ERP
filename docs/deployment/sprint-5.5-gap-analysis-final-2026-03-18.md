# Sprint 5.5 - Gap analysis final

Fecha: 2026-03-18
Estado: cierre funcional completado con riesgos remotos acotados

## 1. Cerrado

- bootstrap remoto minimo completado
- buckets privados creados: `documentos`, `evidencias`, `vp-artefactos`
- seed remota minima cargada y validada
- RPC core remotos validados: `erp_create_expediente`, `erp_create_cita`, `erp_transition_expediente`
- rollback y concurrencia basica validados
- RLS core validada por rol real
- acceso signed URL validado a nivel Supabase / service role
- fixes aplicados:
  - seed UUID corregida en `20260318183000_fix_phase0_seed_rpc_uuid.sql`
  - RLS core de `expedientes` corregida en `20260318190000_fix_expedientes_core_rls.sql`
  - CORS deduplicado en `apps/edge-api/src/index.ts`
  - hardening VP/envios: canal validado, reintento trazable y acuse explicito en backend
- artefactos EP-13 publicados

## 2. Gaps residuales

| ID | Gap | Impacto | Estado |
|---|---|---|---|
| G1 | validacion E2E del acceso documental desde backend remoto desplegado | no permite declarar GO pleno de storage extremo a extremo | abierto |
| G2 | dataset VP real para validacion positiva completa de permisos y envio | el flujo VP esta endurecido, pero falta evidencia funcional remota con caso real | abierto |
| G3 | evidencia remota de ejecucion de cron/watchdogs | la logica existe, pero falta prueba de despliegue y ejecucion remota | abierto |

## 3. Decision operativa

- Sprint 5.5 puede cerrarse documental y tecnicamente en estado `NO-GO condicionado`.
- El siguiente paso no es abrir EP-12, sino cerrar G1-G3.
- EP-12 sigue cerrado.
