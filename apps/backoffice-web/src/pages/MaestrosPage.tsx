import { Link } from 'react-router-dom';
import { Building2, HardHat, Landmark } from 'lucide-react';

/**
 * MaestrosPage — Panel de acceso rápido a maestros.
 * Las gestiones individuales están ahora en páginas dedicadas:
 *  · Compañías → /companias
 *  · Operarios → /operarios-config
 *  · Empresas  → /empresas
 */
export function MaestrosPage() {
  return (
    <div className="page-maestros">
      <div className="page-header">
        <h2>Maestros</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Accede a la gestión de entidades maestras desde la sección Configuración del sidebar.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <Link to="/companias" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <Building2 size={28} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Compañías / Corr. / AF</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aseguradoras, corredores y agencias</div>
            </div>
          </div>
        </Link>

        <Link to="/operarios-config" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <HardHat size={28} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Operarios</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gestión y especialidades</div>
            </div>
          </div>
        </Link>

        <Link to="/empresas" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <Landmark size={28} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Empresas Facturadoras</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sociedades del grupo</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
