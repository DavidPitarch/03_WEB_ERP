import { CreditCard } from 'lucide-react';

export function BancosPage() {
  return (
    <div className="page-stub">
      <div className="page-header">
        <h2>Bancos y Cuentas</h2>
      </div>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <CreditCard size={56} style={{ opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Gestión Bancaria</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
          Identificación de cuentas bancarias propias y de operarios/proveedores.
          Integración vía API con entidades bancarias, generación de enlaces de pago
          configurables para envío a clientes.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>En desarrollo</p>
      </div>
    </div>
  );
}
