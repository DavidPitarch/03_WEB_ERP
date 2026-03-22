import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { AlertBanner } from '@/components/AlertBanner';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopCockpit } from '@/components/layout/TopCockpit';
import { useTheme } from '@/hooks/useTheme';

const LS_COCKPIT_KEY = 'erp:cockpit:collapsed';

export function AppLayout() {
  useTheme();

  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [cockpitCollapsed, setCockpitCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(LS_COCKPIT_KEY) === 'true';
  });

  const toggleCockpit = () => {
    setCockpitCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(LS_COCKPIT_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="app-layout">
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-left">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            type="button"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <Link to="/expedientes" className="logo">ERP Siniestros</Link>
        </div>

        <GlobalSearch />

        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="app-main">
        {/* Cockpit operativo — sticky bajo el header */}
        <TopCockpit collapsed={cockpitCollapsed} onToggle={toggleCockpit} />

        {/* Alertas del sistema */}
        <AlertBanner />

        {/* Página activa */}
        <Outlet />
      </main>
    </div>
  );
}
