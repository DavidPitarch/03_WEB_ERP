import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { GlobalSearch } from '@/components/GlobalSearch';
import { AlertBanner } from '@/components/AlertBanner';
import { useAlertasCount } from '@/hooks/useAlertas';

const NAV_ITEMS = [
  { path: '/expedientes', label: 'Expedientes' },
  { path: '/tareas', label: 'Tareas' },
  { path: '/partes-validacion', label: 'Validar partes' },
  { path: '/baremos', label: 'Baremos' },
  { path: '/informes-caducados', label: 'Inf. caducados' },
  { path: '/pendientes-facturar', label: 'Pend. facturar' },
  { path: '/facturas', label: 'Facturas' },
  { path: '/facturas-caducadas', label: 'Fact. caducadas' },
  { path: '/proveedores', label: 'Proveedores' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/pedidos/a-recoger', label: 'A recoger' },
  { path: '/pedidos/caducados', label: 'Ped. caducados' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/rentabilidad', label: 'Rentabilidad' },
  { path: '/reporting-facturas', label: 'Reporting' },
  { path: '/autofacturas', label: 'Autofacturas' },
  { path: '/peritos/expedientes', label: 'Mis expedientes' },
  { path: '/peritos/dictamenes', label: 'Dictámenes' },
  { path: '/peritos/admin', label: 'Peritos' },
  { path: '/videoperitaciones', label: 'Videoperitaciones' },
  { path: '/videoperitaciones/pendientes', label: 'VP Pendientes' },
  { path: '/videoperitaciones/agenda', label: 'VP Agenda' },
  { path: '/maestros', label: 'Maestros' },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { data: countRes } = useAlertasCount();
  const alertCount = countRes && 'data' in countRes ? countRes.data?.count ?? 0 : 0;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <Link to="/" className="logo">ERP Siniestros</Link>
          <nav className="main-nav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <GlobalSearch />
        <div className="header-right">
          {alertCount > 0 && <span className="alert-count-badge">{alertCount}</span>}
          <span className="user-email">{user?.email}</span>
          <button onClick={signOut} className="btn-logout">Salir</button>
        </div>
      </header>
      <AlertBanner />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
