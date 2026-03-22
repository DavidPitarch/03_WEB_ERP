import { Calendar } from 'lucide-react';

export function CalendarioPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Calendario</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Calendar size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Calendario Laboral y Festivos</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Gestión del calendario anual: festivos nacionales y regionales, periodos de vacaciones
          de operarios, guardias y bajas. Utilizado por el motor de SLA para cálculo de plazos.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
