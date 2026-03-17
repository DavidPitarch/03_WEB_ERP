# Plan de ejecución por fases

## Fase 0 — Fundaciones (COMPLETADA)
- [x] Documento de arquitectura
- [x] ADRs iniciales (5)
- [x] Monorepo y scaffold base
- [x] Modelo de dominio (tipos + máquina de estados)
- [x] Migraciones SQL (schema + RLS)
- [x] Seed (roles, permisos, catálogos)
- [x] Edge API base (Hono + auth middleware + rutas)
- [x] Frontend base backoffice-web (login + layout + routing)
- [x] Contrato de APIs v1
- [x] README de arranque

## Fase 1 — Primer vertical slice (COMPLETADA)
- [x] Login funcional
- [x] Layout autenticado
- [x] Listado de expedientes con filtros y paginación
- [x] Detalle de expediente (datos + asegurado + compañía + operario)
- [x] Timeline cronológica
- [x] Creación de cita (modal)
- [x] Transición controlada de estado con precondiciones
- [x] Historial de estados
- [x] Auditoría básica
- [x] Eventos de dominio registrados

## Fase R1 — Núcleo transaccional (COMPLETADA)
- [x] Alta de expediente completa (formulario UI + backend + asegurado nuevo/existente)
- [x] Ingesta estructurada (`POST /intake/claims` con deduplicación triple)
- [x] Timeline operativa unificada (estados + citas + comunicaciones + filtros)
- [x] Comunicaciones base (crear nota interna desde detalle)
- [x] Maestros: compañías (CRUD completo + UI)
- [x] Maestros: operarios (CRUD completo + UI con gremios)
- [x] Maestros: asegurados (búsqueda + alta)
- [x] Maestros: empresas facturadoras + catálogos
- [x] Bandejas con contadores por estado
- [x] Realtime operacional (expedientes, citas, comunicaciones, historial)
- [x] Buscador universal en header (expedientes + asegurados)
- [x] Watchdog: informes caducados (vista SQL + bandeja + página)
- [x] Selector de operario en modal de cita (reemplaza UUID manual)
- [x] Seed datos de prueba (5 compañías, 4 operarios, 5 asegurados, 7 expedientes)
- [x] Tests unitarios máquina de estados (vitest)
- [x] Migración SQL R1 (origen, referencia_externa, full-text search, vistas)
- [x] Documentación API actualizada (18 endpoints)

## Fase R1-B — Operación mínima viable: PWA operario (COMPLETADA)
- [x] Migración SQL R1-B (resultado_visita enum, extensión partes_operario, evidencias, RLS operario, vista agenda)
- [x] Operator PWA shell (Vite + React + PWA manifest + mobile-first CSS)
- [x] Login operario
- [x] Agenda del operario (agrupada por fecha, badges de estado)
- [x] Detalle de expediente restringido (datos siniestro + asegurado + citas + acciones rápidas)
- [x] Parte digital completo (resultado visita, trabajos, materiales, observaciones, nueva visita)
- [x] Captura de evidencias (foto/archivo + clasificación antes/durante/después/general + signed URL upload)
- [x] Firma del cliente (canvas táctil + guardado en Storage)
- [x] Offline queue (localStorage + sincronización)
- [x] 7 endpoints backend operario (agenda, claim detail, timeline, submit parte, upload init/complete, evidencias)
- [x] Recepción de partes en backoffice (sección partes en detalle expediente)
- [x] CORS actualizado para PWA (puerto 5174)
- [x] Scripts dev:pwa y dev:all en monorepo
- [x] Tipos compartidos actualizados (AgendaItem, OperatorClaimDetail, CreateParteRequest, etc.)

## Fase R1-B.2 — Cierre flujo operario end-to-end (COMPLETADA)
- [x] API client robusto (token refresh, error handling, retry en uploads, detección offline)
- [x] Offline queue integrada (enqueue en fallo de red, sync on reconnect, drafts locales)
- [x] Network status reactivo (indicador Sin conexión, auto-sync al reconectar)
- [x] PWA configurada (VitePWA + Workbox, NetworkFirst para agenda/claims, cache de assets)
- [x] EvidenceUploader con error feedback (progreso, fallos por archivo, validación tamaño 20MB)
- [x] PartFormPage con draft persistence (auto-guardado local, restauración al reabrir)
- [x] PartFormPage con fallback offline (enqueue automático si falla envío)
- [x] Backoffice: partes enriquecidos (firma, evidencias detalladas, materiales, motivo, teléfono operario)
- [x] Migración SQL R1-B.2 (storage policies documentadas, vista v_partes_backoffice, índice partes por cita, RLS SELECT operario)
- [x] Tests: acceso operario, validación parte por resultado, evidencias, firma, ParteRecibido, timeline, informes caducados
- [x] Seed: cita programada hoy para demo E2E, instrucciones link operario→auth user
- [x] ADR-006: decisión PWA vs nativa
- [x] API docs actualizados con todos los endpoints operator

## Fase R1 Closure + R2-A — Excepciones operacionales y validación técnica (COMPLETADA)
- [x] Migración 00006: enums parte_validacion_estado, causa_pendiente, columnas extendidas, vistas, RLS, índices
- [x] Rutas partes: GET pendientes, GET :id, POST validar, POST rechazar (con audit + events + timeline)
- [x] Rutas tareas: GET list con filtros, POST create, PUT update
- [x] PDF pipeline stub: enqueue → documentos table → future worker
- [x] PDF enqueue integrado en flujo de validación de parte
- [x] Registro de rutas /partes y /tareas en index.ts
- [x] GET /bandejas/partes-pendientes (contador)
- [x] Transición FINALIZADO: requiere parte validado (precondición enforced)
- [x] Causa pendiente tipificada en transiciones (set/clear automático)
- [x] Backoffice: PartesValidacionPage (bandeja + validar/rechazar con motivo)
- [x] Backoffice: InformesCaducadosPage mejorada (filtros tipo_siniestro, dias_retraso)
- [x] Navegación: "Validar partes" en header nav
- [x] Hooks: usePartesPendientes, useValidarParte, useRechazarParte
- [x] CSS: estilos partes validación, filtros, badges resultado, rechazo inline
- [x] Tests: PDF pipeline, validación/rechazo parte, FINALIZADO blocking, causa pendiente, informes caducados

## R1 Acceptance Checklist
- [x] Expediente lifecycle: NUEVO → ASIGNADO → EN_CURSO → FINALIZADO (con parte validado) → CERRADO
- [x] Operator PWA: login → agenda → detalle → parte + firma + evidencias → submit (online & offline)
- [x] Backoffice: recepción partes → bandeja validación → validar/rechazar con audit trail
- [x] PDF pipeline: validar parte → documento encolado en tabla documentos con estado pendiente
- [x] Informes caducados: citas pasadas sin parte → filtrable por tipo y dias retraso
- [x] Causa pendiente: transición a PENDIENTE_* registra causa tipificada, se limpia al salir
- [x] FINALIZADO bloqueado sin parte validado
- [x] Tareas internas: CRUD con filtros (expediente, asignado, completada)
- [x] Audit trail completo: todas las acciones de validación/rechazo generan audit + domain event + comunicación timeline
- [x] Realtime: tareas_internas, documentos, partes_operario publicados

## Fase R2-A.2 — EP-06 Excepciones operativas + EP-07 Base económica (COMPLETADA)

### EP-06: Control operacional y task manager
- [x] Migración 00007: tareas extendidas (estado, posponer, resolver, comentarios), alertas, sla_pausas, calendario_laboral
- [x] Tareas: CRUD completo + posponer + resolver + comentarios + métricas (tiempo medio resolución)
- [x] UI Tareas: vista lista + vista kanban básica + filtros + modal detalle + crear/resolver/posponer/comentar
- [x] Alertas persistentes: tabla + CRUD + generate automático (tareas vencidas, SLA próximo, partes pendientes antiguos, pendientes sin revisión)
- [x] AlertBanner global: visible en toda pantalla, no desaparece hasta resolver/posponer/descartar, prioridad visual
- [x] Contador de alertas en header nav
- [x] SLA engine: cálculo tiempo efectivo con pausas, festivos/calendario laboral, clasificación ok/warning/critical/vencido
- [x] SLA pausa automática: al entrar en PENDIENTE* se registra pausa, al salir se cierra
- [x] GET /expedientes/:id/sla endpoint
- [x] Watchdogs extendidos: tareas vencidas, pendientes sin revisión, partes pendientes antigüedad > 3 días

### EP-07: Base económica estructural
- [x] Migración 00007: baremos extendidos (tipo, operario_id, especialidad, precio_operario), presupuestos extendidos (margen, coste, parte_id, líneas con descuento/IVA/subtotal)
- [x] Baremos: CRUD + importador CSV (parseo semicolons, secciones como especialidad, precios con coma decimal)
- [x] UI Baremos: listado + filtro tipo + importar CSV modal + ver partidas modal con filtro especialidad
- [x] Presupuestos: CRUD + agregar/editar/eliminar líneas + recalcular totales + aprobar
- [x] UI Presupuesto: detalle con resumen (ingreso/coste/margen/total) + tabla líneas + agregar desde baremo
- [x] Margen previsto: cálculo ingreso - coste por expediente, visible en UI
- [x] Relación parte ↔ presupuesto (parte_id en presupuestos y líneas)
- [x] Tipos compartidos: TareaInterna, Alerta, Baremo, PartidaBaremo, Presupuesto, LineaPresupuesto, SlaStatus

### Transversal
- [x] 59 tests (21 operator + 14 pipeline + 24 R2-A.2: tareas, alertas, SLA, CSV, presupuesto, margen, facturación bloqueada)
- [x] Hooks: useTareas, useAlertas, useBaremos, usePresupuestos (con react-query)
- [x] CSS: kanban, métricas, alertas, presupuesto resumen, partida picker, badges prioridad/estado
- [x] Rutas registradas en index.ts: /alertas, /baremos, /presupuestos
- [x] Navegación backoffice: Tareas, Baremos en nav + presupuestos/:id ruta

## Fase R2-B — EP-08 Facturación, cobro y tesorería (COMPLETADA)

### Diseño económico
- [x] Contrato económico EP-08: series, estados factura/cobro, campos, validaciones V1-V7, permisos, protocolos envío, seguimiento cobro, exportación CSV

### Backend (12 endpoints en /facturas)
- [x] Migración 00008: series_facturacion, seguimiento_cobro, facturas extendidas (serie_id, compania_id, estado_cobro, canal_envio, cobrada_at), lineas_factura extendidas, pagos extendidos, vistas (v_pendientes_facturar, v_facturas_caducadas, v_facturas_listado), seed series + festivos 2026
- [x] GET /facturas/pendientes — expedientes FINALIZADO sin factura no-anulada
- [x] GET /facturas/caducadas — facturas vencidas sin cobro
- [x] GET /facturas — listado con filtros (estado, estado_cobro, compañía, empresa, serie, fechas)
- [x] GET /facturas/:id — detalle con líneas + seguimiento
- [x] GET /facturas/series — series de facturación
- [x] GET /facturas/export — CSV contable
- [x] POST /facturas/emitir — emisión con 7 validaciones (V1-V7), auto-numeración desde serie, copia líneas presupuesto
- [x] POST /facturas/:id/enviar — envío por canal (email/api/portal/manual)
- [x] POST /facturas/:id/registrar-cobro — cobro parcial/total, auto estado_cobro
- [x] POST /facturas/:id/reclamar — seguimiento cobro con próximo contacto
- [x] POST /facturas/:id/anular — anulación con motivo obligatorio
- [x] POST /facturas/series — crear serie de facturación
- [x] Precondiciones estado expediente actualizadas: FACTURADO requiere factura, COBRADO requiere pago

### Frontend (4 páginas + hooks)
- [x] PendientesFacturarPage: bandeja expedientes finalizados + EmitirFacturaModal (selección serie + confirmación)
- [x] FacturasPage: listado con filtros + exportar CSV
- [x] FacturasCaducadasPage: facturas vencidas + CobroModal + ReclamarModal
- [x] FacturaDetailPage: detalle completo + líneas + seguimiento + acciones (enviar/cobrar/reclamar/anular)
- [x] useFacturas hooks (10 hooks con react-query)
- [x] Rutas en App.tsx: /pendientes-facturar, /facturas, /facturas-caducadas, /facturas/:id
- [x] Navegación: Pend. facturar, Facturas, Fact. caducadas en header nav
- [x] CSS: badges estado/cobro, tabla facturas, detalle, seguimiento, emitir modal, export button

### Tests EP-08
- [x] Validaciones emisión (7 reglas V1-V7)
- [x] Numeración única por serie
- [x] Pendientes de facturar: entrada/salida
- [x] Facturas caducadas: entrada/salida
- [x] Registro cobro parcial/total
- [x] Envío/reintento
- [x] Export CSV filtrado
- [x] Facturación prematura bloqueada

### Tipos compartidos EP-08
- [x] FacturaEstado, EstadoCobro, CanalEnvio, SerieFacturacion, Factura, LineaFactura, Pago, SeguimientoCobro, EmitirFacturaRequest, RegistrarCobroRequest

## Fase R2-C — EP-09 Proveedores y logística de materiales (COMPLETADA)

### Backend
- [x] Migración 00009: proveedores, pedidos_material, lineas_pedido, confirmaciones_proveedor, historial_pedido, vistas (v_pedidos_a_recoger, v_pedidos_caducados), RLS, índices, realtime
- [x] GET/POST proveedores + PUT /:id (CRUD completo)
- [x] GET/POST pedidos + GET /:id (listado con filtros, detalle con joins)
- [x] POST /pedidos/:id/enviar — token + magic link + registro envío
- [x] POST /pedidos/:id/confirmar — validación token/expiración/estado, confirmaciones_proveedor
- [x] POST /pedidos/:id/listo — marcar listo para recoger
- [x] POST /pedidos/:id/recoger — recogida con actor y timestamp
- [x] POST /pedidos/:id/cancelar — cancelación con motivo obligatorio
- [x] GET /pedidos/a-recoger — bandeja pedidos confirmados/listos
- [x] GET /pedidos/caducados — bandeja pedidos vencidos
- [x] POST /pedidos/detectar-caducados — watchdog automático
- [x] Rutas registradas en index.ts: /proveedores, /pedidos

### Frontend
- [x] ProveedoresPage: listado + filtros + crear/editar modal
- [x] PedidosPage: listado con filtros por estado/proveedor/expediente
- [x] PedidosRecogerPage: bandeja a recoger con acción recoger
- [x] PedidosCaducadosPage: bandeja caducados con cancelar/reenviar
- [x] PedidoDetailPage: detalle + líneas + historial + acciones
- [x] ExpedienteDetailPage: botón "Pedir material" + sección pedidos + CrearPedidoModal
- [x] useProveedores + usePedidos hooks (react-query)
- [x] Navegación: Proveedores, Pedidos, A recoger, Ped. caducados en header nav
- [x] CSS: badges estado pedido, detalle, historial, líneas form, especialidades

### Tests EP-09 (26 tests)
- [x] Creación pedido con líneas / sin líneas (rechazado)
- [x] Numeración PED-YYYY-NNNNN
- [x] Token confirmación generado al enviar
- [x] Confirmación válida / token expirado / token incorrecto / doble confirmación
- [x] Bandeja a recoger: entrada y salida
- [x] Detección pedidos caducados por fecha límite
- [x] Recogida con actor y timestamp
- [x] Cancelación con/sin motivo
- [x] Transición PENDIENTE_MATERIAL ↔ EN_CURSO
- [x] SLA pausa/reanudación en PENDIENTE_MATERIAL
- [x] Flujo completo de estados
- [x] Historial y eventos de dominio

### Tipos compartidos EP-09
- [x] PedidoEstado, Proveedor, PedidoMaterial, LineaPedido, ConfirmacionProveedor, CreatePedidoRequest, CreateProveedorRequest
- [x] Domain events: PedidoEnviado, PedidoCaducado, PedidoRecogido, PedidoCancelado

## Fase R3-A — Hardening transversal + EP-10 BI, reporting y autofacturación (COMPLETADA)

### Hardening mini-gate
- [x] Email real: Resend API integration con dry-run fallback (`email-sender.ts`)
- [x] Cloudflare Scheduled Worker: cron para alertas, caducados, vencidas (`scheduled.ts`)
- [x] Env extendido: RESEND_API_KEY, CONFIRM_BASE_URL
- [x] Tests RLS E2E: role isolation facturas/pedidos, permisos cobro, magic link público
- [x] UX fix: baremo importer con dropdown compañía en vez de UUID
- [x] Hardening checklist documentada

### EP-10: BI, reporting y autofacturación
- [x] Migración 00010: autofacturas, lineas_autofactura, operarios extendidos (es_subcontratado, cif, datos_fiscales, cuenta_bancaria), 7 vistas analíticas (v_dashboard_kpis, v_expedientes_rentabilidad, v_rentabilidad_por_compania, v_rentabilidad_por_operario, v_productividad_operarios, v_facturacion_detallada, v_operarios_liquidables), índices, RLS
- [x] Dashboard: GET /kpis, /rentabilidad, /rentabilidad/por-compania, /rentabilidad/por-operario, /productividad, /facturacion, /facturacion/export
- [x] Autofacturas: GET /liquidables, /, /:id; POST /generar, /:id/revisar, /:id/emitir, /:id/anular
- [x] DashboardPage: KPIs grid + tablas resumen
- [x] RentabilidadPage: expedientes + compañías + desviaciones
- [x] ReportingFacturasPage: filtros fecha + export CSV con BOM
- [x] AutofacturasPage: liquidables + listado + generar/revisar/emitir/anular
- [x] useDashboard + useAutofacturas hooks
- [x] CSS: dashboard grid, KPI cards, rentabilidad, autofactura badges
- [x] Tipos: AutofacturaEstado, DashboardKpis, ExpedienteRentabilidad, RentabilidadCompania, ProductividadOperario, Autofactura, LineaAutofactura, GenerarAutofacturaRequest
- [x] Domain events: AutofacturaGenerada, AutofacturaEmitida, FacturaEnviada

### EP-10 Tests (35+ tests)
- [x] Email sender: dry-run, factura, pedido, resultado
- [x] Scheduled worker: caducados, vencidas, alertas, partes pendientes
- [x] RLS: staff vs non-staff, cobro permisos, magic link público
- [x] Dashboard KPIs cálculo
- [x] Rentabilidad: deficitarios, desviación, margen medio
- [x] Productividad: tasa validación
- [x] Autofacturación: numeración AF-YYYY-NNNNN, subcontratados, flujo estados, totales, deduplicación partes
- [x] Reporting: CSV BOM, filtros fecha, totales

### EP-13 Preparación migración
- [x] Matriz migración PWGS → ERP (ep13-matriz-migracion.md)
- [x] Diccionario de datos maestros (ep13-diccionario-datos.md)
- [x] Reglas de deduplicación y normalización (ep13-deduplicacion.md)

### EP-13 Preparación migración (completada)
- [x] ETL scripts reproducibles con staging tables y transforms (ep13-etl-scripts.md)
- [x] Validación paralela PWGS vs ERP: conteos, checksums, integridad, spot-checks (ep13-validacion-paralela.md)
- [x] Plan de transición por perfiles con timeline T-30→T+14, training, rollback (ep13-plan-transicion.md)

## Fase R3-B — Production gate + EP-11 Portal de peritos (COMPLETADA)

### Production gate
- [x] Cron triggers activados en wrangler.toml (7:00 y 13:00 UTC)
- [x] CORS dinámico desde ALLOWED_ORIGINS env (no más dominio hardcoded)
- [x] Rate limiter IP-based en endpoints públicos (20 req/min)
- [x] Endpoint público /api/v1/public/pedidos/:id/confirmar (sin auth, con rate limit)
- [x] Magic link URL configurable via CONFIRM_BASE_URL env
- [x] Tests production gate: CORS, rate limiter, public confirm, scheduled, signed URLs, RLS role matrix (34 tests)

### EP-11: Portal de peritos
- [x] Migración 00011: peritos, dictamenes_periciales, evidencias_dictamen, v_expedientes_perito, perito_id en expedientes, RLS, índices, realtime
- [x] Rutas peritos: GET /mis-expedientes, /expedientes/:id, /dictamenes, /dictamenes/:id; POST /dictamenes, /dictamenes/:id/emitir, /dictamenes/:id/evidencias; PUT /dictamenes/:id; Admin CRUD (GET /, POST /, PUT /:id, PUT /asignar-expediente/:expedienteId)
- [x] PeritosExpedientesPage: expedientes asignados con filtros
- [x] DictamenesPage: listado + crear modal
- [x] DictamenDetailPage: formulario editable (borrador) / read-only + evidencias + emitir
- [x] PeritosAdminPage: CRUD peritos + asignar a expediente
- [x] usePeritos hooks (react-query)
- [x] CSS: badges dictamen, formulario, valoraciones grid, evidencias gallery
- [x] Tipos: Perito, DictamenPericial, EvidenciaDictamen, CreateDictamenRequest, CreatePeritoRequest, DictamenEstado
- [x] Domain events: DictamenEmitido, DictamenAceptado, DictamenRechazado
- [x] Tests EP-11: acceso restringido, auto-numeración DIC-YYYY-NNNNN, update solo borrador, emitir + PENDIENTE_PERITO, evidencias, estados lifecycle (16 tests)

## Fase R3-C — EP-11B Videoperitación Sprint 1 (COMPLETADA)

### Decisión de dirección
- [x] ADR-007: Videoperitación como bounded context propio
- [x] Bounded context document (ep11b-videoperitacion-bounded-context.md)
- [x] Flujo funcional completo (ep11b-flujo-funcional-videoperitacion.md)
- [x] Política consentimiento y retención (ep11b-consentimiento-retencion.md)
- [x] Modelo económico valoración/facturación (ep11b-modelo-economico-valoracion.md)
- [x] Catálogo eventos de dominio (ep11b-catalogo-eventos.md)
- [x] Catálogo webhooks externos (ep11b-catalogo-webhooks.md)

### Sprint 1 — Vertical slice: encargo + comunicaciones + agenda + enlace
- [x] Migración 00012: vp_videoperitaciones, vp_encargos, vp_comunicaciones, vp_intentos_contacto, vp_agenda, vp_sesiones, vp_consentimientos, vp_webhook_logs, vp_artefactos, vistas, índices, RLS
- [x] Backend: 14 endpoints en /videoperitaciones (CRUD + encargo + comunicaciones + contacto + agenda + reprogramar + cancelar + enviar-link)
- [x] Frontend: VideoperitacionesPage, VideoperitacionDetailPage, VpPendientesContactoPage, VpAgendaPage
- [x] Hooks: useVideoperitaciones (13 hooks)
- [x] CSS: badges VP estados, sections layout, comunicaciones list, agenda card
- [x] Tipos: Videoperitacion, VpEncargo, VpComunicacion, VpIntentoContacto, VpAgenda, VpSesion, VpConsentimiento + 7 domain events
- [x] Tests: 20 tests (encargo, comunicaciones, contacto, agenda, cancelar, enviar link, permisos, timeline, SLA)

### Sprints futuros (diseñados, no iniciados)
- Sprint 2: webhooks, sesiones, artefactos, grabaciones, audio, transcripción
- Sprint 3: generación informe, revisión, validación, versionado
- Sprint 4: valoración económica según baremos, líneas, aprobación
- Sprint 5: facturación servicio VP, envío informe, seguimiento cobro

### NO iniciado (confirmación explícita)
- EP-12 Customer tracking / portal cliente: NO iniciado

## Fase 2 — Completar expedientes y CRM
- [ ] Edición inline de campos del expediente
- [ ] Email operativo via Resend (stub → real)
- [ ] Plantillas de email
- [ ] Webhook de email entrante → crear comunicación
- [ ] Bandejas por rol (tramitador vs supervisor)
- [ ] SLA: alertas visuales cuando se acerca fecha límite
- [ ] Notas enriquecidas (menciones, adjuntos)

## Fase 3 — Operarios y planificación avanzada
- [ ] Vista semanal/diaria del planificador
- [ ] Reasignación de citas con motivo
- [ ] Notificación de cita al operario (Resend)
- [ ] Smart dispatch (gremio + zona + disponibilidad)
- [ ] Control SLA: cron trigger + alertas

## Fase 4 — PWA operario
- [ ] Scaffold operator-pwa
- [ ] Login operario (rol restringido)
- [ ] Agenda del día
- [ ] Detalle de expediente (vista reducida)
- [ ] Captura de fotos + notas
- [ ] Envío de parte
- [ ] Firma del cliente
- [ ] Service worker + offline queue

## Fase 5 — Partes y validación
- [ ] Recepción de partes desde PWA
- [ ] Bandeja de partes pendientes de validar
- [ ] Validación de parte → habilita FINALIZADO
- [ ] Generación async de PDF (Cloudflare Queue)

## Fase 6 — Facturación
- [ ] Presupuesto jerárquico (partidas de baremo)
- [ ] Generación de factura
- [ ] Bandeja: finalizados sin factura
- [ ] Bandeja: facturas vencidas
- [ ] Registro de pago / conciliación

## Fase 7 — Logística
- [ ] Pedido de material desde expediente
- [ ] Portal proveedor (magic link)
- [ ] Watchdog: pedidos caducados

## Fase 8 — Watchdogs y automatización
- [ ] Cron: informes caducados (email)
- [ ] Cron: facturas vencidas
- [ ] Queue: email desacoplado
- [ ] DLQ y reintentos

## Fase 9 — Portales externos
- [ ] Portal perito
- [ ] Portal cliente (tracking + NPS)
- [ ] Portal proveedor

## Fase 10 — BI y gerencia
- [ ] Vistas SQL analíticas
- [ ] Dashboard gerencial
- [ ] Exportaciones CSV

## Fase 11 — Migración legacy
- [ ] Staging tables PWGS
- [ ] Diccionario equivalencias
- [ ] Scripts transformación
