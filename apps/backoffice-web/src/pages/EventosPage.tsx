import { Zap } from 'lucide-react';

export function EventosPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Eventos y Automatización</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Zap size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Flujos Automatizados</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Creación y configuración de reglas de automatización: triggers por cambio de estado,
          tiempo transcurrido o asignación de operario. Acciones: envío de mensajes, creación de tareas,
          alertas y webhooks externos. Incluye agentes de IA configurables.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
