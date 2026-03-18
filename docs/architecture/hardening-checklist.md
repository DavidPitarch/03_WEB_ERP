# Hardening checklist - Sprint 5.5 final

Fecha de revision: 2026-03-18

## Backend y seguridad

- [x] grupos de rol aplicados por ruta en `apps/edge-api/src/index.ts`
- [x] rate limiting en endpoints publicos sensibles
- [x] CORS consolidado sin duplicados
- [x] acceso VP a artefactos por scope y signed URL corta
- [x] reintento de envio VP trazado en timeline, auditoria y evento de dominio
- [x] acuse de envio VP expuesto en backend con persistencia explicita

## RLS y datos sensibles

- [x] RLS `00018` elimina policies VP/finanzas/documentos permisivas
- [x] validacion remota por rol realizada para core y tablas sensibles principales
- [x] correccion remota de RLS core `expedientes`
- [ ] validacion positiva remota de dataset VP real

## Storage y documental

- [x] buckets privados remotos creados
- [x] signed URL validada a nivel Supabase / service role
- [x] acceso directo autenticado sin signed URL denegado
- [ ] validacion E2E del flujo firmado via backend remoto desplegado

## Jobs y watchdogs

- [x] `scheduled.ts` implementado
- [x] `wrangler.toml` con triggers `0 7 * * *` y `0 13 * * *`
- [ ] evidencia remota de despliegue y ejecucion del worker

## Produccion

- [x] tests `@erp/edge-api` verdes
- [x] typecheck `@erp/edge-api` verde
- [ ] gate final en estado GO
