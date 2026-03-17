import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { LoginPage } from '@/pages/LoginPage';
import { OperatorLayout } from '@/components/OperatorLayout';
import { AgendaPage } from '@/pages/AgendaPage';
import { ClaimDetailPage } from '@/pages/ClaimDetailPage';
import { PartFormPage } from '@/pages/PartFormPage';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Cargando...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<OperatorLayout />}>
        <Route index element={<Navigate to="/agenda" replace />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/claim/:id" element={<ClaimDetailPage />} />
        <Route path="/claim/:id/parte/:citaId" element={<PartFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  );
}
