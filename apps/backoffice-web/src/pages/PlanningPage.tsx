import { CalendarDays } from 'lucide-react';

export function PlanningPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Planning</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <CalendarDays size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Planning Mensual de Citas</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Calendario mensual con todas las citas asignadas a los intervinientes del proceso:
          operarios propios, autónomos y empresas de servicios. Filtros por operario, estado y tipo.
          Creación de citas directamente desde el calendario.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
