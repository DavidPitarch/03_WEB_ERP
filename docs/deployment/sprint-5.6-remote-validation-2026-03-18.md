# Sprint 5.6 - Evidencia remota de cierre de gate

Fecha: 2026-03-18
Estado: validacion remota completada
Decision operativa: GO tecnico alcanzado
EP-12: sigue cerrado

## 1. Entorno remoto validado

- Worker desplegado: `https://erp-siniestros-api.david-pitarch.workers.dev`
- Health remoto: `200 OK`
- Version desplegada: `d5733d4d-c57c-46ff-bd6c-3b4daaa9c462`
- Schedules activos:
  - `0 7 * * *`
  - `0 13 * * *`

## 2. Dataset VP realista usado

- Tag: `sprint56-2026-03-18-r2`
- Expediente: `EXP-2026-00005`
- `expediente_id`: `1fb5d0a4-ac13-446a-aae8-1083516b373e`
- `videoperitacion_id`: `92b9b498-89ca-4d29-b82c-108cd65482e4`
- `numero_caso`: `VP-2026-00002`
- `agenda_id`: `31624b1c-6e95-44db-a4cf-63e640e36b65`
- `sesion_id`: `207f8c45-4eb7-4f60-94e7-158d9d122c83`
- `artefacto_id`: `d9a11489-828b-4ccc-a1dd-0e0542c1152b`
- `transcripcion_id`: `c7769db3-a402-4d7c-b2e7-fe895f7f7b88`
- `dictamen_id`: `4d7b4184-4e80-4bb1-aba0-1cb2a97de800`
- `informe_id`: `fdbe852e-3368-4513-a9d4-31ea5a3ea02c`
- `valoracion_id`: `e4836f71-e820-45d7-b511-9af60dc1d2d5`
- `documento_final_id`: `511fadbc-e283-4d17-a4a3-2a309b9a06b7`
- `factura_id`: `6c29ed28-066c-4ac9-9351-3fbb66952584`
- `envio_id`: `55135cef-2421-4643-aad4-08bf45f49b80`
- `pedido_id`: `2e070a10-6bb3-409d-ad78-9ed811a560da`
- `storage_path`: `92b9b498-89ca-4d29-b82c-108cd65482e4/sprint56-sprint56-2026-03-18-r2-artefacto.txt`

## 3. Evidencia E2E documental

Prueba ejecutada contra backend remoto desplegado:

- `GET /health` -> `200`
- `GET /api/v1/videoperitaciones/artefactos/:id/signed-url` -> `200`
- `expires_in` -> `900`
- consumo de signed URL -> `200`
- acceso publico directo a storage -> `400`
- acceso autenticado directo sin signed URL -> `400`
- `vp_accesos_artefacto` tras las pruebas -> `3` registros

Visibilidad backend remota sobre el caso VP:

- `GET /api/v1/videoperitaciones/:id/documento-final` -> `200`
- `GET /api/v1/videoperitaciones/:id/envios` -> `200`
- `GET /api/v1/videoperitaciones/:id/artefactos` -> `200`
- `GET /api/v1/videoperitaciones/:id/transcripciones` -> `200`
- `GET /api/v1/videoperitaciones/:id/dictamenes` -> `200`
- `GET /api/v1/videoperitaciones/:id/informes` -> `200`
- `GET /api/v1/videoperitaciones/:id/valoracion` -> `200`

## 4. Evidencia RLS por rol sobre dataset VP

Acceso directo a Supabase REST con usuarios reales:

| Rol | VP | Artefactos | Transcripciones | Informes | Documento final | Envios |
|---|---:|---:|---:|---:|---:|---:|
| perito asignado | 1 | 1 | 1 | 1 | 1 | 1 |
| operario | 0 | 0 | 0 | 0 | 0 | 0 |

Interpretacion:

- el perito asignado tiene visibilidad positiva real sobre su caso
- el operario sigue bloqueado sobre superficie VP/documental
- no se han reabierto accesos indebidos sobre finanzas o documentos generales

## 5. Evidencia de watchdogs / jobs remotos

Invocacion remota:

- `POST /api/v1/internal/run-scheduled` -> `200`

Primer disparo remoto efectivo:

- `pedidos_caducados.marked` -> `1`
- `facturas_vencidas.marked` -> `2`
- `informes_caducados.count` -> `0`

Estado persistido tras la ejecucion:

- pedido dataset -> `caducado`
- `pedido_caducado_at` -> `2026-03-18T21:22:20.33+00:00`
- factura dataset -> `emitida`
- `estado_cobro` -> `vencida`
- `fecha_vencimiento` -> `2026-03-17`

Segundo disparo de comprobacion:

- `pedidos_caducados.marked` -> `0`
- `facturas_vencidas.marked` -> `0`
- confirma comportamiento idempotente tras regularizacion inicial

## 6. Correcciones aplicadas durante Sprint 5.6

- [internal.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/routes/internal.ts): nuevo endpoint interno para disparo remoto controlado de scheduled tasks
- [scheduled.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/scheduled.ts): extraccion de `runScheduledTasks(env)` reutilizable por cron y por endpoint interno
- [index.ts](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/src/index.ts): montaje protegido de `/api/v1/internal` para `admin`
- [sprint56-seed-vp-dataset.mjs](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/scripts/sprint56-seed-vp-dataset.mjs): seed VP realista, autocreacion de rol faltante y correccion de `solicitado_por` en `pedidos_material`
- [sprint56-validate-remote-gate.mjs](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/apps/edge-api/scripts/sprint56-validate-remote-gate.mjs): validacion remota E2E y correccion de filtros PostgREST para medir RLS real
- [20260318213000_fix_vp_perito_rls.sql](c:/Users/david.pitarch/Documents/_PROYECTOS/03_WEB%20ERP/supabase/migrations/20260318213000_fix_vp_perito_rls.sql): restauracion de visibilidad directa para perito asignado en `vp_videoperitaciones` y `vp_envios`

## 7. Incidencias encontradas

1. faltaba `solicitado_por` en el dataset de `pedidos_material`; corregido en el seed
2. el tag inicial `sprint56-2026-03-18` quedo parcialmente sembrado y bloqueo el rerun por `idx_expedientes_ref_externa`; se uso el tag limpio `sprint56-2026-03-18-r2`
3. la validacion RLS inicial reporto falsos negativos por filtros PostgREST mal formados; corregido
4. faltaba acceso directo positivo del perito a `vp_videoperitaciones` y `vp_envios`; corregido con migracion remota

## 8. Conclusiones

Los tres gaps remotos que mantenian el `NO-GO condicionado` han quedado cubiertos con evidencia real:

1. acceso documental extremo a extremo desde backend remoto
2. dataset VP real con validacion positiva y negativa por rol
3. ejecucion remota verificable de watchdogs con efecto persistido

Sprint 5.6 deja preparado el arranque de EP-12 Sprint 1, pero EP-12 no se abre en esta entrega.
