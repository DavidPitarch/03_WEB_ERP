# Navegación del Backoffice ERP — Documentación técnica

## Resumen

Esta documentación describe la arquitectura de navegación del backoffice del ERP de gestión de siniestros del hogar. Se implementó en marzo de 2026 como parte del sprint de refactorización de UX operativa.

---

## Estructura de documentación

| Documento | Descripción |
|-----------|-------------|
| [adr-001-navigation-architecture.md](./adr-001-navigation-architecture.md) | Decisiones de arquitectura: por qué este diseño |
| [module-inventory.md](./module-inventory.md) | Inventario completo de módulos con estado |
| [gaps.md](./gaps.md) | Gaps funcionales detectados y acciones requeridas |

---

## Estructura de archivos implementados

```
apps/backoffice-web/src/
├── navigation/
│   ├── types.ts              ← Tipos TS de navegación (NavEntry, NavGroup, etc.)
│   ├── permissions.ts        ← Constantes de roles para visibilidad
│   └── nav-config.ts         ← Fuente de verdad: sidebar + cockpit config
│
├── components/
│   ├── AppLayout.tsx         ← Layout principal con cockpit integrado
│   ├── AppSidebar.tsx        ← Sidebar colapsable, grupos reactivos, badges
│   └── layout/
│       ├── TopCockpit.tsx    ← Banda cockpit (3 módulos grandes)
│       └── CockpitModule.tsx ← Card individual del cockpit
│
├── hooks/
│   ├── useNavBadges.ts       ← Agregado de todos los badges del sidebar
│   └── useCockpit.ts         ← Datos del cockpit (feed + counts)
│
├── pages/
│   └── PlaceholderPage.tsx   ← Página genérica para módulos en backlog
│
└── styles/components/
    ├── sidebar.css            ← Sidebar + colapso + collapsed mode
    └── cockpit.css            ← Cockpit strip, módulos, items, skeleton

apps/edge-api/src/routes/
└── cockpit.ts                 ← GET /cockpit/feed + /cockpit/counts
```

---

## Cockpit operativo

El cockpit es la banda horizontal que aparece al inicio del área de trabajo, bajo el header. Siempre visible en desktop, colapsable mediante el botón "Ocultar".

### 3 módulos del cockpit

| Módulo | Feed key | Ruta bandeja | Estado |
|--------|----------|--------------|--------|
| Asignaciones | `asignaciones` | `/asignaciones` | Parcial |
| Solicitudes / Avisos | `solicitudes` | `/solicitudes` | Parcial |
| Trabajos no revisados | `trabajos_no_revisados` | `/partes-validacion` | Implementado |

### Endpoint del cockpit

```
GET /api/v1/cockpit/feed
GET /api/v1/cockpit/counts
```

Requiere autenticación con cualquier `OFFICE_ROLE`.

---

## Sidebar

### Grupos (en orden de aparición)

| Grupo | ID | Grupos por defecto abiertos |
|-------|----|-----------------------------|
| Entrada | `entrada` | ✅ Sí |
| Operaciones | `operaciones` | ✅ Sí |
| Planning | `planning` | ❌ No |
| Red externa | `red-externa` | ❌ No |
| Buzón Correo | `correo` | ❌ No |
| Finanzas | `finanzas` | ❌ No |
| Control | `control` | ❌ No |
| Configuración | `configuracion` | ❌ No |
| Dirección | `direccion` | ❌ No |

### Persistencia

El estado del sidebar se guarda en `localStorage`:
- `erp:sidebar:groups` — JSON con grupos abiertos/cerrados
- `erp:sidebar:collapsed` — boolean (icon-only mode)
- `erp:cockpit:collapsed` — boolean (cockpit expandido/colapsado)

### Feature flags

Los módulos con feature flag desactivado no aparecen en el sidebar aunque el usuario tenga el rol correcto.

Flags actuales (configurados en `nav-config.ts > FEATURE_FLAGS`):

| Flag | Valor | Módulos |
|------|-------|---------|
| `planning_geografico` | `true` | Planning geográfico |
| `rentings` | `false` | Rentings |
| `bancos` | `false` | Bancos |
| `encuestas` | `false` | Encuestas |
| `autocita` | `false` | Autocita |

---

## Cómo añadir un nuevo módulo

1. **Crear la página** en `apps/backoffice-web/src/pages/NuevoModuloPage.tsx`
2. **Añadir la ruta** en `App.tsx` dentro del bloque `<Route element={<AppLayout />}>`
3. **Añadir la entrada** en `nav-config.ts` dentro del grupo correspondiente con `status: 'implemented'`
4. **Si necesita badge:** añadir la clave en `NavBadges` (types.ts) y la query en `useNavBadges.ts`
5. **Si tiene backend nuevo:** crear la ruta en `apps/edge-api/src/routes/` y registrarla en `index.ts`

---

## Estado de implementación por números

- ✅ **Implementado** (22 módulos) — 47%
- ⚠️ **Parcial** (19 módulos) — 40%
- 🆕 **Nuevo/Conceptual** (6 módulos) — 13%
- **Total:** 47 módulos de navegación

---

## Principios que NO cambiar

1. **El backend es la fuente de verdad** — el sidebar es solo presentación
2. **No meter lógica de dominio en nav-config** — solo rutas, roles e íconos
3. **Las mutaciones críticas solo en backend** — la navegación es solo lectura
4. **El badge no es la única protección** — el backend siempre valida roles
5. **PlaceholderPage ≠ funcionalidad** — cuando una página stub se active, debe reemplazarse por UI real
