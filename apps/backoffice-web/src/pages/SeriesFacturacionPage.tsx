import { ListOrdered } from 'lucide-react';

export function SeriesFacturacionPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Líneas de Facturación</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <ListOrdered size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Series de Facturación</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Configuración de series de facturación para cada operario autónomo, proveedor y compañía cliente.
          Gestión de prefijos, contadores y formatos de numeración de facturas.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
