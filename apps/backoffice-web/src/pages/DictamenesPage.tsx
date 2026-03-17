import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDictamenes, useCreateDictamen } from '@/hooks/usePeritos';

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'badge-dictamen-borrador',
  emitido: 'badge-dictamen-emitido',
  revisado: 'badge-dictamen-revisado',
  aceptado: 'badge-dictamen-aceptado',
  rechazado: 'badge-dictamen-rechazado',
};

export function DictamenesPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newExpedienteId, setNewExpedienteId] = useState('');

  const { data, isLoading } = useDictamenes({
    estado: estado || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  const createMut = useCreateDictamen();

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  function handleCreate() {
    if (!newExpedienteId) return;
    createMut.mutate({ expediente_id: newExpedienteId }, {
      onSuccess: (res: any) => {
        setShowCreate(false);
        setNewExpedienteId('');
        if (res && 'data' in res && res.data?.id) {
          navigate(`/peritos/dictamenes/${res.data.id}`);
        }
      },
    });
  }

  return (
    <div className="page-dictamenes">
      <div className="page-header">
        <h2>Dictamenes periciales</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nuevo dictamen</button>
      </div>

      <div className="filters-bar">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="filter-select">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="emitido">Emitido</option>
          <option value="revisado">Revisado</option>
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="filter-date" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="filter-date" />
      </div>

      {isLoading ? (
        <div className="loading">Cargando dictamenes...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron dictamenes</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>N. Dictamen</th>
              <th>Expediente</th>
              <th>Fecha inspeccion</th>
              <th>Valoracion danos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d: any) => (
              <tr key={d.id} onClick={() => navigate(`/peritos/dictamenes/${d.id}`)} className="clickable-row">
                <td>{d.numero_dictamen}</td>
                <td>{d.expedientes?.numero_expediente ?? '-'}</td>
                <td>{d.fecha_inspeccion ? new Date(d.fecha_inspeccion).toLocaleDateString('es-ES') : '-'}</td>
                <td>{d.valoracion_danos != null ? `${Number(d.valoracion_danos).toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR` : '-'}</td>
                <td><span className={`badge ${ESTADO_BADGE[d.estado] ?? ''}`}>{d.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result && result.total_pages > 1 && (
        <div className="pagination-info">
          Pagina {result.page} de {result.total_pages} ({result.total} resultados)
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo dictamen</h3>
            <div className="form-group">
              <label>ID del expediente</label>
              <input
                type="text"
                value={newExpedienteId}
                onChange={(e) => setNewExpedienteId(e.target.value)}
                placeholder="UUID del expediente asignado"
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creando...' : 'Crear borrador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
