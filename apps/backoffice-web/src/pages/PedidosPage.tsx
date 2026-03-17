import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePedidos } from '@/hooks/usePedidos';

const ESTADO_COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  enviado: '#3b82f6',
  confirmado: '#22c55e',
  listo_para_recoger: '#14b8a6',
  recogido: '#6b7280',
  caducado: '#ef4444',
  cancelado: '#4b5563',
};

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'listo_para_recoger', label: 'Listo para recoger' },
  { value: 'recogido', label: 'Recogido' },
  { value: 'caducado', label: 'Caducado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function PedidosPage() {
  const navigate = useNavigate();
  const [estadoFilter, setEstadoFilter] = useState('');
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [expedienteSearch, setExpedienteSearch] = useState('');

  const { data, isLoading } = usePedidos({
    estado: estadoFilter || undefined,
    proveedor: proveedorSearch || undefined,
    expediente: expedienteSearch || undefined,
  });

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  return (
    <div className="page-pedidos">
      <div className="page-header">
        <h2>Pedidos de material</h2>
      </div>

      <div className="filters-bar">
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="filter-select"
        >
          {ESTADO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Buscar proveedor..."
          value={proveedorSearch}
          onChange={(e) => setProveedorSearch(e.target.value)}
          className="search-input"
        />
        <input
          type="search"
          placeholder="Buscar expediente..."
          value={expedienteSearch}
          onChange={(e) => setExpedienteSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {isLoading ? (
        <div className="loading">Cargando pedidos...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron pedidos</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Expediente</th>
              <th>Proveedor</th>
              <th>Estado</th>
              <th>Fecha límite</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)} style={{ cursor: 'pointer' }}>
                <td><strong>{p.numero_pedido}</strong></td>
                <td>
                  <Link to={`/expedientes/${p.expediente_id}`} className="link" onClick={(e) => e.stopPropagation()}>
                    {p.numero_expediente ?? p.expediente_id}
                  </Link>
                </td>
                <td>{p.proveedor_nombre ?? p.proveedor_id}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: ESTADO_COLORS[p.estado] ?? '#6b7280' }}>
                    {p.estado?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>{p.fecha_limite ? new Date(p.fecha_limite).toLocaleDateString('es-ES') : '—'}</td>
                <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
