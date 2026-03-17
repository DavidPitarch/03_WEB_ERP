import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFacturas } from '@/hooks/useFacturas';

const ESTADO_COLORS: Record<string, string> = {
  borrador: '#6b7280',
  emitida: '#3b82f6',
  enviada: '#8b5cf6',
  cobrada: '#22c55e',
  anulada: '#ef4444',
};

const COBRO_COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  reclamada: '#f97316',
  cobrada: '#22c55e',
  vencida: '#ef4444',
  incobrable: '#6b7280',
};

export function FacturasPage() {
  const navigate = useNavigate();
  const [estadoFilter, setEstadoFilter] = useState('');
  const [cobroFilter, setCobroFilter] = useState('');
  const [companiaFilter, setCompaniaFilter] = useState('');

  const filters: Record<string, any> = {
    estado: estadoFilter || undefined,
    estado_cobro: cobroFilter || undefined,
    compania_id: companiaFilter || undefined,
  };

  const { data, isLoading } = useFacturas(filters);
  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const companias = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((r: any) => {
      if (r.compania_id && r.compania_nombre) map.set(r.compania_id, r.compania_nombre);
    });
    return Array.from(map, ([id, nombre]) => ({ id, nombre }));
  }, [items]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (estadoFilter) params.set('estado', estadoFilter);
    if (cobroFilter) params.set('estado_cobro', cobroFilter);
    if (companiaFilter) params.set('compania_id', companiaFilter);
    const qs = params.toString();
    window.open(`/api/v1/facturas/export${qs ? `?${qs}` : ''}`, '_blank');
  };

  return (
    <div className="page-facturas">
      <div className="page-header">
        <h2>Facturas</h2>
        <button className="btn btn-secondary" onClick={handleExport}>Exportar</button>
      </div>

      <div className="filters-bar">
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="filter-select">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="emitida">Emitida</option>
          <option value="enviada">Enviada</option>
          <option value="cobrada">Cobrada</option>
          <option value="anulada">Anulada</option>
        </select>
        <select value={cobroFilter} onChange={(e) => setCobroFilter(e.target.value)} className="filter-select">
          <option value="">Todos los cobros</option>
          <option value="pendiente">Pendiente</option>
          <option value="reclamada">Reclamada</option>
          <option value="cobrada">Cobrada</option>
          <option value="vencida">Vencida</option>
          <option value="incobrable">Incobrable</option>
        </select>
        <select value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} className="filter-select">
          <option value="">Todas las compañías</option>
          {companias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando facturas...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron facturas</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Factura</th>
              <th>Expediente</th>
              <th>Compañía</th>
              <th>Empresa</th>
              <th>Serie</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Cobro</th>
              <th>Cobrado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f: any) => (
              <tr key={f.id} onClick={() => navigate(`/facturas/${f.id}`)} style={{ cursor: 'pointer' }}>
                <td><strong>{f.numero_factura}</strong></td>
                <td>
                  <Link to={`/expedientes/${f.expediente_id}`} className="link" onClick={(e) => e.stopPropagation()}>
                    {f.numero_expediente}
                  </Link>
                </td>
                <td>{f.compania_nombre}</td>
                <td>{f.empresa_nombre}</td>
                <td>{f.serie_nombre}</td>
                <td>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-ES') : '—'}</td>
                <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</td>
                <td>{Number(f.total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: ESTADO_COLORS[f.estado] ?? '#6b7280' }}>
                    {f.estado?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: COBRO_COLORS[f.estado_cobro] ?? '#6b7280' }}>
                    {f.estado_cobro?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>{Number(f.total_cobrado ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
