import { UserCircle } from 'lucide-react';

export function ClientesPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Clientes</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <UserCircle size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>BBDD de Asegurados e Intervinientes</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Base de datos centralizada de todos los asegurados e intervinientes registrados en el ERP:
          historial de expedientes, comunicaciones y datos de contacto.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
