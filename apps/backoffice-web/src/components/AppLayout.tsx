import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { AlertBanner } from '@/components/AlertBanner';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

export function AppLayout() {
  // Inicializa el hook de tema para que quede activo en toda la app
  useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-left">
          {/* Hamburguesa — solo visible en móvil/tablet */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            type="button"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <Link to="/expedientes" className="logo">ERP Siniestros</Link>
        </div>

        {/* Buscador global — ocupa el espacio central */}
        <GlobalSearch />

        {/* Acciones del header */}
        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="app-main">
        {/* Banner de alertas — se muestra dentro del área de contenido */}
        <AlertBanner />
        <Outlet />
      </main>
    </div>
  );
}
