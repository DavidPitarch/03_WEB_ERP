import { Tag } from 'lucide-react';

export function EspecialidadesPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Especialidades</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Tag size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Configuración de Especialidades</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Panel para configurar las especialidades (gremios) aplicables a cada compañía cliente:
          fontanería, albañilería, carpintería, electricidad, pintura, etc.
          Visibilidad de qué operarios están disponibles para cada especialidad.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
