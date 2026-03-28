import { Lock, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PlanningBloqueosPage() {
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
        <Lock size={32} />
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
        color: 'var(--color-text-tertiary)',
      }}>
        Planificado — en backlog
      </div>

      <h1 style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-text-primary)',
        margin: 0,
      }}>
        Bloqueos del Planning
      </h1>

      <p style={{
        fontSize: 'var(--text-md)',
        color: 'var(--color-text-secondary)',
        maxWidth: 480,
        lineHeight: 1.6,
        margin: 0,
      }}>
        Gestión de bloqueos en el planning mensual. Permite marcar rangos de fechas
        como bloqueados para operarios (vacaciones, bajas, festivos, etc.),
        impidiendo la asignación de citas en esos períodos.
      </p>

      <code style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        background: 'var(--color-bg-subtle)',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
      }}>
        /planning/bloqueos
      </code>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/planning"
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
          <Calendar size={14} />
          Ir al Planning Mensual
        </Link>
        <Link
          to="/planning/geo"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
          }}
        >
          Planning Geográfico
        </Link>
      </div>
    </div>
  );
}
