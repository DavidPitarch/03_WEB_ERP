import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { App } from '@/App';
import { CustomerTrackingPage } from '@/pages/CustomerTrackingPage';
import { AutocitaPublicPage } from '@/pages/AutocitaPublicPage';
// 1. Tokens (primitivos + semánticos light/dark) — debe ir primero
import '@/styles/tokens.css';
// 2. Estilos globales, layout y clases de compatibilidad
import '@/styles/global.css';
// 3. Componentes v2
import '@/styles/components/sidebar.css';
import '@/styles/components/badge.css';
import '@/styles/components/button.css';
import '@/styles/components/table.css';
import '@/styles/components/form.css';
import '@/styles/components/modal.css';
import '@/styles/components/alert.css';
import '@/styles/components/timeline.css';
import '@/styles/components/card.css';
import '@/styles/components/cockpit.css';
import '@/styles/components/estado-operativo.css';
import '@/styles/components/geo-planning.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RootRouter() {
  const location = useLocation();
  const isCustomerTrackingRoute = location.pathname.startsWith('/customer-tracking/');
  const isAutocitaRoute = location.pathname.startsWith('/autocita/');

  if (isCustomerTrackingRoute) {
    return (
      <Routes>
        <Route path="/customer-tracking/:token" element={<CustomerTrackingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (isAutocitaRoute) {
    return (
      <Routes>
        <Route path="/autocita/:token" element={<AutocitaPublicPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RootRouter />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
