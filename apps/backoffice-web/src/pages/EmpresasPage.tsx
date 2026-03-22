import { Landmark } from 'lucide-react';

export function EmpresasPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Empresas Facturadoras</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Landmark size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Sociedades del Grupo</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Configuración de las sociedades del grupo que pueden facturar expedientes:
          datos fiscales, cuentas bancarias, series de facturación asignadas y configuración de cabeceras de factura.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
