import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

/**
 * Página genérica para módulos no implementados o en desarrollo.
 * Muestra el nombre del módulo, su descripción y el estado de implementación.
 * Cuando el módulo esté listo, simplemente se sustituye esta página por la real.
 */

interface PlaceholderPageProps {
  /** Nombre del módulo que se muestra */
  moduleName?: string;
  /** Descripción funcional del módulo */
  description?: string;
  /** Estado de implementación para mostrar el mensaje correcto */
  status?: 'partial' | 'conceptual' | 'new';
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  partial:    { label: 'En desarrollo parcial',      color: 'var(--amber-600)' },
  conceptual: { label: 'Definido — pendiente de dev', color: 'var(--blue-600)' },
  new:        { label: 'Planificado — en backlog',    color: 'var(--slate-500)' },
};

export function PlaceholderPage({ moduleName, description, status = 'new' }: PlaceholderPageProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Permite pasar metadata por query params desde App.tsx si se desea
  const name   = moduleName  ?? searchParams.get('module')  ?? location.pathname.split('/').filter(Boolean).pop() ?? 'Módulo';
  const desc   = description ?? searchParams.get('desc')    ?? 'Este módulo está planificado y se implementará en próximas iteraciones.';
  const st     = (searchParams.get('status') as PlaceholderPageProps['status']) ?? status;
  const statusInfo = STATUS_LABELS[st] ?? STATUS_LABELS['new'];

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
        <Construction size={32} />
      </div>

      {/* Estado */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-default)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        color: statusInfo.color,
      }}>
        {statusInfo.label}
      </div>

      {/* Título */}
      <h1 style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-text-primary)',
        margin: 0,
        textTransform: 'capitalize',
      }}>
        {name}
      </h1>

      {/* Descripción */}
      <p style={{
        fontSize: 'var(--text-md)',
        color: 'var(--color-text-secondary)',
        maxWidth: 480,
        lineHeight: 1.6,
        margin: 0,
      }}>
        {desc}
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
        {location.pathname}
      </code>

      {/* Volver */}
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
    </div>
  );
}
