import { ClipboardPlus } from 'lucide-react';

export function AsignacionesPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Asignaciones</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <ClipboardPlus size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Cola de Asignaciones</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Bandeja de entrada con los nuevos servicios y encargos pendientes de asignación:
          llegados manualmente o integrados vía comunicación de compañías de seguros.
          Asignación directa de operario con vista de carga de trabajo.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
