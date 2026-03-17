import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFacturaDetail, useEnviarFactura, useRegistrarCobro, useReclamarFactura, useAnularFactura } from '@/hooks/useFacturas';

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: '#6b7280',
  EMITIDA: '#3b82f6',
  ENVIADA: '#8b5cf6',
  COBRADA: '#22c55e',
  COBRADA_PARCIAL: '#f59e0b',
  ANULADA: '#ef4444',
};

const COBRO_COLORS: Record<string, string> = {
  PENDIENTE: '#f59e0b',
  PARCIAL: '#f97316',
  COBRADA: '#22c55e',
  VENCIDA: '#ef4444',
};

export function FacturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useFacturaDetail(id!);

  const enviar = useEnviarFactura();
  const anular = useAnularFactura();

  const [showCobro, setShowCobro] = useState(false);
  const [showReclamar, setShowReclamar] = useState(false);

  if (isLoading) return <div className="loading">Cargando factura...</div>;

  const factura = data && 'data' in data ? (data.data as any) : null;
  if (!factura) return <div className="error">Factura no encontrada</div>;

  const f = factura;
  const lineas: any[] = f.lineas ?? [];
  const pagos: any[] = f.pagos ?? [];
  const seguimientos: any[] = f.seguimientos ?? [];
  const totalCobrado = pagos.reduce((sum: number, p: any) => sum + Number(p.importe ?? 0), 0);

  const handleEnviar = () => {
    if (!window.confirm('¿Enviar esta factura?')) return;
    enviar.mutate(id!);
  };

  const handleAnular = () => {
    const motivo = window.prompt('Motivo de anulación:');
    if (!motivo) return;
    anular.mutate({ id: id!, motivo });
  };

  return (
    <div className="page-detail">
      {/* Header */}
      <div className="detail-header">
        <div>
          <h2>{f.numero_factura}</h2>
          <span className="badge" style={{ backgroundColor: ESTADO_COLORS[f.estado] ?? '#6b7280' }}>
            {f.estado?.replace(/_/g, ' ')}
          </span>
          <span className="badge" style={{ backgroundColor: COBRO_COLORS[f.estado_cobro] ?? '#6b7280', marginLeft: 8 }}>
            {f.estado_cobro?.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="detail-actions">
          {f.estado === 'EMITIDA' && (
            <button className="btn btn-primary" onClick={handleEnviar} disabled={enviar.isPending}>
              {enviar.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          )}
          {f.estado !== 'COBRADA' && f.estado !== 'ANULADA' && (
            <>
              <button className="btn btn-primary" onClick={() => setShowCobro(true)}>Registrar cobro</button>
              <button className="btn btn-secondary" onClick={() => setShowReclamar(true)}>Reclamar</button>
            </>
          )}
          {f.estado !== 'COBRADA' && (
            <button className="btn btn-danger" onClick={handleAnular} disabled={anular.isPending}>
              {anular.isPending ? 'Anulando...' : 'Anular'}
            </button>
          )}
        </div>
      </div>

      {(enviar.isError || anular.isError) && (
        <div className="form-error">Error al realizar la acción</div>
      )}

      {/* Datos generales */}
      <div className="detail-grid">
        <section className="detail-section">
          <h3>Datos generales</h3>
          <dl>
            <dt>Expediente</dt>
            <dd><Link to={`/expedientes/${f.expediente_id}`} className="link">{f.numero_expediente}</Link></dd>
            <dt>Compañía</dt><dd>{f.compania_nombre}</dd>
            <dt>Empresa</dt><dd>{f.empresa_nombre} {f.empresa_cif ? `(${f.empresa_cif})` : ''}</dd>
            <dt>Serie</dt><dd>{f.serie_nombre}</dd>
            <dt>Fecha emisión</dt><dd>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-ES') : '—'}</dd>
            <dt>Fecha vencimiento</dt><dd>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</dd>
            <dt>Forma de pago</dt><dd>{f.forma_pago || '—'}</dd>
            <dt>Cuenta bancaria</dt><dd>{f.cuenta_bancaria || '—'}</dd>
            <dt>Notas</dt><dd>{f.notas || '—'}</dd>
          </dl>
        </section>

        <section className="detail-section">
          <h3>Importes</h3>
          <dl>
            <dt>Base imponible</dt>
            <dd>{Number(f.base_imponible ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</dd>
            <dt>IVA</dt>
            <dd>{f.iva_porcentaje != null ? `${f.iva_porcentaje}%` : '—'}</dd>
            <dt>Importe IVA</dt>
            <dd>{Number(f.iva_importe ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</dd>
          </dl>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: 8 }}>
            TOTAL: {Number(f.total ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
        </section>
      </div>

      {/* Líneas */}
      <section className="detail-section">
        <h3>Líneas</h3>
        {lineas.length === 0 ? (
          <p className="text-muted">Sin líneas</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Descuento</th>
                <th>IVA</th>
                <th>Importe</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l: any, i: number) => (
                <tr key={l.id ?? i}>
                  <td>{l.descripcion}</td>
                  <td>{l.cantidad}</td>
                  <td>{Number(l.precio_unitario ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td>{l.descuento != null ? `${l.descuento}%` : '—'}</td>
                  <td>{l.iva != null ? `${l.iva}%` : '—'}</td>
                  <td>{Number(l.importe ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td>{Number(l.subtotal ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pagos */}
      <section className="detail-section">
        <h3>Pagos</h3>
        {pagos.length === 0 ? (
          <p className="text-muted">Sin pagos registrados</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Importe</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p: any, i: number) => (
                  <tr key={p.id ?? i}>
                    <td>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-ES') : '—'}</td>
                    <td>{Number(p.importe ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                    <td>{p.metodo}</td>
                    <td>{p.referencia || '—'}</td>
                    <td>{p.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontWeight: 'bold', marginTop: 8 }}>
              Total cobrado: {totalCobrado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </>
        )}
      </section>

      {/* Seguimiento */}
      <section className="detail-section">
        <h3>Seguimiento</h3>
        {seguimientos.length === 0 ? (
          <p className="text-muted">Sin seguimiento</p>
        ) : (
          <ul className="timeline">
            {seguimientos.map((s: any, i: number) => (
              <li key={s.id ?? i} className="timeline-item">
                <div className="timeline-date">{new Date(s.fecha ?? s.created_at).toLocaleString('es-ES')}</div>
                <div className="timeline-content">
                  <span className="badge" style={{ marginRight: 8 }}>{s.tipo}</span>
                  <span>{s.contenido}</span>
                  {s.proximo_contacto && (
                    <span className="text-muted"> — Próximo contacto: {new Date(s.proximo_contacto).toLocaleDateString('es-ES')}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modals */}
      {showCobro && <CobroModal factura={f} onClose={() => setShowCobro(false)} />}
      {showReclamar && <ReclamarModal factura={f} onClose={() => setShowReclamar(false)} />}
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
