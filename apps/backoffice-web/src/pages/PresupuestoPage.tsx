import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  usePresupuestoDetail,
  useAddLinea,
  useRecalcularPresupuesto,
  useAprobarPresupuesto,
} from '@/hooks/usePresupuestos';
import { useBaremoPartidas } from '@/hooks/useBaremos';

export function PresupuestoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: res, isLoading } = usePresupuestoDetail(id);
  const recalcular = useRecalcularPresupuesto();
  const aprobar = useAprobarPresupuesto();

  const presupuesto = res && 'data' in res ? res.data : null;
  const lineas = presupuesto?.lineas_presupuesto ?? [];

  const [showAddLinea, setShowAddLinea] = useState(false);

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!presupuesto) return <div className="error">Presupuesto no encontrado</div>;

  return (
    <div className="page-presupuesto">
      <div className="page-header">
        <div>
          <h2>Presupuesto {presupuesto.numero}</h2>
          <p className="text-muted">
            Expediente: <Link to={`/expedientes/${presupuesto.expediente_id}`} className="link">{presupuesto.expediente_id.substring(0, 8)}</Link>
            {' '} | Estado: <span className={`badge badge-${presupuesto.estado}`}>{presupuesto.estado}</span>
            {presupuesto.aprobado && <span className="badge badge-success" style={{ marginLeft: 8 }}>Aprobado</span>}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddLinea(true)}>+ Linea</button>
          <button className="btn btn-secondary" onClick={() => recalcular.mutate(id!)} disabled={recalcular.isPending}>Recalcular</button>
          {!presupuesto.aprobado && (
            <button className="btn btn-success" onClick={() => aprobar.mutate(id!)} disabled={aprobar.isPending}>Aprobar</button>
          )}
        </div>
      </div>

      <div className="presupuesto-resumen">
        <div className="resumen-item"><label>Ingreso estimado</label><span className="resumen-value">{fmt(presupuesto.ingreso_estimado ?? presupuesto.importe_total)}</span></div>
        <div className="resumen-item"><label>Coste estimado</label><span className="resumen-value">{fmt(presupuesto.coste_estimado ?? 0)}</span></div>
        <div className="resumen-item resumen-highlight">
          <label>Margen previsto</label>
          <span className={`resumen-value ${(presupuesto.margen_previsto ?? 0) < 0 ? 'text-danger' : 'text-success'}`}>
            {fmt(presupuesto.margen_previsto ?? 0)}
          </span>
        </div>
        <div className="resumen-item"><label>Total IVA incl.</label><span className="resumen-value resumen-total">{fmt(presupuesto.importe_total)}</span></div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Descripcion</th>
            <th>Cantidad</th>
            <th>P. unitario</th>
            <th>P. operario</th>
            <th>Dto. %</th>
            <th>IVA %</th>
            <th>Importe</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l: any) => (
            <tr key={l.id}>
              <td>{l.descripcion}</td>
              <td className="text-right">{l.cantidad}</td>
              <td className="text-right">{fmt(l.precio_unitario)}</td>
              <td className="text-right">{fmt(l.precio_operario ?? 0)}</td>
              <td className="text-right">{l.descuento_porcentaje ?? 0}%</td>
              <td className="text-right">{l.iva_porcentaje ?? 21}%</td>
              <td className="text-right">{fmt(l.importe)}</td>
              <td className="text-right"><strong>{fmt(l.subtotal ?? l.importe)}</strong></td>
            </tr>
          ))}
          {lineas.length === 0 && (
            <tr><td colSpan={8} className="text-center text-muted">Sin lineas. Agrega partidas del baremo.</td></tr>
          )}
        </tbody>
      </table>

      {showAddLinea && <AddLineaModal presupuestoId={id!} onClose={() => setShowAddLinea(false)} />}
    </div>
  );
}

function AddLineaModal({ presupuestoId, onClose }: { presupuestoId: string; onClose: () => void }) {
  const addLinea = useAddLinea();
  const [baremoId, setBaremoId] = useState('');
  const [form, setForm] = useState({
    descripcion: '',
    cantidad: '1',
    precio_unitario: '',
    precio_operario: '',
    descuento_porcentaje: '0',
    iva_porcentaje: '21',
    partida_baremo_id: '',
  });

  // Optional: load partidas from a baremo to pick
  const { data: partidasRes } = useBaremoPartidas(baremoId || undefined);
  const partidas = partidasRes && 'data' in partidasRes ? (partidasRes.data ?? []) as any[] : [];

  function selectPartida(p: any) {
    setForm({
      ...form,
      descripcion: p.descripcion,
      precio_unitario: String(p.precio_unitario),
      precio_operario: String(p.precio_operario ?? '0'),
      partida_baremo_id: p.id,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addLinea.mutateAsync({
      presupuestoId,
      descripcion: form.descripcion,
      cantidad: Number(form.cantidad),
      precio_unitario: Number(form.precio_unitario),
      precio_operario: Number(form.precio_operario) || undefined,
      descuento_porcentaje: Number(form.descuento_porcentaje) || undefined,
      iva_porcentaje: Number(form.iva_porcentaje),
      partida_baremo_id: form.partida_baremo_id || undefined,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Agregar linea</h3><button className="btn-close" onClick={onClose}>&times;</button></div>
        <div className="form-group">
          <label>Baremo ID (opcional, para buscar partidas)</label>
          <input value={baremoId} onChange={(e) => setBaremoId(e.target.value)} placeholder="UUID del baremo" />
        </div>
        {partidas.length > 0 && (
          <div className="partida-picker">
            <p className="text-muted">{partidas.length} partidas disponibles. Click para seleccionar:</p>
            <div className="partida-picker-list">
              {partidas.slice(0, 50).map((p) => (
                <div key={p.id} className={`partida-pick-item ${form.partida_baremo_id === p.id ? 'selected' : ''}`} onClick={() => selectPartida(p)}>
                  <code>{p.codigo}</code> {p.descripcion} — {fmt(p.precio_unitario)}
                </div>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Descripcion *</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required /></div>
          <div className="form-grid">
            <div className="form-group"><label>Cantidad *</label><input type="number" step="0.01" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required /></div>
            <div className="form-group"><label>Precio unitario *</label><input type="number" step="0.01" value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })} required /></div>
            <div className="form-group"><label>Precio operario</label><input type="number" step="0.01" value={form.precio_operario} onChange={(e) => setForm({ ...form, precio_operario: e.target.value })} /></div>
            <div className="form-group"><label>Descuento %</label><input type="number" step="0.01" value={form.descuento_porcentaje} onChange={(e) => setForm({ ...form, descuento_porcentaje: e.target.value })} /></div>
            <div className="form-group"><label>IVA %</label><input type="number" step="0.01" value={form.iva_porcentaje} onChange={(e) => setForm({ ...form, iva_porcentaje: e.target.value })} /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={addLinea.isPending}>Agregar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fmt(n: number | string | null): string {
  const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
}
