import { Map } from 'lucide-react';

export function PlanningGeograficoPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Planning Geográfico</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Map size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Geolocalización de Expedientes y Operarios</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Mapa interactivo con la geolocalización en tiempo real de expedientes activos y operarios.
          Visualización de zonas de cobertura por código postal, optimización de asignaciones
          y rutas. Tecnología: OpenStreetMap + Leaflet.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
