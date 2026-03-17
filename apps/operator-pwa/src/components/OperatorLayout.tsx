import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useNetworkStatus, useQueueCount, useSyncOnReconnect } from '@/lib/use-network';

export function OperatorLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const online = useNetworkStatus();
  const pending = useQueueCount();

  useSyncOnReconnect();

  return (
    <div className="op-layout">
      <header className="op-header">
        <Link to="/agenda" className="op-logo">ERP Operario</Link>
        <div className="op-header-right">
          {!online && <span className="op-offline-badge">Sin conexión</span>}
          {pending > 0 && <span className="op-sync-badge">{pending} pendientes</span>}
          <button onClick={signOut} className="op-btn-logout">Salir</button>
        </div>
      </header>
      <main className="op-main">
        <Outlet />
      </main>
      <nav className="op-nav">
        <Link to="/agenda" className={`op-nav-item ${location.pathname === '/agenda' ? 'active' : ''}`}>
          Agenda
        </Link>
      </nav>
    </div>
  );
}
