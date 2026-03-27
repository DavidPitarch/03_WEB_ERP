import { useState } from 'react';
import { FileText, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  useCondicionesPresupuesto,
  useCreateCondicion,
  useUpdateCondicion,
  useDeleteCondicion,
  type CondicionPresupuesto,
} from '@/hooks/useCondicionesPresupuesto';

const EMPTY: Partial<CondicionPresupuesto> = { titulo: '', contenido: '', activa: true, orden: 0 };

export function CondicionesPresupuestosPage() {
  const [filtro, setFiltro] = useState<boolean | undefined>(true);
  const { data: res, isLoading } = useCondicionesPresupuesto(filtro);
  const crear = useCreateCondicion();
  const actualizar = useUpdateCondicion();
  const eliminar = useDeleteCondicion();

  const [editing, setEditing] = useState<CondicionPresupuesto | null>(null);
  const [form, setForm] = useState<Partial<CondicionPresupuesto>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CondicionPresupuesto | null>(null);
  const [formError, setFormError] = useState('');

  const condiciones: CondicionPresupuesto[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(c: CondicionPresupuesto) { setEditing(c); setForm({ ...c }); setFormError(''); setShowForm(true); }
  function setField(k: keyof CondicionPresupuesto, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      if (editing) await actualizar.mutateAsync({ id: editing.id, ...form });
      else await crear.mutateAsync(form);
      setShowForm(false);
    } catch (err: any) { setFormError(err.message ?? 'Error al guardar'); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await eliminar.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  async function handleToggle(c: CondicionPresupuesto) {
    await actualizar.mutateAsync({ id: c.id, activa: !c.activa });
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} /> Condiciones de Presupuestos</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Textos de condiciones que se incluyen en los presupuestos enviados a clientes</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nueva condición
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([true, false, undefined] as const).map((v) => (
          <button key={String(v)} className={`btn ${filtro === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(v)}>
            {v === true ? 'Activas' : v === false ? 'Inactivas' : 'Todas'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {condiciones.length} condición{condiciones.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {isLoading ? <div className="loading">Cargando condiciones...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {condiciones.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin condiciones registradas</p>
          )}
          {condiciones.map((c) => (
            <div key={c.id} style={{
              background: 'var(--color-bg-subtle)', borderRadius: 8, border: '1px solid var(--color-border-default)',
              padding: '14px 16px', opacity: c.activa ? 1 : 0.55,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <GripVertical size={16} style={{ color: 'var(--color-text-tertiary)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineClamp: 2 }}>
                  {c.contenido.length > 200 ? `${c.contenido.slice(0, 200)}…` : c.contenido}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button
                  className={`badge ${c.activa ? 'badge-success' : 'badge-default'}`}
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => handleToggle(c)}
                >{c.activa ? 'Activa' : 'Inactiva'}</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(c)} title="Editar"><Pencil size={13} /></button>
                <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(c)} title="Eliminar"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear / Editar */}
      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar condición' : 'Nueva condición'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Título</label>
                  <input className="form-control" value={form.titulo ?? ''} required autoFocus placeholder="Ej. Condiciones generales de garantía" onChange={(e) => setField('titulo', e.target.value)} />
                </div>
                <div className="form-group-v2">
                  <label className="form-label required">Contenido</label>
                  <textarea className="form-control" rows={6} required value={form.contenido ?? ''} placeholder="Texto completo de las condiciones..." onChange={(e) => setField('contenido', e.target.value)} />
                </div>
                <div className="form-grid-v2">
                  <div className="form-group-v2">
                    <label className="form-label">Orden</label>
                    <input className="form-control" type="number" min={0} value={form.orden ?? 0} onChange={(e) => setField('orden', parseInt(e.target.value) || 0)} />
                  </div>
                  {editing && (
                    <div className="form-group-v2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" id="activa-cb" checked={form.activa ?? true} onChange={(e) => setField('activa', e.target.checked)} style={{ width: 15, height: 15 }} />
                      <label htmlFor="activa-cb" className="form-label" style={{ margin: 0 }}>Activa</label>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar condición</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar la condición <strong>{confirmDelete.titulo}</strong>?</p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={eliminar.isPending}>{eliminar.isPending ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
