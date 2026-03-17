import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePedidosCaducados, useCancelarPedido, useEnviarPedido } from '@/hooks/usePedidos';

export function PedidosCaducadosPage() {
  const [proveedorFilter, setProveedorFilter] = useState('');
  const [diasMin, setDiasMin] = useState('');

  const { data, isLoading } = usePedidosCaducados({
    proveedor: proveedorFilter || undefined,
    dias_min: diasMin || undefined,
  });

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const cancelar = useCancelarPedido();
  const enviar = useEnviarPedido();

  const handleCancelar = (id: string) => {
    const motivo = prompt('Motivo de la cancelación:');
    if (motivo !== null) {
      cancelar.mutate({ id, motivo: motivo || undefined });
    }
  };

  const handleReenviar = (id: string) => {
    if (confirm('¿Reenviar este pedido al proveedor?')) {
      enviar.mutate(id);
    }
  };

  return (
    <div className="page-pedidos-caducados">
      <div className="page-header">
        <h2>Pedidos caducados</h2>
      </div>

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Buscar proveedor..."
          value={proveedorFilter}
          onChange={(e) => setProveedorFilter(e.target.value)}
          className="search-input"
        />
        <input
          type="number"
          placeholder="Días mínimos retraso"
          value={diasMin}
          onChange={(e) => setDiasMin(e.target.value)}
          className="search-input"
          min={0}
        />
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay pedidos caducados</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Expediente</th>
              <th>Proveedor</th>
              <th>Fecha límite</th>
              <th>Días retraso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id}>
                <td><strong>{p.numero_pedido}</strong></td>
                <td>
                  <Link to={`/expedientes/${p.expediente_id}`} className="link">
                    {p.numero_expediente ?? p.expediente_id}
                  </Link>
                </td>
                <td>{p.proveedor_nombre ?? p.proveedor_id}</td>
                <td>{p.fecha_limite ? new Date(p.fecha_limite).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <strong style={{ color: Number(p.dias_retraso) > 7 ? '#ef4444' : 'inherit' }}>
                    {p.dias_retraso}
                  </strong>
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCancelar(p.id)}
                    disabled={cancelar.isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleReenviar(p.id)}
                    disabled={enviar.isPending}
                    style={{ marginLeft: 4 }}
                  >
                    Reenviar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
