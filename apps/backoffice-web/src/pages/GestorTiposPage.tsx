import { useState } from 'react';
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useTiposSiniestro,
  useCreateTipoSiniestro,
  useUpdateTipoSiniestro,
  useDeleteTipoSiniestro,
  type TipoSiniestro,
} from '@/hooks/useTiposSiniestro';

const COLORES_PRESET = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280','#06b6d4','#14b8a6'];

const EMPTY = { nombre: '', color: '#3b82f6', orden: 0 };

export function GestorTiposPage() {
  const [filtro, setFiltro] = useState<boolean | undefined>(true);
  const { data: res, isLoading } = useTiposSiniestro(filtro);
  const crear = useCreateTipoSiniestro();
  const actualizar = useUpdateTipoSiniestro();
  const eliminar = useDeleteTipoSiniestro();

  const [editing, setEditing] = useState<TipoSiniestro | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TipoSiniestro | null>(null);
  const [formError, setFormError] = useState('');

  const tipos: TipoSiniestro[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(t: TipoSiniestro) { setEditing(t); setForm({ nombre: t.nombre, color: t.color, orden: t.orden }); setFormError(''); setShowForm(true); }

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

  async function handleToggle(t: TipoSiniestro) {
    await actualizar.mutateAsync({ id: t.id, activo: !t.activo });
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={20} /> Gestor de Tipos</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Etiquetas y clasificaciones de siniestros</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nuevo tipo
        </button>
      </div>

      {/* Filtro activo/inactivo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([true, false, undefined] as const).map((v) => (
          <button key={String(v)} className={`btn ${filtro === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(v)}>
            {v === true ? 'Activos' : v === false ? 'Inactivos' : 'Todos'}
          </button>
        ))}
      </div>

      {isLoading ? <div className="loading">Cargando tipos...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tipos.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 32 }}>Sin tipos registrados</p>}
          {tipos.map((t) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--color-bg-subtle)', borderRadius: 8,
              border: '1px solid var(--color-border-default)', opacity: t.activo ? 1 : 0.55,
            }}>
              {/* Color picker inline */}
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: t.color, flexShrink: 0, boxShadow: `0 0 0 2px ${t.color}33` }} />
              <span style={{ fontWeight: 600, flex: 1 }}>{t.nombre}</span>
              <button
                className={`badge ${t.activo ? 'badge-success' : 'badge-default'}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => handleToggle(t)}
              >
                {t.activo ? 'Activo' : 'Inactivo'}
              </button>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(t)} title="Editar"><Pencil size={13} /></button>
              <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(t)} title="Eliminar"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear / Editar */}
      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar tipo' : 'Nuevo tipo'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Nombre</label>
                  <input className="form-control" value={form.nombre} required autoFocus placeholder="Ej. Agua" onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Color</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {COLORES_PRESET.map(c => (
                      <button
                        key={c}
                        type="button"
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                          boxShadow: form.color === c ? `0 0 0 3px ${c}66` : 'none',
                          transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                          transition: 'transform 0.1s',
                        }}
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        title={c}
                      />
                    ))}
                    <input type="color" value={form.color} onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))} style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} title="Color personalizado" />
                  </div>
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Orden</label>
                  <input className="form-control" type="number" min={0} value={form.orden} onChange={(e) => setForm(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} />
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

      {/* Modal: Confirmar eliminación */}
      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar tipo</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar el tipo <strong>{confirmDelete.nombre}</strong>?</p>
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
