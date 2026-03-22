import { Hourglass } from 'lucide-react';

export function TrabajosPendientesPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Trabajos Pendientes de Revisión</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Hourglass size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Partes Enviados por Operarios</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Lista de trabajos que el operario ha finalizado y enviado desde la app,
          pero que todavía no han sido revisados por el gestor.
          Validar o rechazar con comentario para proceder a facturación.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
