import { useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useFacturasCaducadas, useRegistrarCobro, useReclamarFactura } from '@/hooks/useFacturas';

const COBRO_COLORS: Record<string, string> = {
  PENDIENTE: '#f59e0b',
  PARCIAL: '#f97316',
  COBRADA: '#22c55e',
  VENCIDA: '#ef4444',
};

export function FacturasCaducadasPage() {
  const [companiaFilter, setCompaniaFilter] = useState('');
  const [diasMin, setDiasMin] = useState('');

  const { data, isLoading } = useFacturasCaducadas({
    compania_id: companiaFilter || undefined,
    dias_min: diasMin || undefined,
  });

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const companias = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((r: any) => {
      if (r.compania_id && r.compania_nombre) map.set(r.compania_id, r.compania_nombre);
    });
    return Array.from(map, ([id, nombre]) => ({ id, nombre }));
  }, [items]);

  const [cobroRow, setCobroRow] = useState<any>(null);
  const [reclamarRow, setReclamarRow] = useState<any>(null);

  return (
    <div className="page-facturas-caducadas">
      <div className="page-header">
        <h2>Facturas vencidas</h2>
      </div>

      <div className="filters-bar">
        <select value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} className="filter-select">
          <option value="">Todas las compañías</option>
          {companias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Días mínimos vencida"
          value={diasMin}
          onChange={(e) => setDiasMin(e.target.value)}
          className="search-input"
          min={0}
        />
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay facturas vencidas</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Factura</th>
              <th>Expediente</th>
              <th>Compañía</th>
              <th>Empresa</th>
              <th>Serie</th>
              <th>Vencimiento</th>
              <th>Días vencida</th>
              <th>Estado cobro</th>
              <th>Último seguimiento</th>
              <th>Próximo contacto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((f: any) => (
              <tr key={f.id}>
                <td><strong>{f.numero_factura}</strong></td>
                <td>
                  <Link to={`/expedientes/${f.expediente_id}`} className="link">
                    {f.numero_expediente}
                  </Link>
                </td>
                <td>{f.compania_nombre}</td>
                <td>{f.empresa_nombre}</td>
                <td>{f.serie_nombre}</td>
                <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <strong style={{ color: Number(f.dias_vencida) > 30 ? '#ef4444' : 'inherit' }}>
                    {f.dias_vencida}
                  </strong>
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: COBRO_COLORS[f.estado_cobro] ?? '#6b7280' }}>
                    {f.estado_cobro?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>{f.ultimo_seguimiento ? new Date(f.ultimo_seguimiento).toLocaleDateString('es-ES') : '—'}</td>
                <td>{f.proximo_contacto ? new Date(f.proximo_contacto).toLocaleDateString('es-ES') : '—'}</td>
                <td>
                  <button className="btn btn-primary" onClick={() => setCobroRow(f)}>Registrar cobro</button>
                  <button className="btn btn-secondary" onClick={() => setReclamarRow(f)}>Reclamar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cobroRow && <CobroModal factura={cobroRow} onClose={() => setCobroRow(null)} />}
      {reclamarRow && <ReclamarModal factura={reclamarRow} onClose={() => setReclamarRow(null)} />}
    </div>
  );
}

function CobroModal({ factura, onClose }: { factura: any; onClose: () => void }) {
  const registrar = useRegistrarCobro();
  const today = new Date().toISOString().slice(0, 10);

  const [fechaPago, setFechaPago] = useState(today);
  const [importe, setImporte] = useState(String(factura.total ?? ''));
  const [metodo, setMetodo] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    registrar.mutate(
      {
        id: factura.id,
        fecha_pago: fechaPago,
        importe: Number(importe),
        metodo,
        referencia: referencia || undefined,
        notas: notas || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Registrar cobro</h3>
        <p>Factura: <strong>{factura.numero_factura}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Fecha de pago *</label>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Importe *</label>
            <input type="number" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Método *</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} required>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="efectivo">Efectivo</option>
              <option value="domiciliacion">Domiciliación</option>
            </select>
          </div>
          <div className="form-group">
            <label>Referencia</label>
            <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={registrar.isPending}>
              {registrar.isPending ? 'Guardando...' : 'Registrar cobro'}
            </button>
          </div>
          {registrar.isError && <div className="form-error">Error al registrar el cobro</div>}
        </form>
      </div>
    </div>
  );
}

function ReclamarModal({ factura, onClose }: { factura: any; onClose: () => void }) {
  const reclamar = useReclamarFactura();

  const [contenido, setContenido] = useState('');
  const [proximoContacto, setProximoContacto] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    reclamar.mutate(
      {
        id: factura.id,
        contenido,
        proximo_contacto: proximoContacto || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reclamar factura</h3>
        <p>Factura: <strong>{factura.numero_factura}</strong></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Contenido *</label>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={4} required />
          </div>
          <div className="form-group">
            <label>Próximo contacto</label>
            <input type="date" value={proximoContacto} onChange={(e) => setProximoContacto(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={reclamar.isPending}>
              {reclamar.isPending ? 'Enviando...' : 'Reclamar'}
            </button>
          </div>
          {reclamar.isError && <div className="form-error">Error al reclamar</div>}
        </form>
      </div>
    </div>
  );
}
