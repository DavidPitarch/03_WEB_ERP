# Sprint 5.5 - Production gate final

Fecha: 2026-03-18
Decision: NO-GO condicionado
EP-12: cerrado

## 1. Checklist GO / NO-GO

| Control | Evidencia | Estado |
|---|---|---|
| Bootstrap remoto | `docs/deployment/sprint-5.5-remote-gate-results-2026-03-18.md` | OK |
| Buckets privados | `documentos`, `evidencias`, `vp-artefactos` creados | OK |
| Seed minima | compania, empresa facturadora, usuarios y operario activo presentes | OK |
| RPC core remotos | expediente, cita, transicion, rollback, concurrencia | OK |
| RLS por rol | admin, supervisor, financiero, operario validados | OK |
| Signed URL | valida a nivel Supabase / service role; acceso directo denegado | OK parcial |
| Documento final VP | endpoint y reglas cerradas | OK local |
| Envios VP | envio, reintento y acuse trazables en backend | OK local |
| Watchdogs | logica y cron configurados | OK local |
| Evidencia remota watchdog | ejecucion remota del worker | PENDIENTE |
| Dataset VP real | validacion positiva remota | PENDIENTE |
| Artefactos EP-13 | paquete final publicado | OK |

## 2. Condiciones para pasar a GO

1. validar el acceso documental extremo a extremo contra el backend remoto desplegado
2. ejecutar una videoperitacion positiva remota con artefactos reales, documento final, envio y acuse
3. obtener evidencia remota de ejecucion del worker programado

## 3. Cierre de Sprint 5.5

Sprint 5.5 queda cerrado en su alcance documental, de hardening y de base remota. No queda autorizada la apertura de EP-12 hasta convertir este gate en `GO`.
