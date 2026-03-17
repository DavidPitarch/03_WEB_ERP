import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { LoginPage } from '@/pages/LoginPage';
import { AppLayout } from '@/components/AppLayout';
import { ExpedientesPage } from '@/pages/ExpedientesPage';
import { ExpedienteDetailPage } from '@/pages/ExpedienteDetailPage';
import { NuevoExpedientePage } from '@/pages/NuevoExpedientePage';
import { MaestrosPage } from '@/pages/MaestrosPage';
import { InformesCaducadosPage } from '@/pages/InformesCaducadosPage';
import { PartesValidacionPage } from '@/pages/PartesValidacionPage';
import { TareasPage } from '@/pages/TareasPage';
import { BaremosPage } from '@/pages/BaremosPage';
import { PresupuestoPage } from '@/pages/PresupuestoPage';
import { PendientesFacturarPage } from '@/pages/PendientesFacturarPage';
import { FacturasPage } from '@/pages/FacturasPage';
import { FacturasCaducadasPage } from '@/pages/FacturasCaducadasPage';
import { FacturaDetailPage } from '@/pages/FacturaDetailPage';
import { ProveedoresPage } from '@/pages/ProveedoresPage';
import { PedidosPage } from '@/pages/PedidosPage';
import { PedidosRecogerPage } from '@/pages/PedidosRecogerPage';
import { PedidosCaducadosPage } from '@/pages/PedidosCaducadosPage';
import { PedidoDetailPage } from '@/pages/PedidoDetailPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RentabilidadPage } from '@/pages/RentabilidadPage';
import { ReportingFacturasPage } from '@/pages/ReportingFacturasPage';
import { AutofacturasPage } from '@/pages/AutofacturasPage';
import { PeritosExpedientesPage } from '@/pages/PeritosExpedientesPage';
import { DictamenesPage } from '@/pages/DictamenesPage';
import { DictamenDetailPage } from '@/pages/DictamenDetailPage';
import { PeritosAdminPage } from '@/pages/PeritosAdminPage';
import { VideoperitacionesPage } from '@/pages/VideoperitacionesPage';
import { VpPendientesContactoPage } from '@/pages/VpPendientesContactoPage';
import { VpAgendaPage } from '@/pages/VpAgendaPage';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

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
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/expedientes" replace />} />
        <Route path="/expedientes" element={<ExpedientesPage />} />
        <Route path="/expedientes/nuevo" element={<NuevoExpedientePage />} />
        <Route path="/expedientes/:id" element={<ExpedienteDetailPage />} />
        <Route path="/maestros" element={<MaestrosPage />} />
        <Route path="/informes-caducados" element={<InformesCaducadosPage />} />
        <Route path="/partes-validacion" element={<PartesValidacionPage />} />
        <Route path="/tareas" element={<TareasPage />} />
        <Route path="/baremos" element={<BaremosPage />} />
        <Route path="/presupuestos/:id" element={<PresupuestoPage />} />
        <Route path="/pendientes-facturar" element={<PendientesFacturarPage />} />
        <Route path="/facturas" element={<FacturasPage />} />
        <Route path="/facturas-caducadas" element={<FacturasCaducadasPage />} />
        <Route path="/facturas/:id" element={<FacturaDetailPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pedidos/a-recoger" element={<PedidosRecogerPage />} />
        <Route path="/pedidos/caducados" element={<PedidosCaducadosPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/rentabilidad" element={<RentabilidadPage />} />
        <Route path="/reporting-facturas" element={<ReportingFacturasPage />} />
        <Route path="/autofacturas" element={<AutofacturasPage />} />
        <Route path="/peritos/expedientes" element={<PeritosExpedientesPage />} />
        <Route path="/peritos/dictamenes" element={<DictamenesPage />} />
        <Route path="/peritos/dictamenes/:id" element={<DictamenDetailPage />} />
        <Route path="/peritos/admin" element={<PeritosAdminPage />} />
        <Route path="/videoperitaciones" element={<VideoperitacionesPage />} />
        <Route path="/videoperitaciones/pendientes" element={<VpPendientesContactoPage />} />
        <Route path="/videoperitaciones/agenda" element={<VpAgendaPage />} />
        <Route path="/videoperitaciones/:id" element={<Navigate to="/videoperitaciones" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/expedientes" replace />} />
    </Routes>
  );
}
