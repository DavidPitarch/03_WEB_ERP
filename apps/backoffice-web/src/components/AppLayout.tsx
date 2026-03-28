import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { AlertBanner } from '@/components/AlertBanner';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopCockpit } from '@/components/layout/TopCockpit';
import { useTheme } from '@/hooks/useTheme';

export function AppLayout() {
  useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

          <Link to="/dashboard" className="logo">ERP Siniestros</Link>
        </div>

        <GlobalSearch />

        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── COCKPIT OPERATIVO — franja superior derecha, junto al sidebar ── */}
      <div className="app-cockpit">
        <TopCockpit />
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="app-main">
        <AlertBanner />
        <Outlet />
      </main>
    </div>
  );
}
