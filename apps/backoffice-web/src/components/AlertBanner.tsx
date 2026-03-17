import { useAlertas, useResolverAlerta, usePosponerAlerta, useDescartarAlerta } from '@/hooks/useAlertas';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const PRIORIDAD_ORDER = { urgente: 0, alta: 1, media: 2, baja: 3 };

export function AlertBanner() {
  const { data: res } = useAlertas();
  const resolver = useResolverAlerta();
  const posponer = usePosponerAlerta();
  const descartar = useDescartarAlerta();
  const [collapsed, setCollapsed] = useState(false);
  const [posponerId, setPosponerId] = useState<string | null>(null);
  const [posponerFecha, setPosponerFecha] = useState('');

  const alertas = res && 'data' in res ? (res.data ?? []) as any[] : [];
  if (alertas.length === 0) return null;

  const sorted = [...alertas].sort((a, b) =>
    (PRIORIDAD_ORDER[a.prioridad as keyof typeof PRIORIDAD_ORDER] ?? 2) -
    (PRIORIDAD_ORDER[b.prioridad as keyof typeof PRIORIDAD_ORDER] ?? 2)
  );

  return (
    <div className={`alert-banner ${collapsed ? 'alert-banner-collapsed' : ''}`}>
      <div className="alert-banner-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="alert-banner-icon">!</span>
        <span>{alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}</span>
        <span className="alert-banner-toggle">{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div className="alert-banner-list">
          {sorted.slice(0, 10).map((a) => (
            <div key={a.id} className={`alert-item alert-${a.prioridad}`}>
              <div className="alert-item-content">
                <span className={`badge badge-prio-${a.prioridad}`}>{a.tipo}</span>
                <span className="alert-item-title">{a.titulo}</span>
                {a.expediente_id && (
                  <Link to={`/expedientes/${a.expediente_id}`} className="link alert-item-link">Ver exp.</Link>
                )}
              </div>
              <div className="alert-item-actions">
                <button className="btn-xs btn-success" onClick={() => resolver.mutate(a.id)} title="Resolver">OK</button>
                {posponerId === a.id ? (
                  <span className="alert-posponer-inline">
                    <input type="date" value={posponerFecha} onChange={(e) => setPosponerFecha(e.target.value)} />
                    <button className="btn-xs" disabled={!posponerFecha} onClick={() => { posponer.mutate({ id: a.id, hasta: new Date(posponerFecha).toISOString() }); setPosponerId(null); }}>OK</button>
                  </span>
                ) : (
                  <button className="btn-xs btn-warning" onClick={() => setPosponerId(a.id)} title="Posponer">Posp.</button>
                )}
                <button className="btn-xs btn-secondary" onClick={() => descartar.mutate(a.id)} title="Descartar">X</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
