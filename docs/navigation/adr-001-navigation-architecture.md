# ADR-001 — Arquitectura de Navegación del Backoffice ERP

**Estado:** Aceptado
**Fecha:** 2026-03-20
**Autores:** Arquitectura de producto ERP Siniestros

---

## Contexto

El backoffice del ERP de gestión de siniestros del hogar tenía una navegación flat (sidebar plano con 7 secciones hardcoded), sin soporte para:
- Bandejas con contadores reactivos
- Visibilidad por rol
- Módulos en desarrollo diferenciados de módulos implementados
- Cockpit operativo de "gestión por excepción"
- Extensibilidad sin rehacer la estructura

El dominio del ERP es complejo: gestiona expedientes en estados estrictos, tiene trazabilidad transversal, múltiples roles operativos, y debe evolucionar para soportar multi-tenant, nuevos módulos y nuevos flujos.

---

## Decisión

Se implementa una nueva arquitectura de navegación con tres capas:

### 1. Top Cockpit Operativo (banda superior)
Tres módulos grandes y persistentes siempre visibles en el área de trabajo:
- **Asignaciones** — expedientes sin asignar o en planificación
- **Solicitudes / Avisos** — alertas activas del sistema
- **Trabajos no revisados** — partes de operario pendientes de validación

Cada módulo muestra: contador total, críticos, lista de 5 items recientes, filtros rápidos y enlace directo al expediente. Los datos se obtienen del endpoint `/api/v1/cockpit/feed` que agrega 3 consultas en una sola petición.

**Por qué no en el header:** El cockpit necesita espacio para mostrar listas de expedientes. En el header solo hay espacio para iconos/badges. La banda sticky bajo el header es la única ubicación que permite los 3 módulos en desktop sin comprometer la densidad de información.

### 2. Sidebar lateral colapsable por grupos
Estructura de 9 grupos funcionales siguiendo el orden del dominio del negocio:

```
Entrada → Operaciones → Planning → Red externa →
Buzón Correo → Finanzas → Control → Configuración → Dirección
```

**Decisiones clave:**
- Grupos colapsables con chevron y estado persistido en localStorage
- Modo icon-only cuando el sidebar se colapsa (52px vs 240px)
- Badge reactivo en cada item (via `useNavBadges`)
- Badge acumulado en el header del grupo cuando está cerrado
- Items no implementados muestran ícono de candado (Lock) + tooltip
- Los puntos de colores indican estado de implementación (ayuda al equipo de desarrollo)

**Por qué no menú de pestañas/tabs:** El número de módulos (35+) hace imposible un menú horizontal. El sidebar en árbol con grupos es el patrón universal en ERPs operativos densos.

### 3. Configuración data-driven (nav-config.ts)
Toda la estructura de navegación vive en `src/navigation/nav-config.ts`. No hay menú hardcoded en el componente. Esto permite:
- Añadir módulos sin tocar JSX
- Marcar feature flags por módulo
- Definir permisos por rol en un solo lugar
- Tener inventario de módulos y su estado

---

## Consecuencias

### Positivas
- La navegación refleja el negocio real, no la estructura técnica
- Los módulos en backlog son visibles con su estado de desarrollo
- Los badges reactivos permiten trabajo orientado a excepción
- El cockpit elimina la necesidad de ir al dashboard para ver qué hay urgente
- La separación presentación/config permite evolucionar sin regresiones

### Negativas / Trade-offs
- El rol del usuario no se filtra en frontend aún (ver GAP-003)
- El cockpit introduce un request adicional al cargar la app (mitigado por refetchInterval 30s)
- Los módulos stub navegan a rutas reales que renderizan PlaceholderPage (no 404)

### Neutrales
- Se mantienen todas las rutas existentes sin cambios de URL (no hay breaking changes)
- Los feature flags son estáticos en frontend (mejora planificada: vienen de Supabase por tenant)

---

## Alternativas consideradas

### A. Panel de métricas en el dashboard
Rechazado: el dashboard es una pantalla más, no es persistente. El operario necesita ver las bandejas críticas en todo momento, no solo cuando está en el dashboard.

### B. Notificaciones flotantes (toast/popup)
Rechazado: los expedientes urgentes necesitan contexto (número, tipo, localidad), no solo un texto de notificación efímero.

### C. Tabs horizontales por módulo grande
Rechazado: el número de módulos y la densidad de información hacen inviable un menú horizontal. Además, el sidebar es el patrón establecido en el proyecto.

### D. Menú de iconos tipo dock (sin labels)
Rechazado: hay 9+ grupos con 35+ módulos. Solo funciona para apps con 5-8 destinos. El sidebar con modo collapsed es el mejor compromiso.

---

## Referencias
- [nav-config.ts](../../apps/backoffice-web/src/navigation/nav-config.ts) — Fuente de verdad de la navegación
- [module-inventory.md](./module-inventory.md) — Inventario de módulos y estado
- [gaps.md](./gaps.md) — Gaps funcionales detectados
