import { Layers } from 'lucide-react';

export function ConfigEmisionPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Configuración de Emisión</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <Layers size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Series, Numeración y Cuentas Bancarias</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Configuración de series de facturación, numeración, asignaciones por empresa,
          cuentas bancarias y parámetros de emisión de documentos fiscales.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
