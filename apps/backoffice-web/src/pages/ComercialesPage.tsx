import { useState } from 'react';
import { UserPlus, Pencil, Trash2, Search } from 'lucide-react';
import {
  useComerciales,
  useCreateComercial,
  useUpdateComercial,
  useDeleteComercial,
  type Comercial,
} from '@/hooks/useComerciales';

const TIPO_ID = ['NIF', 'CIF', 'NIE', 'OTROS'];
const EMPTY: Partial<Comercial> = {
  nombre: '', apellidos: '', tipo_identificacion: 'NIF', nif: '', telefono: '', fax: '', email: '',
  direccion: '', codigo_postal: '', ciudad: '', provincia: '', usuario_intranet: '', email_app: '', observaciones: '',
};

export function ComercialesPage() {
  const [filtroActivo, setFiltroActivo] = useState<'activos' | 'todos' | 'bajas'>('activos');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Comercial | null>(null);
  const [form, setForm] = useState<Partial<Comercial>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Comercial | null>(null);
  const [formError, setFormError] = useState('');

  const activo = filtroActivo === 'activos' ? true : filtroActivo === 'bajas' ? false : undefined;
  const { data: res, isLoading } = useComerciales({ activo, search: search || undefined });
  const crear = useCreateComercial();
  const actualizar = useUpdateComercial();
  const eliminar = useDeleteComercial();

  const comerciales: Comercial[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(c: Comercial) { setEditing(c); setForm({ ...c }); setFormError(''); setShowForm(true); }

  function setField(key: keyof Comercial, val: unknown) {
    setForm(p => ({ ...p, [key]: val }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await actualizar.mutateAsync({ id: editing.id, ...form });
      } else {
        await crear.mutateAsync(form);
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message ?? 'Error al guardar');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await eliminar.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={20} /> Comerciales</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Agentes comerciales e intermediarios del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Añadir comercial</button>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['activos', 'todos', 'bajas'] as const).map((f) => (
          <button key={f} className={`btn ${filtroActivo === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroActivo(f)}>
            {f === 'activos' ? 'Activos' : f === 'bajas' ? 'Bajas' : 'Todos'}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32, width: 220 }}
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? <div className="loading">Cargando comerciales...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIF</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Ciudad</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comerciales.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin resultados</td></tr>
              )}
              {comerciales.map((c) => (
                <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}{c.apellidos ? ` ${c.apellidos}` : ''}</td>
                  <td style={{ fontSize: 13 }}>
                    {c.nif
                      ? <><span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{c.tipo_identificacion} </span>{c.nif}</>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 13 }}>{c.telefono ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{c.email ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{c.ciudad ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c.activo ? 'badge-success' : 'badge-default'}`}>{c.activo ? 'Activo' : 'Baja'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(c)} title="Editar"><Pencil size={13} /></button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(c)} title="Eliminar"><Trash2 size={13} /></button>
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
          <div className="modal-v2 modal-v2--lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar comercial' : 'Nuevo comercial'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                {/* Datos personales */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Datos personales</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Nombre</label>
                      <input className="form-control" value={form.nombre ?? ''} required autoFocus onChange={(e) => setField('nombre', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Apellidos</label>
                      <input className="form-control" value={form.apellidos ?? ''} onChange={(e) => setField('apellidos', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Identificación</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-control" style={{ width: 90, flexShrink: 0 }} value={form.tipo_identificacion ?? 'NIF'} onChange={(e) => setField('tipo_identificacion', e.target.value)}>
                          {TIPO_ID.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input className="form-control" value={form.nif ?? ''} placeholder="Número" onChange={(e) => setField('nif', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" value={form.telefono ?? ''} onChange={(e) => setField('telefono', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Fax</label>
                      <input className="form-control" value={form.fax ?? ''} onChange={(e) => setField('fax', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Dirección */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Dirección</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2 span-full">
                      <label className="form-label">Dirección</label>
                      <input className="form-control" value={form.direccion ?? ''} onChange={(e) => setField('direccion', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Código Postal</label>
                      <input className="form-control" value={form.codigo_postal ?? ''} onChange={(e) => setField('codigo_postal', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Ciudad</label>
                      <input className="form-control" value={form.ciudad ?? ''} onChange={(e) => setField('ciudad', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Provincia</label>
                      <input className="form-control" value={form.provincia ?? ''} onChange={(e) => setField('provincia', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Acceso intranet */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Acceso intranet</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label">Usuario</label>
                      <input className="form-control" value={form.usuario_intranet ?? ''} onChange={(e) => setField('usuario_intranet', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">E-mail aplicación</label>
                      <input className="form-control" type="email" value={form.email_app ?? ''} onChange={(e) => setField('email_app', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="form-group-v2">
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-control" rows={3} value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} />
                </div>

                {/* Estado (solo al editar) */}
                {editing && (
                  <div className="form-group-v2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="activo-cb" checked={form.activo ?? true} onChange={(e) => setField('activo', e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="activo-cb" className="form-label" style={{ margin: 0 }}>Comercial activo</label>
                  </div>
                )}
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Añadir comercial')}</button>
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
              <div className="modal-v2__title">Eliminar comercial</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar a <strong>{confirmDelete.nombre}{confirmDelete.apellidos ? ` ${confirmDelete.apellidos}` : ''}</strong>?</p>
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
