import { useParams, Navigate, Link } from 'react-router-dom';
import { BarChart2, ArrowLeft, ExternalLink } from 'lucide-react';

// ─── Mapa de informes ────────────────────────────────────────────────────────

interface InformeDefinition {
  label: string;
  description: string;
  /** Si tiene página propia en el ERP, redirigir allí */
  redirect?: string;
  status: 'new' | 'partial' | 'implemented';
  categoria: 'financiero' | 'operarios' | 'comerciales' | 'siniestros' | 'presupuestos' | 'calidad' | 'administrativo' | 'actividad';
}

const INFORMES: Record<string, InformeDefinition> = {
  'urgencias-asignadas': {
    label: 'Eli Roque Urgencias Asignadas',
    description: 'Listado de urgencias asignadas por compañía, tramitador y estado. Permite seguimiento de siniestros marcados como urgentes pendientes de gestión.',
    status: 'new',
    categoria: 'siniestros',
  },
  'albaranes': {
    label: 'Albaranes',
    description: 'Informe de albaranes de trabajos y materiales vinculados a expedientes. Incluye importes, operarios y estado de validación.',
    status: 'new',
    categoria: 'administrativo',
  },
  'autofacturacion-operarios': {
    label: 'Autofacturación de Operarios',
    description: 'Informe de autofacturación y liquidación económica de operarios. Muestra trabajos facturados, importes y estado de pago.',
    redirect: '/autofacturas',
    status: 'implemented',
    categoria: 'operarios',
  },
  'autofacturacion-comerciales': {
    label: 'Autofacturación / Liquidación de Comerciales',
    description: 'Informe de autofacturación y liquidación de agentes comerciales e intermediarios. Comisiones generadas y estado de pago.',
    status: 'new',
    categoria: 'comerciales',
  },
  'facturacion': {
    label: 'Facturación',
    description: 'Informe de facturación por compañía, período y estado. Totales emitidos, cobrados y pendientes.',
    redirect: '/reporting-facturas',
    status: 'implemented',
    categoria: 'financiero',
  },
  'fichajes-usuarios': {
    label: 'Fichajes de Usuarios',
    description: 'Registro de fichajes de entrada y salida del personal interno. Horas trabajadas, descansos y resumen por período.',
    status: 'new',
    categoria: 'actividad',
  },
  'graficas-parametros': {
    label: 'Gráficas de Parámetros',
    description: 'Visualización gráfica de parámetros operativos clave: siniestros por período, tiempos medios, distribución por tipo y compañía.',
    status: 'new',
    categoria: 'siniestros',
  },
  'importacion-cobros': {
    label: 'Importación de Cobros',
    description: 'Herramienta de importación masiva de cobros desde ficheros bancarios (AEB43/SEPA). Conciliación automática con facturas pendientes.',
    status: 'new',
    categoria: 'financiero',
  },
  'actividad-tramitadores': {
    label: 'Informe de Actividad y Productividad de Tramitadores',
    description: 'Análisis de actividad de tramitadores: expedientes gestionados, tiempos de respuesta y KPIs de productividad.',
    redirect: '/usuarios/cargas',
    status: 'partial',
    categoria: 'actividad',
  },
  'agendas': {
    label: 'Informe de Agendas',
    description: 'Informe de citas y visitas agendadas por período, operario y compañía. Estado de realización y ratios de éxito.',
    status: 'new',
    categoria: 'actividad',
  },
  'autovisitas': {
    label: 'Informe de Autovisitas',
    description: 'Listado de visitas realizadas a través del portal de autocita. Métricas de adopción del canal y satisfacción del asegurado.',
    status: 'new',
    categoria: 'calidad',
  },
  'baremos': {
    label: 'Informe de Baremos',
    description: 'Informe de baremos facturados por expediente, operario y compañía. Comparativa de precios aplicados vs. tarifas base.',
    status: 'new',
    categoria: 'financiero',
  },
  'cobros-grupo': {
    label: 'Informe de Cobros del Grupo Apuyen',
    description: 'Informe consolidado de cobros del grupo de compañías. Seguimiento de pagos recibidos, pendientes y vencidos.',
    status: 'new',
    categoria: 'financiero',
  },
  'colores-facturacion': {
    label: 'Informe de Colores de Facturación',
    description: 'Informe de facturación segmentado por código de color (categoría económica). Análisis por tipo de trabajo y rango de importe.',
    status: 'new',
    categoria: 'financiero',
  },
  'costes-medios': {
    label: 'Informe de Costes Medios',
    description: 'Análisis de costes medios por tipo de siniestro, compañía y especialidad. Comparativa entre períodos y benchmarks internos.',
    status: 'new',
    categoria: 'financiero',
  },
  'encuestas': {
    label: 'Informe de Encuestas',
    description: 'Resultados de encuestas de satisfacción post-servicio. NPS, valoraciones medias y análisis de comentarios por compañía.',
    status: 'new',
    categoria: 'calidad',
  },
  'gremios-expediente': {
    label: 'Informe de Gremios por Expediente',
    description: 'Distribución de expedientes por gremio o especialidad. Tiempos medios, costes y operarios asignados por especialidad.',
    status: 'new',
    categoria: 'siniestros',
  },
  'incidencias': {
    label: 'Informe de Incidencias',
    description: 'Registro y análisis de incidencias en expedientes: reclamaciones, revisitas y expedientes con resolución fallida.',
    status: 'new',
    categoria: 'calidad',
  },
  'llamadas': {
    label: 'Informe de Llamadas',
    description: 'Log de llamadas entrantes y salientes registradas en la centralita. Duración, estado y vinculación con expedientes.',
    status: 'new',
    categoria: 'actividad',
  },
  'rentabilidad-global': {
    label: 'Informe de Rentabilidad Global',
    description: 'Análisis de rentabilidad global de la operación: ingresos vs. costes por compañía, período y tipo de siniestro.',
    redirect: '/rentabilidad',
    status: 'implemented',
    categoria: 'financiero',
  },
  'rentabilidad-global-facturacion': {
    label: 'Informe de Rentabilidad Global Facturación',
    description: 'Análisis de rentabilidad desde la perspectiva de facturación: márgenes por compañía y tipo de trabajo facturado.',
    status: 'new',
    categoria: 'financiero',
  },
  'especialidad-pendiente': {
    label: 'Informe de Servicios por Especialidad Pendiente',
    description: 'Expedientes con servicios de especialidades específicas pendientes de asignación o finalización.',
    status: 'new',
    categoria: 'siniestros',
  },
  'siniestros': {
    label: 'Informe de Siniestros',
    description: 'Informe maestro de siniestros por compañía, período, estado y tipo. Base para auditoría y reporting a compañías aseguradoras.',
    status: 'new',
    categoria: 'siniestros',
  },
  'tiempos-visita': {
    label: 'Informe de Tiempos de Visita por Operario y Gremio',
    description: 'Análisis de tiempos de visita por operario y gremio. Identifica desviaciones respecto a tiempos estándar por tipo de trabajo.',
    status: 'new',
    categoria: 'operarios',
  },
  'tiempos-autonomos': {
    label: 'Informe de Tiempos y Costes de Operarios Autónomos',
    description: 'Detalle de tiempos y costes de operarios autónomos. Horas trabajadas, desplazamientos, importes y margen por operario.',
    status: 'new',
    categoria: 'operarios',
  },
  'tiempos-contratados': {
    label: 'Informe de Tiempos y Costes de Operarios Contratados',
    description: 'Detalle de tiempos y costes de operarios en plantilla. Horas, productividad, coste hora y comparativa por especialidad.',
    status: 'new',
    categoria: 'operarios',
  },
  'tipos-dano': {
    label: 'Informe de Tipos de Daño',
    description: 'Distribución de expedientes por tipo de daño declarado. Tendencias, estacionalidad y comparativa entre compañías.',
    status: 'new',
    categoria: 'siniestros',
  },
  'trabajos-operarios': {
    label: 'Informe de Trabajos de Operarios',
    description: 'Listado de trabajos realizados por operario en un período. Estado de revisión, importes liquidados y pendientes.',
    status: 'new',
    categoria: 'operarios',
  },
  'trabajos-expediente': {
    label: 'Informe de Trabajos por Expediente',
    description: 'Detalle de todos los trabajos realizados en cada expediente: gremios, operarios, fechas e importes.',
    status: 'new',
    categoria: 'siniestros',
  },
  'tramitacion': {
    label: 'Informe de Tramitación',
    description: 'Estado de tramitación del portfolio: expedientes por estado, tiempos de permanencia y cuellos de botella por fase.',
    status: 'new',
    categoria: 'actividad',
  },
  'geografico': {
    label: 'Informe Geográfico',
    description: 'Distribución geográfica de siniestros por provincia, comunidad autónoma y código postal. Mapas de densidad y análisis territorial.',
    status: 'new',
    categoria: 'siniestros',
  },
  'pedidos': {
    label: 'Informe Pedidos',
    description: 'Estado del portfolio de pedidos de material: pendientes, confirmados, enviados y caducados por proveedor y período.',
    redirect: '/pedidos',
    status: 'partial',
    categoria: 'administrativo',
  },
  'planning-operario': {
    label: 'Informe Planning Operario',
    description: 'Planning individual de cada operario: citas asignadas, disponibilidad, bloqueos y ratio de ocupación por semana.',
    status: 'new',
    categoria: 'operarios',
  },
  'personalizados': {
    label: 'Informes Personalizados',
    description: 'Constructor de informes personalizados. Permite definir filtros, columnas y agrupaciones para exportar a Excel o PDF.',
    status: 'new',
    categoria: 'administrativo',
  },
  'listado-clientes': {
    label: 'Listado de Clientes',
    description: 'Directorio completo de asegurados y clientes: datos de contacto, historial de siniestros y estado de relación.',
    status: 'new',
    categoria: 'administrativo',
  },
  'cuentas-activos': {
    label: 'Listado de Cuentas de Siniestros Activos',
    description: 'Listado de cuentas bancarias asociadas a siniestros activos para gestión de pagos y liquidaciones pendientes.',
    status: 'new',
    categoria: 'financiero',
  },
  'prevision-costes': {
    label: 'Previsión de Costes Medios',
    description: 'Proyección de costes medios para el portfolio activo. Base para provisiones contables y reporting a dirección financiera.',
    status: 'new',
    categoria: 'financiero',
  },
  'registro-log': {
    label: 'Registro Log',
    description: 'Log de actividad del sistema: acciones de usuarios, integraciones externas, errores y eventos de dominio procesados.',
    status: 'new',
    categoria: 'administrativo',
  },
  'rentabilidad-operarios': {
    label: 'Rentabilidad de Operarios',
    description: 'Análisis de rentabilidad por operario: ingresos generados, costes asignados y margen neto por operario en el período.',
    redirect: '/rentabilidad',
    status: 'partial',
    categoria: 'operarios',
  },
  'rentabilidad-companias': {
    label: 'Rentabilidad de Operarios / Compañías',
    description: 'Cruce de rentabilidad entre operarios y compañías aseguradoras. Identifica las combinaciones más y menos rentables.',
    status: 'new',
    categoria: 'operarios',
  },
  'rentabilidad-trabajos': {
    label: 'Rentabilidad de Trabajos de Operarios / Compañías',
    description: 'Rentabilidad desglosada por tipo de trabajo, operario y compañía. Ranking de trabajos más rentables.',
    status: 'new',
    categoria: 'operarios',
  },
  'saldos': {
    label: 'Saldos',
    description: 'Saldos pendientes de cobro/pago por compañía. Antigüedad de saldos, vencimientos próximos y saldos en disputa.',
    status: 'new',
    categoria: 'financiero',
  },
  'trabajos-no-liquidados': {
    label: 'Trabajos No Liquidados',
    description: 'Listado de trabajos de operarios finalizados pendientes de liquidación económica. Importe pendiente y días de antigüedad.',
    status: 'new',
    categoria: 'operarios',
  },
  'trabajos-subsanados': {
    label: 'Trabajos Subsanados de Compañía',
    description: 'Trabajos que han requerido subsanación o revisita por exigencia de la compañía aseguradora. Coste de la subsanación.',
    status: 'new',
    categoria: 'operarios',
  },
  'vacaciones-operarios': {
    label: 'Vacaciones de Operarios',
    description: 'Calendario de vacaciones y ausencias de operarios. Períodos solicitados, aprobados y solapamientos con carga operativa.',
    status: 'new',
    categoria: 'operarios',
  },
  'visitas-presupuestos-pendientes': {
    label: 'Visitas con Presupuestos PENDIENTES',
    description: 'Visitas finalizadas cuyo presupuesto aún no ha sido enviado a la compañía. Riesgo de demora en aprobación.',
    status: 'new',
    categoria: 'presupuestos',
  },
  'visitas-presupuestos-aprobar': {
    label: 'Visitas con Presupuestos por APROBAR',
    description: 'Presupuestos enviados a la compañía pendientes de aprobación o rechazo. Importe en espera y días transcurridos.',
    status: 'new',
    categoria: 'presupuestos',
  },
  'visitas-activas-domicilio': {
    label: 'Visitas pendientes de FINALIZAR, en domicilio',
    description: 'Visitas activas donde el operario se encuentra en el domicilio sin haber finalizado el parte. Alerta operativa en tiempo real.',
    status: 'new',
    categoria: 'siniestros',
  },
};

// ─── Colores de categoría ────────────────────────────────────────────────────

const CATEGORIA_COLORS: Record<string, string> = {
  financiero:    'var(--color-success)',
  operarios:     'var(--color-accent)',
  comerciales:   'var(--blue-400)',
  siniestros:    'var(--color-warning)',
  presupuestos:  'var(--amber-500)',
  calidad:       'var(--color-info)',
  administrativo: 'var(--color-text-secondary)',
  actividad:     'var(--slate-400)',
};

const CATEGORIA_LABELS: Record<string, string> = {
  financiero:    'Financiero',
  operarios:     'Operarios',
  comerciales:   'Comerciales',
  siniestros:    'Siniestros',
  presupuestos:  'Presupuestos',
  calidad:       'Calidad',
  administrativo: 'Administrativo',
  actividad:     'Actividad',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  implemented: { label: 'Implementado',            color: 'var(--color-success)' },
  partial:     { label: 'En desarrollo parcial',    color: 'var(--amber-600)' },
  new:         { label: 'Planificado — en backlog', color: 'var(--color-text-tertiary)' },
};

// ─── InformeOperacionesPage ───────────────────────────────────────────────────

export function InformeOperacionesPage() {
  const { reportId } = useParams<{ reportId: string }>();

  const informe = reportId ? INFORMES[reportId] : undefined;

  // Si tiene ruta propia en el ERP, redirigir
  if (informe?.redirect) {
    return <Navigate to={informe.redirect} replace />;
  }

  if (!informe) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-4)', padding: 'var(--space-8)', textAlign: 'center' }}>
        <BarChart2 size={40} style={{ color: 'var(--color-text-tertiary)' }} />
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
          Informe no encontrado
        </h1>
        <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {reportId}
        </code>
        <Link to="/expedientes" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ArrowLeft size={14} /> Volver
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[informe.status];
  const catColor = CATEGORIA_COLORS[informe.categoria] ?? 'var(--color-text-secondary)';
  const catLabel = CATEGORIA_LABELS[informe.categoria] ?? informe.categoria;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 'var(--space-6)',
      padding: 'var(--space-8)',
      textAlign: 'center',
    }}>
      {/* Icono */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-tertiary)',
      }}>
        <BarChart2 size={32} />
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-default)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-medium)',
          color: statusInfo.color,
        }}>
          {statusInfo.label}
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-default)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-medium)',
          color: catColor,
        }}>
          {catLabel}
        </span>
      </div>

      {/* Título */}
      <h1 style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-text-primary)',
        margin: 0,
        maxWidth: 560,
      }}>
        {informe.label}
      </h1>

      {/* Descripción */}
      <p style={{
        fontSize: 'var(--text-md)',
        color: 'var(--color-text-secondary)',
        maxWidth: 520,
        lineHeight: 1.6,
        margin: 0,
      }}>
        {informe.description}
      </p>

      {/* Ruta técnica */}
      <code style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-bg-subtle)',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
      }}>
        /servicios/informes/{reportId}
      </code>

      {/* Navegación */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/expedientes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-accent)',
            textDecoration: 'none',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          <ArrowLeft size={14} />
          Volver a Siniestros
        </Link>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
          }}
        >
          <ExternalLink size={12} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
