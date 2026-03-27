import { useState } from 'react';
import { FileCheck2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useDocRequerida,
  useCreateDocRequerida,
  useUpdateDocRequerida,
  useDeleteDocRequerida,
  type DocRequeridaTipo,
} from '@/hooks/useDocRequerida';

const EMPTY: Partial<DocRequeridaTipo> = { nombre: '', descripcion: '', dias_vigencia: null, obligatorio: true, orden: 0 };

export function DocRequeridaPage() {
  const [filtro, setFiltro] = useState<boolean | undefined>(true);
  const { data: res, isLoading } = useDocRequerida(filtro);
  const crear = useCreateDocRequerida();
  const actualizar = useUpdateDocRequerida();
  const eliminar = useDeleteDocRequerida();

  const [editing, setEditing] = useState<DocRequeridaTipo | null>(null);
  const [form, setForm] = useState<Partial<DocRequeridaTipo>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DocRequeridaTipo | null>(null);
  const [formError, setFormError] = useState('');

  const tipos: DocRequeridaTipo[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(d: DocRequeridaTipo) { setEditing(d); setForm({ ...d }); setFormError(''); setShowForm(true); }
  function setField(k: keyof DocRequeridaTipo, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

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

  async function handleToggle(d: DocRequeridaTipo) {
    await actualizar.mutateAsync({ id: d.id, activo: !d.activo });
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileCheck2 size={20} /> Documentación Requerida</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Tipos de documentos exigidos a los operarios para trabajar con la empresa
          </p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nuevo documento
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([true, false, undefined] as const).map((v) => (
          <button key={String(v)} className={`btn ${filtro === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(v)}>
            {v === true ? 'Activos' : v === false ? 'Inactivos' : 'Todos'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {tipos.length} documento{tipos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? <div className="loading">Cargando documentación...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre del documento</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Obligatorio</th>
                <th style={{ textAlign: 'right' }}>Vigencia</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tipos.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin documentos</td></tr>
              )}
              {tipos.map((d) => (
                <tr key={d.id} style={{ opacity: d.activo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{d.nombre}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{d.descripcion ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${d.obligatorio ? 'badge-danger' : 'badge-default'}`}>{d.obligatorio ? 'Obligatorio' : 'Opcional'}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>
                    {d.dias_vigencia ? `${d.dias_vigencia} días` : <span style={{ color: 'var(--color-text-tertiary)' }}>Sin vencimiento</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${d.activo ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(d)}
                    >
                      {d.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(d)} title="Editar"><Pencil size={13} /></button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(d)} title="Eliminar"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Crear / Editar */}
      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar documento requerido' : 'Nuevo documento requerido'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Nombre del documento</label>
                  <input className="form-control" value={form.nombre ?? ''} required autoFocus placeholder="Ej. Póliza de Responsabilidad Civil" onChange={(e) => setField('nombre', e.target.value)} />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-control" rows={2} value={form.descripcion ?? ''} placeholder="Descripción opcional del documento" onChange={(e) => setField('descripcion', e.target.value)} />
                </div>
                <div className="form-grid-v2">
                  <div className="form-group-v2">
                    <label className="form-label">Días de vigencia</label>
                    <input
                      className="form-control"
                      type="number"
                      min={1}
                      value={form.dias_vigencia ?? ''}
                      placeholder="Dejar vacío = sin vencimiento"
                      onChange={(e) => setField('dias_vigencia', e.target.value ? parseInt(e.target.value) : null)}
                    />
                    <div className="form-hint">Días desde la fecha de entrega hasta el vencimiento</div>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Orden</label>
                    <input className="form-control" type="number" min={0} value={form.orden ?? 0} onChange={(e) => setField('orden', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="obligatorio-cb" checked={form.obligatorio ?? true} onChange={(e) => setField('obligatorio', e.target.checked)} style={{ width: 15, height: 15 }} />
                    <label htmlFor="obligatorio-cb" className="form-label" style={{ margin: 0 }}>Obligatorio</label>
                  </div>
                  {editing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" id="activo-cb" checked={form.activo ?? true} onChange={(e) => setField('activo', e.target.checked)} style={{ width: 15, height: 15 }} />
                      <label htmlFor="activo-cb" className="form-label" style={{ margin: 0 }}>Activo</label>
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
              <div className="modal-v2__title">Eliminar documento</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar el tipo de documento <strong>{confirmDelete.nombre}</strong>?</p>
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
