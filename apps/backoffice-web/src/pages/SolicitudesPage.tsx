import { useState } from 'react';
import { useAlertas, useResolverAlerta, usePosponerAlerta, useDescartarAlerta } from '@/hooks/useAlertas';
import { Bell, CheckCircle, Clock, Trash2 } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  sla_riesgo: 'SLA en riesgo',
  sla_vencido: 'SLA vencido',
  informe_caducado: 'Informe caducado',
  tarea_pendiente: 'Tarea pendiente',
  factura_caducada: 'Factura caducada',
  sistema: 'Sistema',
};

const TIPO_COLORS: Record<string, string> = {
  sla_vencido: '#ef4444',
  informe_caducado: '#ef4444',
  factura_caducada: '#ef4444',
  sla_riesgo: '#f59e0b',
  tarea_pendiente: '#3b82f6',
  sistema: '#6b7280',
};

export function SolicitudesPage() {
  const [tipoFilter, setTipoFilter] = useState('');
  const { data: res, isLoading } = useAlertas(tipoFilter ? { tipo: tipoFilter } : undefined);
  const resolverMut = useResolverAlerta();
  const posponerMut = usePosponerAlerta();
  const descartarMut = useDescartarAlerta();

  const alertas = res && 'data' in res ? (res.data as any[]) ?? [] : [];

  const handlePosponer = (id: string) => {
    const hasta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    posponerMut.mutate({ id, hasta });
  };

  return (
    <div className="page-solicitudes">
      <div className="page-header">
        <h2>Solicitudes / Avisos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <Bell size={16} />
          <span>{alertas.length} avisos activos</span>
        </div>
      </div>

      <div className="filters-bar">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="loading">Cargando avisos...</div>}

      {!isLoading && alertas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>No hay solicitudes o avisos pendientes</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {alertas.map((alerta: any) => (
          <div
            key={alerta.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${TIPO_COLORS[alerta.tipo] ?? '#6b7280'}`,
              borderRadius: '0.5rem',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: TIPO_COLORS[alerta.tipo] ?? '#6b7280',
                  background: `${TIPO_COLORS[alerta.tipo] ?? '#6b7280'}20`,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.25rem',
                }}>
                  {TIPO_LABELS[alerta.tipo] ?? alerta.tipo}
                </span>
                {alerta.expediente_id && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Exp. {alerta.expediente_ref ?? alerta.expediente_id}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>{alerta.mensaje}</p>
              {alerta.created_at && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(alerta.created_at).toLocaleString('es-ES')}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                className="btn-link"
                title="Posponer 24h"
                onClick={() => handlePosponer(alerta.id)}
                disabled={posponerMut.isPending}
              >
                <Clock size={15} />
              </button>
              <button
                className="btn-link"
                title="Resolver"
                onClick={() => resolverMut.mutate(alerta.id)}
                disabled={resolverMut.isPending}
                style={{ color: '#10b981' }}
              >
                <CheckCircle size={15} />
              </button>
              <button
                className="btn-link"
                title="Descartar"
                onClick={() => descartarMut.mutate(alerta.id)}
                disabled={descartarMut.isPending}
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
