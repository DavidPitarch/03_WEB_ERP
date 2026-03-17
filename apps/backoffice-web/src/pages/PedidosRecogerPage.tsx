import { Link } from 'react-router-dom';
import { usePedidosRecoger, useRecogerPedido } from '@/hooks/usePedidos';

export function PedidosRecogerPage() {
  const { data, isLoading } = usePedidosRecoger();
  const recoger = useRecogerPedido();

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const handleRecoger = (id: string) => {
    if (confirm('¿Confirmar recogida de este pedido?')) {
      recoger.mutate(id);
    }
  };

  return (
    <div className="page-pedidos-recoger">
      <div className="page-header">
        <h2>Pedidos a recoger</h2>
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay pedidos pendientes de recoger</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Expediente</th>
              <th>Proveedor</th>
              <th>Nº Líneas</th>
              <th>Confirmado</th>
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
                <td>{p.num_lineas ?? '—'}</td>
                <td>{p.confirmado_at ? new Date(p.confirmado_at).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRecoger(p.id)}
                    disabled={recoger.isPending}
                  >
                    Recoger
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
