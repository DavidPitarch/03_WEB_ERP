import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNavBadges } from '@/hooks/useNavBadges';
import { NAV_GROUPS, isFeatureEnabled } from '@/navigation/nav-config';
import type { NavEntry, NavGroup, NavBadges } from '@/navigation/types';
import '../styles/components/sidebar.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resuelve ícono de Lucide por nombre de string (tipado dinámico) */
function NavIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

/** Badge numérico en el item del sidebar */
function NavBadgeChip({ value, variant }: { value: number; variant: string }) {
  if (value <= 0) return null;
  return (
    <span className={`nav-item-v2__badge nav-item-v2__badge--${variant}`}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

/** Punto de estado de implementación (visible en desarrollo) */
function StatusDot({ status }: { status: NavEntry['status'] }) {
  if (status === 'implemented') return null;
  const color = { partial: 'var(--amber-500)', conceptual: 'var(--blue-400)', new: 'var(--slate-400)' }[status] ?? 'var(--slate-400)';
  return (
    <span
      title={status}
      style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginLeft: 'auto', marginRight: '2px' }}
    />
  );
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────
const LS_GROUPS_KEY   = 'erp:sidebar:groups';
const LS_COLLAPSE_KEY = 'erp:sidebar:collapsed';

function loadGroupState(groups: NavGroup[]): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(LS_GROUPS_KEY);
    if (saved) return JSON.parse(saved) as Record<string, boolean>;
  } catch { /* ignore */ }
  return Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? false]));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** Modo icon-only en desktop (controlado desde AppLayout) */
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────
export function AppSidebar({ open, onClose, collapsed: collapsedProp, onCollapseToggle }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const badges = useNavBadges();

  // ── Estado colapso desktop ──
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (collapsedProp !== undefined) return collapsedProp;
    return localStorage.getItem(LS_COLLAPSE_KEY) === 'true';
  });

  // ── Estado grupos expandidos ──
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() =>
    loadGroupState(NAV_GROUPS),
  );

  useEffect(() => { localStorage.setItem(LS_COLLAPSE_KEY, String(collapsed)); }, [collapsed]);
  useEffect(() => { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(groupOpen)); }, [groupOpen]);
  useEffect(() => { if (collapsedProp !== undefined) setCollapsed(collapsedProp); }, [collapsedProp]);

  const toggleGroup = useCallback((id: string) => {
    setGroupOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapseToggle?.();
  };

  const handleSignOut = () => { signOut(); onClose?.(); };

  /** Detecta si una ruta está activa, ignorando query params para la comparación base */
  const isActive = (path: string): boolean => {
    const base = path.split('?')[0];
    if (base === '/expedientes') {
      return location.pathname === '/expedientes' || location.pathname.startsWith('/expedientes/');
    }
    return location.pathname.startsWith(base);
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?';
  const userEmail   = user?.email ?? '';

  return (
    <>
      {/* Overlay — solo móvil/tablet */}
      {open !== undefined && (
        <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={['app-sidebar', open ? 'open' : '', collapsed ? 'sidebar--collapsed' : ''].filter(Boolean).join(' ')}
      >
        {/* Botón colapso desktop */}
        <div className="sidebar-collapse-btn-wrap">
          <button
            className="sidebar-collapse-btn"
            onClick={toggleCollapse}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        {/* Grupos de navegación generados desde nav-config */}
        {NAV_GROUPS.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            open={groupOpen[group.id] ?? false}
            onToggle={() => toggleGroup(group.id)}
            badges={badges}
            isActive={isActive}
            onItemClick={onClose}
            collapsed={collapsed}
          />
        ))}

        <div className="sidebar-divider" />

        {/* Pie — usuario y logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user" title={collapsed ? userEmail : undefined}>
            <div className="sidebar-user__avatar">{userInitial}</div>
            {!collapsed && (
              <div className="sidebar-user__info">
                <div className="sidebar-user__name" title={userEmail}>{userEmail}</div>
                <div className="sidebar-user__role">Backoffice</div>
              </div>
            )}
            <button className="sidebar-logout-btn" onClick={handleSignOut} title="Cerrar sesión" type="button">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Grupo colapsable ─────────────────────────────────────────────────────────
interface SidebarGroupProps {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  badges: NavBadges;
  isActive: (path: string) => boolean;
  onItemClick?: () => void;
  collapsed: boolean;
}

function SidebarGroup({ group, open, onToggle, badges, isActive, onItemClick, collapsed }: SidebarGroupProps) {
  // Filtrar por feature flags (no por roles todavía — ver GAPS)
  const visibleEntries = group.entries.filter((e) => isFeatureEnabled(e.featureFlag));
  if (visibleEntries.length === 0) return null;

  // Suma de badges del grupo (para mostrar en header cuando está cerrado)
  const groupBadgeCount = visibleEntries.reduce((acc, e) => {
    if (!e.badge) return acc;
    return acc + (badges[e.badge.key] ?? 0);
  }, 0);

  return (
    <div className="sidebar-section">
      <button
        className="sidebar-section-header"
        onClick={onToggle}
        type="button"
        title={collapsed ? group.label : undefined}
        aria-expanded={open}
      >
        {group.icon && (
          <span className="sidebar-section-header__icon">
            <NavIcon name={group.icon} size={13} />
          </span>
        )}
        {!collapsed && (
          <>
            <span className="sidebar-section-label-text">{group.label}</span>
            {groupBadgeCount > 0 && !open && (
              <span className="nav-item-v2__badge nav-item-v2__badge--default" style={{ marginLeft: 'auto' }}>
                {groupBadgeCount > 99 ? '99+' : groupBadgeCount}
              </span>
            )}
            <span className="sidebar-section-chevron">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </>
        )}
      </button>

      {/* Items visibles cuando el grupo está abierto (o sidebar colapsado — icon-only) */}
      {(open || collapsed) && (
        <div className={`sidebar-group-items${collapsed ? ' sidebar-group-items--icon-only' : ''}`}>
          {visibleEntries.map((entry) => (
            <SidebarEntry
              key={entry.id}
              entry={entry}
              badges={badges}
              active={isActive(entry.path)}
              onClick={onItemClick}
              iconOnly={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entry individual ─────────────────────────────────────────────────────────
interface SidebarEntryProps {
  entry: NavEntry;
  badges: NavBadges;
  active: boolean;
  onClick?: () => void;
  iconOnly: boolean;
}

function SidebarEntry({ entry, badges, active, onClick, iconOnly }: SidebarEntryProps) {
  const isStub    = entry.status === 'new' || entry.status === 'conceptual';
  const badgeVal  = entry.badge ? (badges[entry.badge.key] ?? 0) : 0;
  const showBadge = entry.badge && (!entry.badge.hideWhenZero || badgeVal > 0) && badgeVal > 0;

  const tooltip = iconOnly || isStub
    ? `${entry.label}${entry.description ? ` — ${entry.description}` : ''}`
    : undefined;

  return (
    <Link
      to={entry.path}
      className={['nav-item-v2', active ? 'active' : '', isStub ? 'nav-item-v2--stub' : '', iconOnly ? 'nav-item-v2--icon-only' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      title={tooltip}
      aria-label={entry.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-item-v2__icon">
        <NavIcon name={entry.icon} size={15} />
      </span>

      {!iconOnly && <span className="nav-item-v2__label">{entry.label}</span>}

      {/* Ícono de candado para módulos no implementados */}
      {!iconOnly && isStub && (
        <Lock size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      )}

      {/* Punto de estado (development helper) */}
      {!iconOnly && <StatusDot status={entry.status} />}

      {/* Badge de contador */}
      {showBadge && <NavBadgeChip value={badgeVal} variant={entry.badge!.variant} />}
    </Link>
  );
}
