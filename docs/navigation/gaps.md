# Gaps funcionales detectados — Navegación y Módulos ERP

**Fecha:** 2026-03-20

Documento de gaps reales identificados durante la implementación de la nueva arquitectura de navegación. No son bugs, son trabajo pendiente con su contexto técnico.

---

## GAP-001 — Filtros de estado en ExpedientesPage (parcial)

**Módulos afectados:** Siniestros activos, Siniestros pendientes, Siniestros finalizados

**Descripción:**
El sidebar tiene entradas para "Activos", "Pendientes" y "Finalizados" que navegan a `/expedientes?estado=X`. La ExpedientesPage debe leer el querystring `estado` y aplicarlo como filtro inicial al cargar.

**Estado actual:** El filtro se pasa como querystring pero no se sabe si ExpedientesPage lo consume automáticamente.

**Acción requerida:**
- Verificar que `ExpedientesPage` lee `useSearchParams()` y aplica el filtro `estado`
- Si no, añadir: `const [searchParams] = useSearchParams(); const estadoInicial = searchParams.get('estado');`

**Prioridad:** Alta (es confuso para el operario que el link no filtre)

---

## GAP-002 — Página de listado de Presupuestos

**Módulo afectado:** Operaciones > Presupuestos

**Descripción:**
Existe `PresupuestoPage` (detalle de un presupuesto) pero no existe una página de listado en `/presupuestos`. El backend tiene el endpoint `/presupuestos` que devuelve la lista.

**Estado actual:** Ruta `/presupuestos` → PlaceholderPage

**Acción requerida:**
- Crear `PresupuestosPage.tsx` con lista paginada
- Usar hook `usePresupuestos` (verificar si existe o crear)
- Registrar la ruta en App.tsx sustituyendo el PlaceholderPage

**Prioridad:** Media

---

## GAP-003 — Filtrado por rol en el sidebar (frontend)

**Módulo afectado:** AppSidebar — todos los grupos y entradas

**Descripción:**
El nav-config define `roles` por módulo y grupo. La implementación actual del sidebar muestra todos los módulos a todos los usuarios autenticados (no hay filtrado por rol en frontend). El enforcement real es en el backend (requireRoles middleware).

**Causa:** El objeto `user` de Supabase Auth en el frontend no incluye los roles custom del ERP (que viven en la tabla `user_roles`, no en JWT).

**Opciones:**
1. **Supabase Custom JWT Claims (recomendado):** Crear una Supabase Function que inserte los roles del usuario en el JWT como `app_metadata.roles`. No requiere llamada adicional.
2. **Endpoint `/auth/profile`:** Crear un endpoint que devuelva `{ user, roles }` y llamarlo al cargar la app.
3. **Dejar como está:** El backend protege todo correctamente. El sidebar visible es solo UX, no seguridad.

**Acción requerida (opción 1):**
- Añadir Supabase Database Function + Hook que sincroniza `user_roles` → `raw_app_meta_data.roles`
- En `auth-context.tsx`: leer `user.app_metadata.roles` y exponerlo en el contexto
- En `AppSidebar.tsx`: aplicar `hasAnyRole(userRoles, entry.roles)` para filtrar

**Prioridad:** Media (seguridad está en backend; UX mejora con esto)

---

## GAP-004 — Cockpit feed con datos reales de alertas

**Módulo afectado:** TopCockpit > Solicitudes / Avisos

**Descripción:**
El endpoint `/cockpit/feed` consulta la tabla `alertas` para el módulo de solicitudes. Si la tabla `alertas` tiene una estructura diferente de la esperada o no existe, el cockpit devuelve vacío silenciosamente.

**Acción requerida:**
- Verificar schema de tabla `alertas` (campos: `id`, `tipo`, `expediente_id`, `mensaje`, `prioridad`, `created_at`, `estado`)
- Si el schema difiere, ajustar la query en `cockpit.ts`

**Prioridad:** Alta (el cockpit es el módulo más visible de la navegación)

---

## GAP-005 — Feature flags estáticos (no per-tenant)

**Módulo afectado:** nav-config.ts > FEATURE_FLAGS

**Descripción:**
Los feature flags están hardcoded en el frontend (`FEATURE_FLAGS` en nav-config.ts). En un entorno multi-tenant esto debería venir de Supabase para que cada empresa pueda activar/desactivar módulos independientemente.

**Acción requerida (futura):**
- Crear tabla `feature_flags` en Supabase: `{ tenant_id, flag_name, enabled }`
- Crear endpoint `/config/feature-flags` protegido por auth
- Crear hook `useFeatureFlags()` que reemplace el objeto estático
- Pasar el resultado a `isFeatureEnabled()` en AppSidebar

**Prioridad:** Baja (actual es suficiente para MVP)

---

## GAP-006 — Página de lista de Comunicaciones

**Módulo afectado:** Entrada > Comunicaciones

**Descripción:**
La ruta `/comunicaciones` existe en el backend (`comunicacionesRoutes`) pero la UI es un PlaceholderPage. El sidebar lo muestra como módulo parcial.

**Acción requerida:**
- Crear `ComunicacionesPage.tsx` con bandeja de mensajes por expediente
- Crear hook `useComunicaciones()` si no existe
- Integrar con el timeline del expediente para evitar duplicar datos

**Prioridad:** Alta (las comunicaciones son core del ERP)

---

## GAP-007 — Badge de facturas caducadas en sidebar

**Módulo afectado:** Finanzas > Facturas caducadas

**Descripción:**
En `useNavBadges.ts` el badge `facturas_caducadas` siempre devuelve 0. Falta el endpoint para contar facturas caducadas.

**Acción requerida:**
- Verificar si `/bandejas/facturas-caducadas` existe o crear
- Añadir query en `useNavBadges.ts`: `api.get('/bandejas/facturas-caducadas/count')`
- O extender `/bandejas/contadores` para incluir contadores de facturas

**Prioridad:** Media

---

## GAP-008 — Badge de tareas pendientes

**Módulo afectado:** Control > Tareas

**Descripción:**
En `useNavBadges.ts` el badge `tareas` siempre devuelve 0. El hook anterior usaba `useAlertasCount()` para el badge de tareas, lo cual era semánticamente incorrecto.

**Acción requerida:**
- Crear endpoint `/tareas/pendientes/count` en el backend
- Añadir query en `useNavBadges.ts`

**Prioridad:** Media

---

## GAP-009 — Página de Auditoría

**Módulo afectado:** Control > Auditoría

**Descripción:**
El servicio `audit.ts` en el backend registra acciones. No existe endpoint de lectura ni UI para consultar el log de auditoría.

**Acción requerida:**
- Crear endpoint `GET /internal/audit-log` con filtros (usuario, acción, expediente, fecha)
- Crear `AuditoriaPage.tsx` con tabla de log y filtros
- Proteger por roles admin/supervisor/dirección

**Prioridad:** Media (requerido para compliance)

---

## GAP-010 — Sidebar preference per-user (en Supabase)

**Módulo afectado:** AppSidebar

**Descripción:**
Las preferencias del sidebar (grupos abiertos/cerrados, sidebar colapsado) se guardan en localStorage del navegador. Son pérdidas al cambiar de dispositivo o en modo incógnito.

**Acción requerida (futura):**
- Crear tabla `user_preferences` en Supabase: `{ user_id, key, value }`
- Crear hook `useUserPreferences()` que sincroniza con Supabase
- Reemplazar localStorage en AppSidebar por este hook

**Prioridad:** Baja (confort de usuario, no bloqueante)

---

## Resumen de gaps por prioridad

| Prioridad | Gap | Descripción |
|-----------|-----|-------------|
| 🔴 Alta | GAP-001 | Filtros de estado en ExpedientesPage |
| 🔴 Alta | GAP-004 | Cockpit feed con datos reales |
| 🔴 Alta | GAP-006 | Página de lista de Comunicaciones |
| 🟡 Media | GAP-002 | Lista de Presupuestos |
| 🟡 Media | GAP-003 | Filtrado por rol en sidebar |
| 🟡 Media | GAP-007 | Badge facturas caducadas |
| 🟡 Media | GAP-008 | Badge tareas pendientes |
| 🟡 Media | GAP-009 | Página de Auditoría |
| 🟢 Baja | GAP-005 | Feature flags per-tenant |
| 🟢 Baja | GAP-010 | Preferencias de sidebar en Supabase |
