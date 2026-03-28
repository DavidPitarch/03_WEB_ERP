import { Globe, ExternalLink, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MultiasistenciaPage() {
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
        <Globe size={32} />
      </div>

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
        color: 'var(--amber-600)',
      }}>
        En desarrollo parcial
      </div>

      <h1 style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-text-primary)',
        margin: 0,
      }}>
        Web Multiasistencia
      </h1>

      <p style={{
        fontSize: 'var(--text-md)',
        color: 'var(--color-text-secondary)',
        maxWidth: 520,
        lineHeight: 1.6,
        margin: 0,
      }}>
        Interfaz de conexión y gestión con la plataforma Web Multiasistencia (frepasos.php).
        Permite importar y sincronizar expedientes desde la plataforma externa de asignación
        de servicios multiasistencia. Requiere configuración de credenciales de integración.
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Integración pendiente
        </div>
        {[
          'Importación automática de expedientes',
          'Sincronización bidireccional de estados',
          'Gestión de frepasos y reasignaciones',
          'Log de intercambio de mensajes',
        ].map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <ExternalLink size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>

      <code style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-bg-subtle)',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
      }}>
        /servicios/multiasistencia
      </code>

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
