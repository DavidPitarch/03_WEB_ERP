import { ClipboardList } from 'lucide-react';

export function EncuestasPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Encuestas</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <ClipboardList size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Encuestas de Satisfacción</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Sistema de encuestas de satisfacción para clientes. Creación de plantillas con preguntas NPS,
          escalas y texto libre. Dashboard de resultados con score NPS, tasa de respuesta y tendencias.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
