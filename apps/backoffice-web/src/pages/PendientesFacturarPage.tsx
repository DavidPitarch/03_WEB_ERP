import { useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useFacturasPendientes, useSeries, useEmitirFactura } from '@/hooks/useFacturas';

export function PendientesFacturarPage() {
  const [companiaFilter, setCompaniaFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  const { data, isLoading } = useFacturasPendientes({
    compania_id: companiaFilter || undefined,
    tipo_siniestro: tipoFilter || undefined,
  });

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const companias = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((r: any) => {
      if (r.compania_id && r.compania_nombre) map.set(r.compania_id, r.compania_nombre);
    });
    return Array.from(map, ([id, nombre]) => ({ id, nombre }));
  }, [items]);

  // Modal
  const [modalRow, setModalRow] = useState<any>(null);

  return (
    <div className="page-pendientes-facturar">
      <div className="page-header">
        <h2>Pendientes de facturar</h2>
      </div>

      <div className="filters-bar">
        <select value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} className="filter-select">
          <option value="">Todas las compañías</option>
          {companias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Tipo siniestro..."
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="search-input"
        />
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay expedientes pendientes de facturar</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Compañía</th>
              <th>Empresa</th>
              <th>Presupuesto</th>
              <th>Importe total</th>
              <th>Margen</th>
              <th>Fecha finalización</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row: any) => (
              <tr key={row.expediente_id}>
                <td>
                  <Link to={`/expedientes/${row.expediente_id}`} className="link">
                    {row.numero_expediente}
                  </Link>
                </td>
                <td>{row.compania_nombre}</td>
                <td>{row.empresa_nombre}</td>
                <td>{row.presupuesto_numero}</td>
                <td>{Number(row.importe_total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                <td>{row.margen != null ? `${Number(row.margen).toFixed(2)}%` : '—'}</td>
                <td>{row.fecha_finalizacion ? new Date(row.fecha_finalizacion).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <button className="btn btn-primary" onClick={() => setModalRow(row)}>
                    Emitir factura
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalRow && (
        <EmitirFacturaModal row={modalRow} onClose={() => setModalRow(null)} />
      )}
    </div>
  );
}

function EmitirFacturaModal({ row, onClose }: { row: any; onClose: () => void }) {
  const { data: seriesData } = useSeries({ activa: 'true' });
  const series: any[] = seriesData && 'data' in seriesData ? (seriesData.data as any[]) ?? [] : [];

  const emitir = useEmitirFactura();

  const [serieId, setSerieId] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [cuentaBancaria, setCuentaBancaria] = useState('');
  const [notas, setNotas] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    emitir.mutate(
      {
        expediente_id: row.expediente_id,
        presupuesto_id: row.presupuesto_id,
        serie_id: serieId || undefined,
        forma_pago: formaPago || undefined,
        cuenta_bancaria: cuentaBancaria || undefined,
        notas: notas || undefined,
      },
      {
        onSuccess: (data: any) => {
          const factura = data && 'data' in data ? data.data : data;
          setResultado(factura?.numero_factura ?? 'Factura emitida');
        },
      },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Emitir factura</h3>
        <p>Expediente: <strong>{row.numero_expediente}</strong></p>

        {resultado ? (
          <div>
            <p className="form-success">Factura emitida: <strong>{resultado}</strong></p>
            <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Serie *</label>
              <select value={serieId} onChange={(e) => setSerieId(e.target.value)} required>
                <option value="">Seleccionar serie</option>
                {series.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nombre} ({s.prefijo})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Forma de pago</label>
              <input type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Cuenta bancaria</label>
              <input type="text" value={cuentaBancaria} onChange={(e) => setCuentaBancaria(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={emitir.isPending}>
                {emitir.isPending ? 'Emitiendo...' : 'Emitir factura'}
              </button>
            </div>
            {emitir.isError && <div className="form-error">Error al emitir la factura</div>}
          </form>
        )}
      </div>
    </div>
  );
}
