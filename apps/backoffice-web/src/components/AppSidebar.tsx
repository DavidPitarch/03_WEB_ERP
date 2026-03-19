import { Link, useLocation } from 'react-router-dom';
import {
  FolderOpen,
  CheckSquare,
  ClipboardCheck,
  BookOpen,
  AlertTriangle,
  Clock,
  Video,
  UserSearch,
  Scale,
  Users,
  FileText,
  FileMinus,
  DollarSign,
  ShoppingCart,
  Package,
  Truck,
  BarChart2,
  TrendingUp,
  PieChart,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useAlertasCount } from '@/hooks/useAlertas';
import '../styles/components/sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'muted';
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { data: countRes } = useAlertasCount();
  const alertCount = countRes && 'data' in countRes ? (countRes.data?.count ?? 0) : 0;

  const sections: NavSection[] = [
    {
      id: 'operaciones',
      label: 'Operaciones',
      items: [
        { path: '/expedientes',        label: 'Expedientes',         icon: <FolderOpen size={16} /> },
        { path: '/tareas',             label: 'Tareas',              icon: <CheckSquare size={16} />, badgeCount: alertCount > 0 ? alertCount : undefined, badgeVariant: 'danger' },
        { path: '/partes-validacion',  label: 'Validar partes',      icon: <ClipboardCheck size={16} /> },
        { path: '/informes-caducados', label: 'Informes caducados',  icon: <AlertTriangle size={16} /> },
      ],
    },
    {
      id: 'videoperitaciones',
      label: 'Videoperitaciones',
      items: [
        { path: '/videoperitaciones',            label: 'Videoperitaciones',  icon: <Video size={16} /> },
        { path: '/videoperitaciones/pendientes', label: 'VP Pendientes',      icon: <Clock size={16} /> },
        { path: '/videoperitaciones/agenda',     label: 'VP Agenda',          icon: <Clock size={16} /> },
      ],
    },
    {
      id: 'peritos',
      label: 'Peritos',
      items: [
        { path: '/peritos/expedientes', label: 'Mis expedientes', icon: <UserSearch size={16} /> },
        { path: '/peritos/dictamenes',  label: 'Dictámenes',      icon: <Scale size={16} /> },
        { path: '/peritos/admin',       label: 'Gestión peritos', icon: <Users size={16} /> },
      ],
    },
    {
      id: 'facturacion',
      label: 'Facturación',
      items: [
        { path: '/pendientes-facturar', label: 'Pend. facturar',   icon: <DollarSign size={16} /> },
        { path: '/facturas',            label: 'Facturas',          icon: <FileText size={16} /> },
        { path: '/facturas-caducadas',  label: 'Fact. caducadas',   icon: <AlertTriangle size={16} />, badgeVariant: 'danger' },
        { path: '/autofacturas',        label: 'Autofacturas',      icon: <FileMinus size={16} /> },
      ],
    },
    {
      id: 'compras',
      label: 'Compras',
      items: [
        { path: '/pedidos',           label: 'Pedidos',      icon: <ShoppingCart size={16} /> },
        { path: '/pedidos/a-recoger', label: 'A recoger',    icon: <Package size={16} /> },
        { path: '/pedidos/caducados', label: 'Ped. caducados', icon: <AlertTriangle size={16} />, badgeVariant: 'warning' },
        { path: '/proveedores',       label: 'Proveedores',  icon: <Truck size={16} /> },
      ],
    },
    {
      id: 'reporting',
      label: 'Reporting',
      items: [
        { path: '/dashboard',          label: 'Dashboard',     icon: <BarChart2 size={16} /> },
        { path: '/rentabilidad',       label: 'Rentabilidad',  icon: <TrendingUp size={16} /> },
        { path: '/reporting-facturas', label: 'Reporting',     icon: <PieChart size={16} /> },
        { path: '/baremos',            label: 'Baremos',       icon: <BookOpen size={16} /> },
      ],
    },
    {
      id: 'sistema',
      label: 'Sistema',
      items: [
        { path: '/maestros', label: 'Maestros', icon: <Settings size={16} /> },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/expedientes') {
      return location.pathname === '/expedientes' || location.pathname.startsWith('/expedientes/');
    }
    return location.pathname.startsWith(path);
  };

  // Inicial del usuario para el avatar
  const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?';
  const userEmail = user?.email ?? '';

  const handleSignOut = () => {
    signOut();
    onClose?.();
  };

  return (
    <>
      {/* Overlay para móvil */}
      {open !== undefined && (
        <div
          className={`sidebar-overlay ${open ? 'open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${open ? 'open' : ''}`}>
        {sections.map((section) => (
          <div key={section.id} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item-v2 ${isActive(item.path) ? 'active' : ''}`}
                onClick={onClose}
                title={item.label}
              >
                <span className="nav-item-v2__icon">{item.icon}</span>
                <span className="nav-item-v2__label">{item.label}</span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className={`nav-item-v2__badge nav-item-v2__badge--${item.badgeVariant ?? 'default'}`}>
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}

        <div className="sidebar-divider" />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar" aria-hidden="true">
              {userInitial}
            </div>
            <div className="sidebar-user__info">
              <div className="sidebar-user__name" title={userEmail}>
                {userEmail}
              </div>
              <div className="sidebar-user__role">Backoffice</div>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={handleSignOut}
              title="Cerrar sesión"
              type="button"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
