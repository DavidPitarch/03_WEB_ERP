# Plan Integrado — Remediacion Base + Sprint 5.5

> Fecha: 2026-03-17
> Estado: Aprobado para ejecucion
> Decision vigente: EP-11B Sprint 5 aceptado funcionalmente. EP-12 Customer Tracking sigue cerrado.

## 1. Validacion del reporte recibido

El reporte de Sprint 5.5 es correcto en direccion y alcance, pero no debe ejecutarse como un sprint aislado. Debe integrarse detras del plan de remediacion ya definido porque hoy hay tres bloqueos previos:

1. seguridad/API insuficiente en rutas y uso de `service_role`
2. mutaciones criticas sin atomicidad ni garantias completas de trazabilidad
3. build del backoffice no estable al 100%

Conclusion:

- Si, el contenido del reporte se integra en el plan.
- No, no debe saltarse por delante de las fases de contencion de seguridad y transacciones.
- EP-12 no se abre hasta cerrar este plan y pasar la checklist de apertura.

## 2. Orden ejecutivo de ejecucion

### Fase 0 — Contencion inmediata

Objetivo: eliminar exposicion indebida antes de tocar nuevas superficies.

Entregables:

- cierre de acceso por rol en Edge API
- bloqueo de acceso cruzado de operarios a evidencias y expedientes ajenos
- retirada temporal o feature flag de rutas VP rotas si no compilan
- matriz minima ruta/metodo/rol para todo `/api/v1`

Criterio de cierre:

- cualquier usuario autenticado sin rol valido recibe `403`
- operario no puede listar ni adjuntar evidencias en expedientes no asignados
- no quedan rutas publicadas en UI que no compilen

### Fase 1 — Integridad transaccional del core

Objetivo: que expediente, cita, parte y transicion sean operaciones atomicas.

Entregables:

- RPCs o funciones SQL transaccionales para:
  - `crear_expediente`
  - `crear_cita`
  - `transicionar_expediente`
  - `registrar_parte`
- numeracion concurrente segura de expediente
- escritura atomica de:
  - mutacion principal
  - historial
  - auditoria
  - domain event

Criterio de cierre:

- no existe mutacion critica sin traza completa
- no existe generacion de numero por `count + 1`

### Fase 2 — Sprint 5.5 / Bloque A Hardening final de EP-11B

Objetivo: cerrar videoperitacion con nivel de produccion tecnica.

#### A1. Documento final VP

- sustituir `JSON-only` por pipeline real preparado para PDF
- mantener `vp_documento_final` como modelo estable
- introducir estados de pipeline, reintentos y auditoria
- dejar lista la extension a queue/worker aunque el render final use fallback controlado

Artefactos tecnicos:

- migracion SQL de estados/metadata de pipeline si faltan
- servicio backend de generacion
- registro de intentos y errores
- tests de versionado y reproceso

#### A2. Envio real

- integrar Resend real donde exista `dry-run`
- registrar intento, resultado, error, reintento y acuse
- fallback explicito si falta secret
- no mover a estado `enviado` tras fallo real salvo estado intermedio documentado

Artefactos tecnicos:

- endurecimiento de `email-sender.ts`
- persistencia de tracking de envios VP
- pruebas de exito, fallo, dry-run y reintento

#### A3. Bugs y consistencia

- corregir bug latente `comunicaciones.insert / actor_nombre`
- alinear enums y estados SQL/backend/frontend
- revisar timeline, audit trail y domain events del flujo VP completo

Artefactos tecnicos:

- tabla de drift de enums
- tests de coherencia estado/evento/timeline
- fix de insercion de comunicaciones

#### A4. Seguridad y acceso

- endurecer RLS de tablas VP nuevas
- eliminar politicas permisivas tipo `USING (true)` en tablas sensibles
- reforzar acceso a:
  - documento final
  - valoracion
  - factura VP
  - artefactos externos
- revisar signed URLs, expiracion y auditoria de acceso

Artefactos tecnicos:

- nuevas policies SQL por rol y ambito
- logs de acceso a documento/artefacto
- tests RLS y signed URLs

#### A5. Reintentos y observabilidad

- reproceso documentado y operativo de envio fallido
- `correlation_id` de extremo a extremo
- logs estructurados minimos para flujo VP
- wiring de queues/cron documentado y probado si aplica

Artefactos tecnicos:

- contrato de log estructurado
- tabla o campos de reproceso
- pruebas de idempotencia/reintento

Criterio de cierre de la fase 2:

- EP-11B compila, pasa typecheck y tests
- documento final y envio quedan en pipeline real, no solo stub
- RLS de VP no expone datos a cualquier `authenticated`

### Fase 3 — Sprint 5.5 / Bloque B Cierre operativo de EP-13

Objetivo: dejar migracion, datos, formularios y transicion en nivel de implantacion real.

Entregables obligatorios a cerrar con artefactos accionables:

1. matriz maestra de datos
2. catalogo de formularios
3. modelo fisico consolidado
4. matriz de migracion PWGS → ERP
5. matriz de estados y automatizaciones
6. catalogo documental y plantillas
7. plan de pruebas funcionales y de datos
8. dataset representativo de validacion
9. checklist de transicion y coexistencia
10. criterios GO / NO-GO de salida definitiva

Reglas de ejecucion:

- cada artefacto debe tener ownership funcional y tecnico
- incluir reglas de deduplicacion, transformacion, obsolescencia y calidad
- incluir visibilidad por rol, estado y compania cuando aplique
- enlazar con tablas, vistas, seeds, formularios y migraciones reales

Artefactos documentales esperados:

- ampliar y corregir los docs `ep13-*` existentes
- crear dataset y plantillas reproducibles, no solo markdown descriptivo
- consolidar un documento de modelo fisico unico
- cerrar gaps de nomenclatura legado/nuevo

Criterio de cierre:

- QA, implantacion y migracion pueden ejecutar el cutover con estos artefactos sin depender de interpretacion oral

### Fase 4 — Production gate transversal

Objetivo: dejar el sistema en estado demostrablemente desplegable antes de abrir EP-12.

Entregables:

- typecheck de todos los paquetes
- tests de integracion reales para rutas criticas
- smoke test del vertical slice base y de EP-11B
- checklist de seguridad y despliegue actualizada
- control de versiones de migraciones y seeds

Criterio de cierre:

- CI verde en typecheck + tests
- sin rutas publicadas rotas
- sin migraciones con politicas permisivas pendientes

### Fase 5 — Gate de apertura de EP-12

Objetivo: definir explicitamente cuando se puede abrir Customer Tracking.

EP-12 solo puede abrirse si:

1. Fase 0 cerrada
2. Fase 1 cerrada
3. Fase 2 cerrada
4. Fase 3 cerrada
5. Fase 4 cerrada
6. checklist de apertura validada por producto y tecnica

Hasta entonces:

- EP-12 sigue cerrado
- no se crean nuevas pantallas satelite
- no se exponen nuevos portales externos

## 3. Backlog operativo priorizado

### Prioridad P0

- seguridad/API por rol
- acceso operario a evidencias
- transacciones criticas
- numeracion segura
- build roto de backoffice

### Prioridad P1

- RLS VP sensible
- pipeline real documento final
- envio real con Resend
- bug `actor_nombre`
- coherencia de enums/estados

### Prioridad P2

- observabilidad, correlation, reprocesos
- artefactos EP-13 de dataset, formularios y catalogos
- consolidacion del modelo fisico

### Prioridad P3

- cierre documental final
- checklist de apertura EP-12

## 4. Entregables obligatorios del Sprint 5.5 integrados en este plan

La salida esperada de esta fase debe incluir:

1. gap analysis de Sprint 5.5
2. archivos creados/modificados
3. migraciones anadidas o ajustadas
4. fixes de hardening implementados
5. pruebas implementadas
6. artefactos EP-13 cerrados
7. riesgos y limitaciones abiertas
8. checklist explicita para abrir EP-12
9. confirmacion explicita de que EP-12 sigue cerrado

## 5. Ownership recomendado

| Bloque | Ownership tecnico | Ownership funcional |
|---|---|---|
| Seguridad API / RLS | Staff backend + data architect | Arquitectura / direccion tecnica |
| Transacciones core | Staff backend + DBA | Operaciones |
| Documento final VP | Backend + plataforma | Responsable pericial |
| Envio real VP | Backend integraciones | Operaciones / administracion |
| EP-13 datos y migracion | Data architect + implantacion | Negocio / responsables de area |
| QA y gate EP-12 | QA + direccion tecnica | Product owner / direccion |

## 6. Restricciones vigentes

- EP-12 Customer Tracking sigue cerrado
- no crear nuevas pantallas satelite fuera del alcance
- no rehacer modulos aceptados salvo hardening/fix necesario
- no mover logica critica al frontend
- no dejar entregables EP-13 en nivel superficial

## 7. Siguiente orden de ejecucion recomendado

1. ejecutar Fase 0
2. ejecutar Fase 1
3. abrir Bloque A de Sprint 5.5
4. cerrar Bloque B de EP-13
5. pasar production gate
6. validar checklist de apertura
7. decidir si EP-12 puede abrirse
