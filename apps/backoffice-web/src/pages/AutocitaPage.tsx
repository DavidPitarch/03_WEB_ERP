import { CalendarCheck } from 'lucide-react';

export function AutocitaPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Autocita</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <CalendarCheck size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Sistema de Autocita</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Automatización del proceso de citas: configuración de ventanas horarias disponibles por compañía,
          días de anticipación, mensajes automáticos de confirmación y recordatorio.
          Los asegurados pueden autocitar a través de un enlace seguro.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
