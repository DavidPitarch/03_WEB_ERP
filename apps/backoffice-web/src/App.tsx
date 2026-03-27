import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { LoginPage } from '@/pages/LoginPage';
import { AppLayout } from '@/components/AppLayout';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
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
import { ConfigEmisionPage } from '@/pages/ConfigEmisionPage';
// Nuevas páginas extraídas de Maestros
import { CompaniasPage } from '@/pages/CompaniasPage';
import { OperariosConfigPage } from '@/pages/OperariosConfigPage';
// Nuevas páginas funcionales
import { SolicitudesPage } from '@/pages/SolicitudesPage';
// UCT: Usuarios y Cargas de Trabajo
import { CargasTramitadoresPage } from '@/pages/CargasTramitadoresPage';
import { ColaAsignacionPage } from '@/pages/ColaAsignacionPage';
import { ReasignacionMasivaPage } from '@/pages/ReasignacionMasivaPage';
import { TramitadorDetallePage } from '@/pages/TramitadorDetallePage';
import { ReglasRepartoPage } from '@/pages/ReglasRepartoPage';
// Nuevas páginas stub (Configuración)
import { UsuariosPage } from '@/pages/UsuariosPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { EspecialidadesPage } from '@/pages/EspecialidadesPage';
import { CalendarioOperativoPage } from '@/pages/CalendarioOperativoPage';
import { SeriesFacturacionPage } from '@/pages/SeriesFacturacionPage';
import { BancosPage } from '@/pages/BancosPage';
import { MensajesPredefinidosPage } from '@/pages/MensajesPredefinidosPage';
import { EncuestasPage } from '@/pages/EncuestasPage';
import { AutocitaPage } from '@/pages/AutocitaPage';
import { EventosPage } from '@/pages/EventosPage';
// Nuevas páginas stub (Planning y Operaciones)
import { PlanningPage } from '@/pages/PlanningPage';
import { PlanningGeoPage } from '@/pages/PlanningGeoPage';
import { AsignacionesPage } from '@/pages/AsignacionesPage';
import { TrabajosPendientesPage } from '@/pages/TrabajosPendientesPage';
import { PerfilPage } from '@/pages/PerfilPage';
import { ComercialesPage } from '@/pages/ComercialesPage';
import { GestorTiposPage } from '@/pages/GestorTiposPage';
import { DocRequeridaPage } from '@/pages/DocRequeridaPage';
import { FestivosPage } from '@/pages/FestivosPage';
import { AcercaDePage } from '@/pages/AcercaDePage';
import { CondicionesPresupuestosPage } from '@/pages/CondicionesPresupuestosPage';
import { CorreosPage } from '@/pages/CorreosPage';
import { RgpdPage } from '@/pages/RgpdPage';
import { AutoVisitasPage } from '@/pages/AutoVisitasPage';
import { CentralitaPage } from '@/pages/CentralitaPage';
import { LineasFacturacionPage } from '@/pages/LineasFacturacionPage';
import { GestionDocumentosPage } from '@/pages/GestionDocumentosPage';
import { GestionCamposPage } from '@/pages/GestionCamposPage';

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
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Operaciones */}
        <Route path="/expedientes" element={<ExpedientesPage />} />
        <Route path="/expedientes/nuevo" element={<NuevoExpedientePage />} />
        <Route path="/expedientes/:id" element={<ExpedienteDetailPage />} />
        <Route path="/tareas" element={<TareasPage />} />
        <Route path="/partes-validacion" element={<PartesValidacionPage />} />
        <Route path="/informes-caducados" element={<InformesCaducadosPage />} />
        <Route path="/solicitudes" element={<SolicitudesPage />} />
        <Route path="/asignaciones" element={<AsignacionesPage />} />
        <Route path="/trabajos-pendientes" element={<TrabajosPendientesPage />} />

        {/* Planning */}
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/planning/geo" element={<PlanningGeoPage />} />

        {/* Videoperitaciones */}
        <Route path="/videoperitaciones" element={<VideoperitacionesPage />} />
        <Route path="/videoperitaciones/pendientes" element={<VpPendientesContactoPage />} />
        <Route path="/videoperitaciones/agenda" element={<VpAgendaPage />} />
        <Route path="/videoperitaciones/:id" element={<Navigate to="/videoperitaciones" replace />} />

        {/* Peritos */}
        <Route path="/peritos/expedientes" element={<PeritosExpedientesPage />} />
        <Route path="/peritos/dictamenes" element={<DictamenesPage />} />
        <Route path="/peritos/dictamenes/:id" element={<DictamenDetailPage />} />
        <Route path="/peritos/admin" element={<PeritosAdminPage />} />

        {/* Facturación */}
        <Route path="/pendientes-facturar" element={<PendientesFacturarPage />} />
        <Route path="/facturas" element={<FacturasPage />} />
        <Route path="/facturas-caducadas" element={<FacturasCaducadasPage />} />
        <Route path="/facturas/:id" element={<FacturaDetailPage />} />
        <Route path="/autofacturas" element={<AutofacturasPage />} />
        <Route path="/presupuestos/:id" element={<PresupuestoPage />} />

        {/* Compras */}
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pedidos/a-recoger" element={<PedidosRecogerPage />} />
        <Route path="/pedidos/caducados" element={<PedidosCaducadosPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetailPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />

        {/* Reporting */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/rentabilidad" element={<RentabilidadPage />} />
        <Route path="/reporting-facturas" element={<ReportingFacturasPage />} />

        {/* UCT — Usuarios y Cargas de Trabajo */}
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/usuarios/cargas" element={<CargasTramitadoresPage />} />
        <Route path="/usuarios/cola" element={<ColaAsignacionPage />} />
        <Route path="/usuarios/reasignacion-masiva" element={<ReasignacionMasivaPage />} />
        <Route path="/usuarios/tramitador/:id" element={<TramitadorDetallePage />} />
        <Route path="/usuarios/reglas-reparto" element={<ReglasRepartoPage />} />

        {/* Configuración — rutas directas */}
        <Route path="/companias" element={<CompaniasPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/operarios-config" element={<OperariosConfigPage />} />
        <Route path="/especialidades" element={<EspecialidadesPage />} />
        <Route path="/calendario" element={<CalendarioOperativoPage />} />
        <Route path="/baremos" element={<BaremosPage />} />
        <Route path="/series-facturacion" element={<SeriesFacturacionPage />} />
        <Route path="/bancos" element={<BancosPage />} />
        <Route path="/mensajes-predefinidos" element={<MensajesPredefinidosPage />} />
        <Route path="/encuestas" element={<EncuestasPage />} />
        <Route path="/autocita" element={<AutocitaPage />} />
        <Route path="/eventos" element={<EventosPage />} />

        {/* Aliases /config/* para nav-config */}
        <Route path="/config/usuarios" element={<UsuariosPage />} />
        <Route path="/config/companias" element={<CompaniasPage />} />
        <Route path="/config/especialidades" element={<EspecialidadesPage />} />
        <Route path="/config/calendario" element={<CalendarioOperativoPage />} />
        <Route path="/config/autocita" element={<AutocitaPage />} />

        {/* Aliases /control/* para nav-config */}
        <Route path="/control/eventos" element={<EventosPage />} />
        <Route path="/control/mensajes" element={<MensajesPredefinidosPage />} />
        <Route path="/control/encuestas" element={<EncuestasPage />} />

        {/* Finanzas */}
        <Route path="/finanzas/bancos" element={<BancosPage />} />

        <Route path="/config-emision" element={<ConfigEmisionPage />} />

        {/* Nuevos módulos FASE A */}
        <Route path="/comerciales" element={<ComercialesPage />} />
        <Route path="/gestor-tipos" element={<GestorTiposPage />} />
        <Route path="/doc-requerida" element={<DocRequeridaPage />} />
        <Route path="/festivos" element={<FestivosPage />} />
        <Route path="/acerca-de" element={<AcercaDePage />} />

        {/* Nuevos módulos FASE B */}
        <Route path="/condiciones-presupuestos" element={<CondicionesPresupuestosPage />} />
        <Route path="/correos" element={<CorreosPage />} />
        <Route path="/rgpd" element={<RgpdPage />} />
        <Route path="/auto-visitas" element={<AutoVisitasPage />} />
        <Route path="/centralita" element={<CentralitaPage />} />
        <Route path="/lineas-facturacion" element={<LineasFacturacionPage />} />
        <Route path="/control/documentos" element={<GestionDocumentosPage />} />
        <Route path="/control/campos" element={<GestionCamposPage />} />

        {/* Perfil de usuario */}
        <Route path="/perfil" element={<PerfilPage />} />

        {/* Legacy - mantener compatibilidad */}
        <Route path="/maestros" element={<MaestrosPage />} />

        {/* ── Rutas placeholder — módulos en backlog ── */}
        <Route path="/comunicaciones"     element={<PlaceholderPage moduleName="Comunicaciones" description="Bandeja de comunicaciones con asegurados y compañías. La API existe." status="partial" />} />
        <Route path="/presupuestos"       element={<PlaceholderPage moduleName="Presupuestos" description="Lista de presupuestos. El detalle (/presupuestos/:id) ya está implementado." status="partial" />} />
        <Route path="/operarios"          element={<Navigate to="/operarios-config" replace />} />
        <Route path="/rentings"           element={<PlaceholderPage moduleName="Rentings" description="Gestión de contratos de renting asociados a siniestros." status="new" />} />
        <Route path="/correo/cuentas"     element={<CorreosPage />} />
        <Route path="/correo/configuracion" element={<PlaceholderPage moduleName="Configuración correo" description="Plantillas, reglas de enrutamiento y configuración de email transaccional." status="new" />} />
        <Route path="/planning/agenda"    element={<PlaceholderPage moduleName="Agenda mensual" description="Agenda operativa mensual de citas y visitas con vistas de calendario." status="new" />} />
        <Route path="/control/documentos" element={<PlaceholderPage moduleName="Documentos" description="Gestión documental centralizada sobre Supabase Storage con permisos por rol." status="new" />} />
        <Route path="/control/auditoria"  element={<PlaceholderPage moduleName="Auditoría" description="Log de auditoría transversal. El servicio audit.ts ya existe en el backend." status="partial" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
