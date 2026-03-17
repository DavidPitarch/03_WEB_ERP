import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useTareas,
  useTareaMetricas,
  useCrearTarea,
  useResolverTarea,
  usePosponerTarea,
  useComentarTarea,
  useTareaComentarios,
} from '@/hooks/useTareas';

const ESTADOS = ['pendiente', 'en_progreso', 'pospuesta', 'resuelta', 'cancelada'] as const;
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const;
const KANBAN_COLS = ['pendiente', 'en_progreso', 'pospuesta', 'resuelta'] as const;

export function TareasPage() {
  const [vista, setVista] = useState<'lista' | 'kanban'>('lista');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<string | null>(null);

  const filters: Record<string, string> = {};
  if (filtroEstado) filters.estado = filtroEstado;
  if (filtroPrioridad) filters.prioridad = filtroPrioridad;

  const { data: res, isLoading } = useTareas(filters);
  const { data: metricasRes } = useTareaMetricas();
  const items = res && 'data' in res ? (res.data ?? []) as any[] : [];
  const metricas = metricasRes && 'data' in metricasRes ? metricasRes.data : null;

  return (
    <div className="page-tareas">
      <div className="page-header">
        <h2>Tareas internas</h2>
        <div className="page-actions">
          <div className="vista-toggle">
            <button className={`btn-sm ${vista === 'lista' ? 'active' : ''}`} onClick={() => setVista('lista')}>Lista</button>
            <button className={`btn-sm ${vista === 'kanban' ? 'active' : ''}`} onClick={() => setVista('kanban')}>Kanban</button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Nueva tarea</button>
        </div>
      </div>

      {metricas && (
        <div className="metricas-bar">
          <div className="metrica"><span className="metrica-value">{metricas.total}</span><span className="metrica-label">Total</span></div>
          <div className="metrica"><span className="metrica-value">{metricas.pendientes}</span><span className="metrica-label">Pendientes</span></div>
          <div className="metrica"><span className="metrica-value">{metricas.en_progreso}</span><span className="metrica-label">En progreso</span></div>
          <div className="metrica metrica-warning"><span className="metrica-value">{metricas.vencidas}</span><span className="metrica-label">Vencidas</span></div>
          <div className="metrica"><span className="metrica-value">{metricas.tiempo_medio_resolucion_horas ? `${Math.round(metricas.tiempo_medio_resolucion_horas)}h` : '—'}</span><span className="metrica-label">T. medio</span></div>
        </div>
      )}

      <div className="filters-bar">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : vista === 'kanban' ? (
        <KanbanView items={items} onSelect={setSelectedTarea} />
      ) : (
        <ListView items={items} onSelect={setSelectedTarea} />
      )}

      {showCreate && <CrearTareaModal onClose={() => setShowCreate(false)} />}
      {selectedTarea && <TareaDetailModal tareaId={selectedTarea} items={items} onClose={() => setSelectedTarea(null)} />}
    </div>
  );
}

function ListView({ items, onSelect }: { items: any[]; onSelect: (id: string) => void }) {
  if (items.length === 0) return <div className="empty-state">No hay tareas</div>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Titulo</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>Asignado</th>
          <th>Fecha limite</th>
          <th>Expediente</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} onClick={() => onSelect(t.id)} className={`clickable-row ${isVencida(t) ? 'row-danger' : ''}`}>
            <td>{t.titulo}</td>
            <td><span className={`badge badge-${t.estado ?? 'pendiente'}`}>{t.estado ?? 'pendiente'}</span></td>
            <td><span className={`badge badge-prio-${t.prioridad}`}>{t.prioridad}</span></td>
            <td>{t.asignado_a ? t.asignado_a.substring(0, 8) : '—'}</td>
            <td className={isVencida(t) ? 'text-danger' : ''}>{t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString('es-ES') : '—'}</td>
            <td>{t.expediente_id ? <Link to={`/expedientes/${t.expediente_id}`} className="link" onClick={(e) => e.stopPropagation()}>{t.expediente_id.substring(0, 8)}</Link> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KanbanView({ items, onSelect }: { items: any[]; onSelect: (id: string) => void }) {
  return (
    <div className="kanban-board">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((t) => (t.estado ?? 'pendiente') === col);
        return (
          <div key={col} className="kanban-column">
            <div className="kanban-col-header">
              <span className="kanban-col-title">{col}</span>
              <span className="kanban-col-count">{colItems.length}</span>
            </div>
            <div className="kanban-col-body">
              {colItems.map((t) => (
                <div key={t.id} className={`kanban-card ${isVencida(t) ? 'kanban-card-danger' : ''}`} onClick={() => onSelect(t.id)}>
                  <div className="kanban-card-title">{t.titulo}</div>
                  <div className="kanban-card-meta">
                    <span className={`badge badge-prio-${t.prioridad}`}>{t.prioridad}</span>
                    {t.fecha_limite && <span className="kanban-card-date">{new Date(t.fecha_limite).toLocaleDateString('es-ES')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CrearTareaModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearTarea();
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'media', fecha_limite: '', expediente_id: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: any = { titulo: form.titulo, descripcion: form.descripcion || undefined, prioridad: form.prioridad };
    if (form.fecha_limite) body.fecha_limite = new Date(form.fecha_limite).toISOString();
    if (form.expediente_id) body.expediente_id = form.expediente_id;
    await crear.mutateAsync(body);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Nueva tarea</h3><button className="btn-close" onClick={onClose}>&times;</button></div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Titulo *</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
          <div className="form-group"><label>Descripcion</label><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} /></div>
          <div className="form-grid">
            <div className="form-group">
              <label>Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Fecha limite</label><input type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Expediente ID (opcional)</label><input value={form.expediente_id} onChange={(e) => setForm({ ...form, expediente_id: e.target.value })} placeholder="UUID" /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={crear.isPending}>Crear</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TareaDetailModal({ tareaId, items, onClose }: { tareaId: string; items: any[]; onClose: () => void }) {
  const tarea = items.find((t) => t.id === tareaId);
  const resolver = useResolverTarea();
  const posponer = usePosponerTarea();
  const comentar = useComentarTarea();
  const { data: comRes } = useTareaComentarios(tareaId);
  const comentarios = comRes && 'data' in comRes ? (comRes.data ?? []) as any[] : [];

  const [resolucion, setResolucion] = useState('');
  const [fechaPosp, setFechaPosp] = useState('');
  const [motivoPosp, setMotivoPosp] = useState('');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [showPosponer, setShowPosponer] = useState(false);
  const [showResolver, setShowResolver] = useState(false);

  if (!tarea) return null;
  const isResolved = tarea.estado === 'resuelta' || tarea.estado === 'cancelada';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tarea.titulo}</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tarea-detail-body">
          <div className="tarea-detail-meta">
            <span className={`badge badge-${tarea.estado ?? 'pendiente'}`}>{tarea.estado ?? 'pendiente'}</span>
            <span className={`badge badge-prio-${tarea.prioridad}`}>{tarea.prioridad}</span>
            {tarea.fecha_limite && <span>Limite: {new Date(tarea.fecha_limite).toLocaleDateString('es-ES')}</span>}
          </div>
          {tarea.descripcion && <p className="tarea-descripcion">{tarea.descripcion}</p>}
          {tarea.resolucion && <p><strong>Resolucion:</strong> {tarea.resolucion}</p>}
          {tarea.motivo_posposicion && <p><strong>Motivo posposicion:</strong> {tarea.motivo_posposicion}</p>}

          {!isResolved && (
            <div className="tarea-actions">
              {!showResolver && !showPosponer && (
                <>
                  <button className="btn btn-success" onClick={() => setShowResolver(true)}>Resolver</button>
                  <button className="btn btn-outline-danger" onClick={() => setShowPosponer(true)}>Posponer</button>
                </>
              )}
              {showResolver && (
                <div className="inline-action-form">
                  <textarea placeholder="Resolucion..." value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={2} />
                  <div className="inline-action-buttons">
                    <button className="btn btn-success" disabled={!resolucion.trim() || resolver.isPending} onClick={async () => { await resolver.mutateAsync({ id: tareaId, resolucion }); onClose(); }}>Confirmar</button>
                    <button className="btn btn-secondary" onClick={() => setShowResolver(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {showPosponer && (
                <div className="inline-action-form">
                  <input type="date" value={fechaPosp} onChange={(e) => setFechaPosp(e.target.value)} />
                  <input placeholder="Motivo..." value={motivoPosp} onChange={(e) => setMotivoPosp(e.target.value)} />
                  <div className="inline-action-buttons">
                    <button className="btn btn-warning" disabled={!fechaPosp || !motivoPosp.trim() || posponer.isPending} onClick={async () => { await posponer.mutateAsync({ id: tareaId, fecha_pospuesta: new Date(fechaPosp).toISOString(), motivo: motivoPosp }); onClose(); }}>Posponer</button>
                    <button className="btn btn-secondary" onClick={() => setShowPosponer(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="tarea-comentarios">
            <h4>Comentarios ({comentarios.length})</h4>
            {comentarios.map((c: any) => (
              <div key={c.id} className="comentario-item">
                <span className="comentario-date">{new Date(c.created_at).toLocaleString('es-ES')}</span>
                <p>{c.contenido}</p>
              </div>
            ))}
            <div className="comentario-form">
              <input placeholder="Escribir comentario..." value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!nuevoComentario.trim() || comentar.isPending} onClick={async () => { await comentar.mutateAsync({ id: tareaId, contenido: nuevoComentario }); setNuevoComentario(''); }}>Enviar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function isVencida(t: any): boolean {
  if (t.estado === 'resuelta' || t.estado === 'cancelada') return false;
  if (!t.fecha_limite) return false;
  return new Date(t.fecha_limite) < new Date();
}
