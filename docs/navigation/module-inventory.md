# Inventario de Módulos — Navegación Backoffice ERP

**Última revisión:** 2026-03-20

Leyenda de estado:
- ✅ `implemented` — Página completa con backend y UI funcional
- ⚠️ `partial` — Backend existe o UI limitada / solo filtro / stub con datos reales
- 🔵 `conceptual` — Definido en dominio, sin desarrollo
- 🆕 `new` — No definido todavía, scaffold + placeholder

---

## ENTRADA

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Asignaciones | `/asignaciones` | ⚠️ partial | ✅ `/asignaciones` + `/bandejas` | AsignacionesPage | Bandeja completa pendiente de diseño |
| Solicitudes / Avisos | `/solicitudes` | ⚠️ partial | ✅ `/alertas` | SolicitudesPage | UI básica, falta diseño de bandeja |
| Comunicaciones | `/comunicaciones` | ⚠️ partial | ✅ `/comunicaciones` | PlaceholderPage | Ruta backend existe, UI pendiente |

---

## OPERACIONES

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Siniestros (todos) | `/expedientes` | ✅ | ✅ | ExpedientesPage | Completo con filtros, paginación |
| Siniestros activos | `/expedientes?estado=EN_CURSO` | ⚠️ partial | ✅ | ExpedientesPage (filter) | Usa la misma página con querystring |
| Siniestros pendientes | `/expedientes?estado=PENDIENTE` | ⚠️ partial | ✅ | ExpedientesPage (filter) | Ídem |
| Siniestros finalizados | `/expedientes?estado=FINALIZADO` | ⚠️ partial | ✅ | ExpedientesPage (filter) | Ídem |
| Trabajos no revisados | `/partes-validacion` | ✅ | ✅ | PartesValidacionPage | Validación y rechazo de partes |
| Informes caducados | `/informes-caducados` | ✅ | ✅ | InformesCaducadosPage | Citas sin parte presentado |
| Presupuestos (detalle) | `/presupuestos/:id` | ✅ | ✅ | PresupuestoPage | Detalle completo |
| Presupuestos (lista) | `/presupuestos` | ⚠️ partial | ✅ | PlaceholderPage | **GAP:** falta página de listado |

---

## PLANNING

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Agenda mensual | `/planning/agenda` | 🆕 new | ⚠️ `/citas` existe | PlaceholderPage | Necesita vista calendario |
| VP Agenda | `/videoperitaciones/agenda` | ✅ | ✅ | VpAgendaPage | Completo |
| Videoperitaciones (lista) | `/videoperitaciones` | ✅ | ✅ | VideoperitacionesPage | Completo |
| VP Pendientes contacto | `/videoperitaciones/pendientes` | ✅ | ✅ | VpPendientesContactoPage | Completo |
| Planning geográfico | `/planning/geo` | ⚠️ partial | ✅ `/planning` | PlanningGeoPage | Feature flag activo |

---

## RED EXTERNA

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Operarios | `/operarios-config` | ⚠️ partial | ✅ | OperariosConfigPage | UI básica |
| Proveedores | `/proveedores` | ✅ | ✅ | ProveedoresPage | Completo |
| Peritos (admin) | `/peritos/admin` | ✅ | ✅ | PeritosAdminPage | Completo |
| Mis expedientes (perito) | `/peritos/expedientes` | ✅ | ✅ | PeritosExpedientesPage | Vista del perito |
| Dictámenes | `/peritos/dictamenes` | ✅ | ✅ | DictamenesPage + DictamenDetailPage | Completo |
| Clientes / Intervinientes | `/clientes` | ⚠️ partial | ⚠️ | ClientesPage | UI stub |
| Rentings | `/rentings` | 🆕 new | ❌ | PlaceholderPage | Feature flag desactivado |

---

## BUZÓN CORREO

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Cuentas correo | `/correo/cuentas` | 🆕 new | ❌ | PlaceholderPage | Requiere integración Resend/IMAP |
| Configuración correo | `/correo/configuracion` | 🆕 new | ❌ | PlaceholderPage | Configuración de plantillas y SMTP |

---

## FINANZAS

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Pendientes de facturar | `/pendientes-facturar` | ✅ | ✅ | PendientesFacturarPage | Completo |
| Facturas | `/facturas` | ✅ | ✅ | FacturasPage + FacturaDetailPage | Completo |
| Facturas caducadas | `/facturas-caducadas` | ✅ | ✅ | FacturasCaducadasPage | Completo |
| Autofacturas | `/autofacturas` | ✅ | ✅ | AutofacturasPage | Completo |
| Pedidos | `/pedidos` | ✅ | ✅ | PedidosPage + Detail | Completo |
| Pedidos a recoger | `/pedidos/a-recoger` | ✅ | ✅ | PedidosRecogerPage | Completo |
| Pedidos caducados | `/pedidos/caducados` | ✅ | ✅ | PedidosCaducadosPage | Completo |
| Config. emisión | `/config-emision` | ✅ | ✅ | ConfigEmisionPage | Series, numeración, ctas. bancarias |
| Series de facturación | `/series-facturacion` | ⚠️ partial | ✅ | SeriesFacturacionPage | UI stub |
| Bancos | `/bancos` | ⚠️ partial | ✅ `/bancos` | BancosPage | Feature flag desactivado, UI stub |

---

## CONTROL

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Baremos | `/baremos` | ✅ | ✅ | BaremosPage | Completo |
| Tareas | `/tareas` | ✅ | ✅ | TareasPage | Completo |
| Eventos / Automatizaciones | `/eventos` | ⚠️ partial | ⚠️ | EventosPage | UI stub |
| Mensajes predefinidos | `/mensajes-predefinidos` | ⚠️ partial | ⚠️ | MensajesPredefinidosPage | UI stub |
| Encuestas | `/encuestas` | ⚠️ partial | ❌ | EncuestasPage | Feature flag desactivado |
| Documentos | `/control/documentos` | 🆕 new | ⚠️ Storage existe | PlaceholderPage | Necesita UI de gestión documental |
| Auditoría | `/control/auditoria` | ⚠️ partial | ✅ `audit.ts` service | PlaceholderPage | **GAP:** falta endpoint y UI de auditoría |

---

## CONFIGURACIÓN

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Usuarios y roles | `/usuarios` | ⚠️ partial | ✅ auth | UsuariosPage | UI stub |
| Compañías / Corredores / AF | `/companias` | ⚠️ partial | ✅ | CompaniasPage | UI stub |
| Empresas | `/empresas` | ⚠️ partial | ✅ | EmpresasPage | UI stub (también en /maestros) |
| Especialidades | `/especialidades` | ⚠️ partial | ✅ | EspecialidadesPage | UI stub |
| Calendario laboral | `/calendario` | ⚠️ partial | ✅ `/calendario` | CalendarioOperativoPage | UI stub |
| Autocita | `/autocita` | ⚠️ partial | ✅ `/autocita` | AutocitaPage | Feature flag desactivado |
| Maestros (legacy) | `/maestros` | ✅ | ✅ | MaestrosPage | Mantener hasta migración completa |

---

## DIRECCIÓN

| Módulo | Ruta | Estado | Backend | UI | Notas |
|--------|------|--------|---------|-----|-------|
| Dashboard | `/dashboard` | ✅ | ✅ | DashboardPage | Completo |
| Rentabilidad | `/rentabilidad` | ✅ | ✅ | RentabilidadPage | Completo |
| Informes | `/reporting-facturas` | ✅ | ✅ | ReportingFacturasPage | Completo |

---

## Resumen estadístico

| Estado | Módulos | % |
|--------|---------|---|
| ✅ Implementado | 22 | 47% |
| ⚠️ Parcial | 19 | 40% |
| 🆕 Nuevo/Conceptual | 6 | 13% |
| **Total** | **47** | |

---

## Cockpit (Top 3 módulos)

| Módulo | Feed key | Endpoint | Estado |
|--------|----------|----------|--------|
| Asignaciones | `asignaciones` | `GET /cockpit/feed` | ⚠️ partial |
| Solicitudes/Avisos | `solicitudes` | `GET /cockpit/feed` | ⚠️ partial |
| Trabajos no revisados | `trabajos_no_revisados` | `GET /cockpit/feed` | ✅ |
