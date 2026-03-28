import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  usePedidoDetail,
  useEnviarPedido,
  useListoRecoger,
  useRecogerPedido,
  useCancelarPedido,
  useCrearPedido,
} from '@/hooks/usePedidos';
import { useProveedores } from '@/hooks/useProveedores';

const ESTADO_COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  enviado: '#3b82f6',
  confirmado: '#22c55e',
  listo_para_recoger: '#14b8a6',
  recogido: '#6b7280',
  caducado: '#ef4444',
  cancelado: '#4b5563',
};

const TERMINAL_STATES = ['recogido', 'cancelado'];

export function PedidoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = usePedidoDetail(id ?? '');

  const pedido: any = data && 'data' in data ? data.data : null;

  const enviar = useEnviarPedido();
  const listoRecoger = useListoRecoger();
  const recoger = useRecogerPedido();
  const cancelarMut = useCancelarPedido();

  if (isLoading) return <div className="loading">Cargando pedido...</div>;
  if (!pedido) return <div className="error">Pedido no encontrado</div>;

  const handleCancelar = () => {
    const motivo = prompt('Motivo de la cancelación:');
    if (motivo !== null) {
      cancelarMut.mutate({ id: pedido.id, motivo: motivo || undefined });
    }
  };

  const lineas: any[] = pedido.lineas ?? [];
  const historial: any[] = pedido.historial ?? [];

  return (
    <div className="page-pedido-detail">
      <div className="page-header">
        <h2>Pedido {pedido.numero_pedido}</h2>
        <span className="badge" style={{ backgroundColor: ESTADO_COLORS[pedido.estado] ?? '#6b7280', fontSize: 14 }}>
          {pedido.estado?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Datos generales */}
      <section className="detail-section">
        <h3>Datos generales</h3>
        <div className="detail-grid">
          <div>
            <strong>Expediente:</strong>{' '}
            <Link to={`/expedientes/${pedido.expediente_id}`} className="link">
              {pedido.numero_expediente ?? pedido.expediente_id}
            </Link>
          </div>
          <div><strong>Proveedor:</strong> {pedido.proveedor_nombre ?? pedido.proveedor_id}</div>
          <div><strong>Estado:</strong> {pedido.estado?.replace(/_/g, ' ')}</div>
          <div><strong>Fecha límite:</strong> {pedido.fecha_limite ? new Date(pedido.fecha_limite).toLocaleDateString('es-ES') : '—'}</div>
          <div><strong>Creado:</strong> {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('es-ES') : '—'}</div>
          {pedido.observaciones && <div><strong>Observaciones:</strong> {pedido.observaciones}</div>}
        </div>
      </section>

      {/* Líneas */}
      <section className="detail-section">
        <h3>Líneas del pedido</h3>
        {lineas.length === 0 ? (
          <div className="empty-state">Sin líneas</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l: any, i: number) => (
                <tr key={l.id ?? i}>
                  <td>{l.descripcion}</td>
                  <td>{l.cantidad}</td>
                  <td>{l.unidad ?? '—'}</td>
                  <td>{l.referencia ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Historial */}
      <section className="detail-section">
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <div className="empty-state">Sin historial</div>
        ) : (
          <ul className="timeline">
            {historial.map((h: any, i: number) => (
              <li key={i} className="timeline-item">
                <span className="timeline-date">
                  {h.created_at ? new Date(h.created_at).toLocaleString('es-ES') : ''}
                </span>
                <span className="timeline-text">{h.descripcion ?? h.accion}</span>
                {h.usuario && <span className="timeline-user"> — {h.usuario}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Action bar */}
      <div className="action-bar">
        {pedido.estado === 'pendiente' && (
          <button className="btn btn-primary" onClick={() => enviar.mutate(pedido.id)} disabled={enviar.isPending}>
            {enviar.isPending ? 'Enviando...' : 'Enviar al proveedor'}
          </button>
        )}
        {pedido.estado === 'confirmado' && (
          <button className="btn btn-primary" onClick={() => listoRecoger.mutate(pedido.id)} disabled={listoRecoger.isPending}>
            {listoRecoger.isPending ? 'Procesando...' : 'Marcar listo para recoger'}
          </button>
        )}
        {pedido.estado === 'listo_para_recoger' && (
          <button className="btn btn-primary" onClick={() => recoger.mutate(pedido.id)} disabled={recoger.isPending}>
            {recoger.isPending ? 'Procesando...' : 'Recoger'}
          </button>
        )}
        {!TERMINAL_STATES.includes(pedido.estado) && (
          <button className="btn btn-secondary" onClick={handleCancelar} disabled={cancelarMut.isPending}>
            Cancelar pedido
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   CreatePedidoModal — used from expediente detail
   ============================================================ */

interface LineaPedido {
  descripcion: string;
  cantidad: string;
  unidad: string;
  referencia: string;
}

const EMPTY_LINEA: LineaPedido = { descripcion: '', cantidad: '1', unidad: '', referencia: '' };

export function CreatePedidoModal({ expedienteId, onClose }: { expedienteId: string; onClose: () => void }) {
  const crear = useCrearPedido();
  const { data: provData } = useProveedores({ activo: true });
  const proveedores: any[] = provData && 'data' in provData ? ((provData.data as any)?.items ?? []) : [];

  const [proveedorId, setProveedorId] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaPedido[]>([{ ...EMPTY_LINEA }]);

  const updateLinea = (idx: number, field: keyof LineaPedido, value: string) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLinea = () => setLineas((prev) => [...prev, { ...EMPTY_LINEA }]);

  const removeLinea = (idx: number) => {
    if (lineas.length > 1) setLineas((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    crear.mutate(
      {
        expediente_id: expedienteId,
        proveedor_id: proveedorId,
        fecha_limite: fechaLimite || undefined,
        observaciones: observaciones || undefined,
        lineas: lineas
          .filter((l) => l.descripcion.trim())
          .map((l) => ({
            descripcion: l.descripcion,
            cantidad: Number(l.cantidad) || 1,
            unidad: l.unidad || undefined,
            referencia: l.referencia || undefined,
          })),
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo pedido de material</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Proveedor *</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
              <option value="">— Seleccionar proveedor —</option>
              {proveedores.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha límite</label>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </div>

          <h4>Líneas</h4>
          {lineas.map((l, idx) => (
            <div key={idx} className="form-row" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Descripción *"
                value={l.descripcion}
                onChange={(e) => updateLinea(idx, 'descripcion', e.target.value)}
                style={{ flex: 3 }}
                required
              />
              <input
                type="number"
                placeholder="Cant."
                value={l.cantidad}
                onChange={(e) => updateLinea(idx, 'cantidad', e.target.value)}
                style={{ flex: 1 }}
                min={1}
              />
              <input
                type="text"
                placeholder="Unidad"
                value={l.unidad}
                onChange={(e) => updateLinea(idx, 'unidad', e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Referencia"
                value={l.referencia}
                onChange={(e) => updateLinea(idx, 'referencia', e.target.value)}
                style={{ flex: 2 }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => removeLinea(idx)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addLinea} style={{ marginBottom: 16 }}>
            + Añadir línea
          </button>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={crear.isPending}>
              {crear.isPending ? 'Creando...' : 'Crear pedido'}
            </button>
          </div>
          {crear.isError && <div className="form-error">Error al crear el pedido</div>}
        </form>
      </div>
    </div>
  );
}
