import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AgendaItem } from '@erp/types';

const PRIORIDAD_COLORS: Record<string, string> = {
  baja: '#6b7280', media: '#2563eb', alta: '#f59e0b', urgente: '#ef4444',
};

export function AgendaPage() {
  const today = new Date().toISOString().split('T')[0];
  const [fechaDesde, setFechaDesde] = useState(today);

  const { data: res, isLoading, isError, refetch } = useQuery({
    queryKey: ['agenda', fechaDesde],
    queryFn: () => api.get<AgendaItem[]>(`/me/agenda?fecha_desde=${fechaDesde}`),
    refetchInterval: 60_000,
  });

  const error = res && 'error' in res && res.error ? res.error : null;
  const items = res && 'data' in res && res.data ? (res.data as AgendaItem[]) : [];

  const grouped = items.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    const d = item.fecha;
    if (!acc[d]) acc[d] = [];
    acc[d].push(item);
    return acc;
  }, {});

  const formatDate = (d: string) => {
    if (d === today) return 'Hoy';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d === tomorrow.toISOString().split('T')[0]) return 'Mañana';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  return (
    <div className="op-agenda">
      <div className="op-agenda-header">
        <h2>Mi agenda</h2>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="op-date-input" />
      </div>

      {isLoading ? (
        <div className="op-loading">Cargando agenda...</div>
      ) : isError || error ? (
        <div className="op-error">
          {error?.message ?? 'Error al cargar la agenda'}
          <button onClick={() => refetch()} className="op-btn-secondary" style={{ marginLeft: '0.5rem' }}>Reintentar</button>
        </div>
      ) : items.length === 0 ? (
        <div className="op-empty">No hay citas programadas</div>
      ) : (
        Object.entries(grouped).map(([fecha, citas]) => (
          <div key={fecha} className="op-agenda-group">
            <h3 className="op-agenda-date">{formatDate(fecha)}</h3>
            {citas.map((item) => (
              <Link to={`/claim/${item.expediente_id}`} key={item.cita_id} className="op-cita-card">
                <div className="op-cita-header">
                  <span className="op-cita-time">{item.franja_inicio} - {item.franja_fin}</span>
                  <span className="op-cita-ref">{item.numero_expediente}</span>
                  {item.tiene_parte && <span className="op-badge-done">Parte enviado</span>}
                </div>
                <div className="op-cita-body">
                  <div className="op-cita-type" style={{ borderLeftColor: PRIORIDAD_COLORS[item.prioridad] ?? '#6b7280' }}>
                    {item.tipo_siniestro}
                  </div>
                  <div className="op-cita-address">
                    {item.direccion_siniestro}, {item.codigo_postal} {item.localidad}
                  </div>
                  <div className="op-cita-client">
                    {item.asegurado_nombre} {item.asegurado_apellidos} — {item.asegurado_telefono}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
