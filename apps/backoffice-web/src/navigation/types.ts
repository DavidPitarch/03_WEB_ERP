// ─── NAVIGATION TYPES ──────────────────────────────────────────────────────
// Contrato de tipado para toda la navegación del backoffice.
// No contiene lógica de dominio ni de negocio.

export type UserRole =
  | 'admin'
  | 'supervisor'
  | 'tramitador'
  | 'financiero'
  | 'direccion'
  | 'operario'
  | 'perito'
  | 'proveedor';

/**
 * Estado de implementación de un módulo.
 * Permite diferenciar qué existe, qué está pendiente y qué es conceptual.
 */
export type ImplementationStatus =
  | 'implemented'   // Página completa con backend y UI funcional
  | 'partial'       // Backend existe o UI existe pero limitada / solo como filtro
  | 'conceptual'    // Definido en dominio pero sin desarrollo aún
  | 'new';          // No definido todavía, solo scaffold y placeholder

export type BadgeVariant = 'default' | 'danger' | 'warning' | 'info' | 'muted';

/**
 * Badge reactivo en un item de navegación.
 * La clave hace referencia al campo correspondiente en el hook useNavBadges().
 */
export interface NavBadge {
  /** Clave del contador en el store de useNavBadges */
  key: string;
  variant: BadgeVariant;
  /** Si true, el badge no se muestra cuando el valor es 0 */
  hideWhenZero?: boolean;
}

/**
 * Entrada individual del sidebar.
 */
export interface NavEntry {
  id: string;
  label: string;
  /** Ruta absoluta del cliente (react-router) */
  path: string;
  /** Nombre del icono de lucide-react */
  icon: string;
  badge?: NavBadge;
  /**
   * Roles que pueden VER esta entrada.
   * Array vacío o ausente = visible para todos los roles autenticados.
   */
  roles?: UserRole[];
  /**
   * Feature flag que debe estar activo para mostrar este item.
   * Si está ausente, siempre visible (si el rol lo permite).
   */
  featureFlag?: string;
  status: ImplementationStatus;
  /** Descripción funcional (tooltip, documentación) */
  description?: string;
  /** Si tiene subitems en el futuro, se añadirán aquí */
  children?: NavEntry[];
}

/**
 * Grupo colapsable del sidebar.
 */
export interface NavGroup {
  id: string;
  label: string;
  /** Ícono del grupo (para modo colapsado icon-only del sidebar) */
  icon?: string;
  entries: NavEntry[];
  /**
   * Roles que pueden ver este grupo completo.
   * Array vacío = todos los roles.
   */
  roles?: UserRole[];
  /** Expandido por defecto */
  defaultOpen?: boolean;
}

/**
 * Módulo del cockpit operativo superior (uno de los 3 grandes).
 */
export interface CockpitModuleConfig {
  id: string;
  label: string;
  /** Ruta de la bandeja completa al hacer clic en el título */
  path: string;
  /** Nombre de icono de lucide-react */
  icon: string;
  /** Clave en el feed del cockpit (respuesta de /api/v1/cockpit/feed) */
  feedKey: 'asignaciones' | 'solicitudes' | 'trabajos_no_revisados' | 'tareas_caducadas';
  /** Variante de color del módulo */
  variant: 'blue' | 'amber' | 'red' | 'green' | 'orange';
  /** Filtros rápidos disponibles en el módulo */
  quickFilters: Array<{ label: string; value: string }>;
  status: ImplementationStatus;
}

/**
 * Item individual del feed de un módulo cockpit.
 */
export interface CockpitFeedItem {
  id: string;
  numero: string;         // número de expediente o referencia
  tipo?: string;          // tipo_siniestro, tipo_alerta, etc.
  localidad?: string;
  prioridad?: 'baja' | 'media' | 'alta' | 'urgente';
  estado?: string;
  etiqueta?: string;      // texto libre de estado de negocio
  fecha?: string;
  /** Para el tooltip de Solicitudes/Avisos */
  asegurado_nombre?: string;
  direccion_completa?: string;
  /** Ruta directa al detalle (deep link al expediente) */
  detailPath: string;
  /** Para Tareas Caducadas: indica si SLA vencido o vence hoy */
  sla_estado?: 'vencido' | 'hoy';
  /** Para Tareas Caducadas: fecha de vencimiento formateada (dd/mm/yyyy) */
  sla_vencimiento?: string;
}

/**
 * Datos de un módulo del cockpit tal como vienen del backend.
 */
export interface CockpitModuleData {
  total: number;
  criticos: number;
  items: CockpitFeedItem[];
}

/**
 * Respuesta completa del endpoint /cockpit/feed.
 */
export interface CockpitFeed {
  asignaciones: CockpitModuleData;
  solicitudes: CockpitModuleData;
  trabajos_no_revisados: CockpitModuleData;
  tareas_caducadas: CockpitModuleData;
}

/**
 * Mapa de todos los badges del sidebar (clave → número).
 * Las claves coinciden con NavBadge.key en nav-config.
 */
export interface NavBadges {
  asignaciones: number;
  solicitudes: number;
  comunicaciones: number;
  partes_pendientes: number;
  informes_caducados: number;
  facturas_caducadas: number;
  facturas_pendientes: number;
  tareas: number;
  // extensible: añadir nuevas claves sin cambiar la interfaz
  [key: string]: number;
}
