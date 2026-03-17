import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVideoperitaciones, useCreateVideoperitacion } from '@/hooks/useVideoperitaciones';
import { VP_ESTADOS } from '@erp/types';

const ESTADO_BADGE: Record<string, string> = Object.fromEntries(
  VP_ESTADOS.map((e) => [e, `badge-vp-${e}`]),
);

const PRIORIDAD_BADGE: Record<string, string> = {
  baja: 'badge-prioridad-baja',
  media: 'badge-prioridad-media',
  alta: 'badge-prioridad-alta',
  urgente: 'badge-prioridad-urgente',
};

export function VideoperitacionesPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [peritoId, setPeritoId] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newExpedienteId, setNewExpedienteId] = useState('');
  const [newPeritoId, setNewPeritoId] = useState('');
  const [newMotivo, setNewMotivo] = useState('');
  const [newPrioridad, setNewPrioridad] = useState('media');

  const { data, isLoading } = useVideoperitaciones({
    estado: estado || undefined,
    perito_id: peritoId || undefined,
    prioridad: prioridad || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  const createMut = useCreateVideoperitacion();

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  function handleCreate() {
    if (!newExpedienteId) return;
    createMut.mutate(
      {
        expediente_id: newExpedienteId,
        perito_id: newPeritoId || undefined,
        motivo_tecnico: newMotivo || undefined,
        prioridad: newPrioridad,
      },
      {
        onSuccess: (res: any) => {
          setShowCreate(false);
          setNewExpedienteId('');
          setNewPeritoId('');
          setNewMotivo('');
          setNewPrioridad('media');
          if (res && 'data' in res && res.data?.id) {
            navigate(`/videoperitaciones/${res.data.id}`);
          }
        },
      },
    );
  }

  return (
    <div className="page-videoperitaciones">
      <div className="page-header">
        <h2>Videoperitaciones</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nueva videoperitacion</button>
      </div>

      <div className="filters-bar">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="filter-select">
          <option value="">Todos los estados</option>
          {VP_ESTADOS.map((e) => (
            <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <input type="text" value={peritoId} onChange={(e) => setPeritoId(e.target.value)} placeholder="Perito ID" className="filter-input" />
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="filter-select">
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="filter-date" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="filter-date" />
      </div>

      {isLoading ? (
        <div className="loading">Cargando videoperitaciones...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron videoperitaciones</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>N. Caso</th>
              <th>Expediente</th>
              <th>Perito</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Deadline</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((vp: any) => (
              <tr key={vp.id} onClick={() => navigate(`/videoperitaciones/${vp.id}`)} className="clickable-row">
                <td>{vp.numero_caso}</td>
                <td>{vp.expedientes?.numero_expediente ?? vp.expediente_id}</td>
                <td>{vp.peritos ? `${vp.peritos.nombre} ${vp.peritos.apellidos}` : '-'}</td>
                <td><span className={`badge ${ESTADO_BADGE[vp.estado] ?? ''}`}>{vp.estado.replace(/_/g, ' ')}</span></td>
                <td><span className={`badge ${PRIORIDAD_BADGE[vp.prioridad] ?? ''}`}>{vp.prioridad}</span></td>
                <td>{vp.deadline ? new Date(vp.deadline).toLocaleDateString('es-ES') : '-'}</td>
                <td>{new Date(vp.created_at).toLocaleDateString('es-ES')}</td>
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
            <h3>Nueva videoperitacion</h3>
            <div className="form-group">
              <label>ID del expediente *</label>
              <input type="text" value={newExpedienteId} onChange={(e) => setNewExpedienteId(e.target.value)} placeholder="UUID del expediente" className="form-input" />
            </div>
            <div className="form-group">
              <label>ID del perito (opcional)</label>
              <input type="text" value={newPeritoId} onChange={(e) => setNewPeritoId(e.target.value)} placeholder="UUID del perito" className="form-input" />
            </div>
            <div className="form-group">
              <label>Motivo tecnico</label>
              <textarea value={newMotivo} onChange={(e) => setNewMotivo(e.target.value)} placeholder="Motivo tecnico" className="form-input" />
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <select value={newPrioridad} onChange={(e) => setNewPrioridad(e.target.value)} className="form-input">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creando...' : 'Crear videoperitacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
