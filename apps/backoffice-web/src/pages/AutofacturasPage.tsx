import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useOperariosLiquidables,
  useAutofacturas,
  useAutofacturaDetail,
  useGenerarAutofactura,
  useRevisarAutofactura,
  useEmitirAutofactura,
  useAnularAutofactura,
} from '@/hooks/useAutofacturas';

export function AutofacturasPage() {
  const [tab, setTab] = useState<'liquidables' | 'autofacturas'>('liquidables');
  const [showModal, setShowModal] = useState(false);
  const [modalOperario, setModalOperario] = useState<any>(null);
  const [periodoDesde, setPeriodoDesde] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const { data: liqData, isLoading: liqLoading } = useOperariosLiquidables();
  const liqItems: any[] = liqData && 'data' in liqData ? (liqData.data as any[]) ?? [] : [];

  const { data: afData, isLoading: afLoading } = useAutofacturas();
  const afItems: any[] = afData && 'data' in afData ? (afData.data as any[]) ?? [] : [];

  const generar = useGenerarAutofactura();
  const revisar = useRevisarAutofactura();
  const emitir = useEmitirAutofactura();
  const anular = useAnularAutofactura();

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const handleGenerar = () => {
    if (!modalOperario) return;
    generar.mutate(
      { operario_id: modalOperario.operario_id, periodo_desde: periodoDesde, periodo_hasta: periodoHasta },
      { onSuccess: () => { setShowModal(false); setTab('autofacturas'); } },
    );
  };

  const openModal = (op: any) => {
    setModalOperario(op);
    setPeriodoDesde('');
    setPeriodoHasta('');
    setShowModal(true);
  };

  return (
    <div className="page-autofacturas">
      <div className="page-header">
        <h2>Autofacturación subcontratados</h2>
      </div>

      <div className="tabs">
        <button className={`btn ${tab === 'liquidables' ? 'btn-primary' : ''}`} onClick={() => setTab('liquidables')}>
          Operarios liquidables
        </button>
        <button className={`btn ${tab === 'autofacturas' ? 'btn-primary' : ''}`} onClick={() => setTab('autofacturas')}>
          Autofacturas
        </button>
      </div>

      {tab === 'liquidables' && (
        <>
          {liqLoading ? (
            <div className="loading">Cargando operarios liquidables...</div>
          ) : liqItems.length === 0 ? (
            <div className="empty-state">No hay operarios liquidables</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th>CIF</th>
                  <th>Nº Partes</th>
                  <th>Importe estimado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {liqItems.map((op: any) => (
                  <tr key={op.operario_id}>
                    <td>{op.operario_nombre}</td>
                    <td>{op.cif}</td>
                    <td>{op.num_partes}</td>
                    <td>{fmt(op.importe_estimado)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openModal(op)}>Generar propuesta</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'autofacturas' && (
        <>
          {afLoading ? (
            <div className="loading">Cargando autofacturas...</div>
          ) : afItems.length === 0 ? (
            <div className="empty-state">No hay autofacturas</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Operario</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {afItems.map((af: any) => (
                  <tr key={af.id}>
                    <td><strong>{af.numero}</strong></td>
                    <td>{af.operario_nombre}</td>
                    <td>{af.periodo}</td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[af.estado] ?? ''}`}>
                        {af.estado}
                      </span>
                    </td>
                    <td>{fmt(af.total)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setSelectedId(af.id)}>Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedId && (
            <AutofacturaDetailSection
              id={selectedId}
              onClose={() => setSelectedId('')}
              onRevisar={() => revisar.mutate(selectedId)}
              onEmitir={() => emitir.mutate(selectedId)}
              onAnular={() => anular.mutate(selectedId)}
            />
          )}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Generar propuesta de autofactura</h3>
            <div className="form-group">
              <label>Operario</label>
              <input type="text" value={modalOperario?.operario_nombre ?? ''} disabled />
            </div>
            <div className="form-group">
              <label>Periodo desde</label>
              <input type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Periodo hasta</label>
              <input type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGenerar} disabled={generar.isPending}>
                {generar.isPending ? 'Generando...' : 'Generar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AutofacturaDetailSection({
  id,
  onClose,
  onRevisar,
  onEmitir,
  onAnular,
}: {
  id: string;
  onClose: () => void;
  onRevisar: () => void;
  onEmitir: () => void;
  onAnular: () => void;
}) {
  const { data, isLoading } = useAutofacturaDetail(id);
  const af: any = data && 'data' in data ? data.data : null;

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  if (isLoading) return <div className="loading">Cargando detalle...</div>;
  if (!af) return <div className="empty-state">No se encontró la autofactura</div>;

  const lineas: any[] = af.lineas ?? [];

  return (
    <div className="autofactura-detail">
      <div className="page-header">
        <h3>Detalle autofactura {af.numero}</h3>
        <button className="btn btn-sm" onClick={onClose}>Cerrar</button>
      </div>

      <div className="detail-info">
        <p><strong>Operario:</strong> {af.operario_nombre}</p>
        <p><strong>CIF:</strong> {af.operario_cif}</p>
        <p><strong>Periodo:</strong> {af.periodo}</p>
        <p>
          <strong>Estado:</strong>{' '}
          <span className={`badge ${ESTADO_BADGE[af.estado] ?? ''}`}>{af.estado}</span>
        </p>
      </div>

      {lineas.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Parte</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l: any, i: number) => (
              <tr key={i}>
                <td>
                  <Link to={`/expedientes/${l.expediente_id}`} className="link">
                    {l.numero_expediente}
                  </Link>
                </td>
                <td>{l.parte}</td>
                <td>{l.descripcion}</td>
                <td>{l.cantidad}</td>
                <td>{fmt(l.precio)}</td>
                <td>{fmt(l.importe)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}><strong>Total</strong></td>
              <td><strong>{fmt(af.total)}</strong></td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="detail-actions">
        {af.estado === 'BORRADOR' && (
          <button className="btn btn-primary" onClick={onRevisar}>Revisar</button>
        )}
        {af.estado === 'REVISADA' && (
          <button className="btn btn-primary" onClick={onEmitir}>Emitir</button>
        )}
        {af.estado !== 'ANULADA' && (
          <button className="btn btn-danger" onClick={onAnular}>Anular</button>
        )}
      </div>
    </div>
  );
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'badge-af-borrador',
  REVISADA: 'badge-af-revisada',
  EMITIDA: 'badge-af-emitida',
  ANULADA: 'badge-af-anulada',
};
