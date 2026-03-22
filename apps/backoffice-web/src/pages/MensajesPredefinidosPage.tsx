import { MessageSquare } from 'lucide-react';

export function MensajesPredefinidosPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Mensajes Predefinidos</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <MessageSquare size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Plantillas de Mensajes</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Creación y gestión de plantillas de mensajes para WhatsApp y SMS.
          Editor con variables dinámicas (nombre asegurado, número expediente, fecha cita, etc.)
          y preview en tiempo real.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
