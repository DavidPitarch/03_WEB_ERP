import { useState } from 'react';
import { AtSign, Plus, Pencil, Trash2, Star } from 'lucide-react';
import {
  useCorreos,
  useCreateCuentaCorreo,
  useUpdateCuentaCorreo,
  useDeleteCuentaCorreo,
  type CuentaCorreo,
} from '@/hooks/useCorreos';

const EMPTY: Partial<CuentaCorreo> & { password_encrypted?: string } = {
  nombre: '', direccion: '', usuario: '', servidor_imap: '', puerto_imap: 993,
  servidor_smtp: '', puerto_smtp: 587, usa_tls: true, activa: true, es_remitente_defecto: false,
};

export function CorreosPage() {
  const { data: res, isLoading } = useCorreos();
  const crear = useCreateCuentaCorreo();
  const actualizar = useUpdateCuentaCorreo();
  const eliminar = useDeleteCuentaCorreo();

  const [editing, setEditing] = useState<CuentaCorreo | null>(null);
  const [form, setForm] = useState<Partial<CuentaCorreo> & { password_encrypted?: string }>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CuentaCorreo | null>(null);
  const [formError, setFormError] = useState('');

  const cuentas: CuentaCorreo[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(c: CuentaCorreo) {
    setEditing(c);
    setForm({ ...c, password_encrypted: '' });
    setFormError('');
    setShowForm(true);
  }
  function setField(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      const payload = { ...form };
      if (!payload.password_encrypted) delete payload.password_encrypted;
      if (editing) await actualizar.mutateAsync({ id: editing.id, ...payload });
      else await crear.mutateAsync(payload);
      setShowForm(false);
    } catch (err: any) { setFormError(err.message ?? 'Error al guardar'); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await eliminar.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  async function handleToggle(c: CuentaCorreo) {
    await actualizar.mutateAsync({ id: c.id, activa: !c.activa });
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><AtSign size={20} /> Cuentas de Correo</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Cuentas IMAP/SMTP configuradas para el sistema de comunicaciones</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nueva cuenta
        </button>
      </div>

      {isLoading ? <div className="loading">Cargando cuentas...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Servidor SMTP</th>
                <th>IMAP</th>
                <th style={{ textAlign: 'center' }}>Defecto</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin cuentas configuradas</td></tr>
              )}
              {cuentas.map((c) => (
                <tr key={c.id} style={{ opacity: c.activa ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td style={{ fontSize: 13 }}>{c.direccion}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{c.servidor_smtp}:{c.puerto_smtp}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {c.servidor_imap ? `${c.servidor_imap}:${c.puerto_imap}` : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {c.es_remitente_defecto && <Star size={14} style={{ color: 'var(--color-warning)' }} fill="currentColor" />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${c.activa ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(c)}
                    >{c.activa ? 'Activa' : 'Inactiva'}</button>
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
              <div className="modal-v2__title">{editing ? 'Editar cuenta de correo' : 'Nueva cuenta de correo'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                {/* Datos generales */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Datos generales</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Nombre</label>
                      <input className="form-control" value={form.nombre ?? ''} required autoFocus placeholder="Ej. Correo principal" onChange={(e) => setField('nombre', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label required">Dirección de correo</label>
                      <input className="form-control" type="email" value={form.direccion ?? ''} required placeholder="info@empresa.com" onChange={(e) => setField('direccion', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label required">Usuario</label>
                      <input className="form-control" value={form.usuario ?? ''} required placeholder="Nombre de usuario o email" onChange={(e) => setField('usuario', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">{editing ? 'Nueva contraseña (dejar en blanco para mantener)' : 'Contraseña'}</label>
                      <input className="form-control" type="password" value={form.password_encrypted ?? ''} placeholder={editing ? '••••••••' : 'Contraseña'} autoComplete="new-password" onChange={(e) => setField('password_encrypted', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* SMTP */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Servidor SMTP (salida)</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Servidor SMTP</label>
                      <input className="form-control" value={form.servidor_smtp ?? ''} required placeholder="smtp.gmail.com" onChange={(e) => setField('servidor_smtp', e.target.value)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Puerto SMTP</label>
                      <input className="form-control" type="number" value={form.puerto_smtp ?? 587} onChange={(e) => setField('puerto_smtp', parseInt(e.target.value) || 587)} />
                    </div>
                  </div>
                </div>

                {/* IMAP */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">Servidor IMAP (entrada) — opcional</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label">Servidor IMAP</label>
                      <input className="form-control" value={form.servidor_imap ?? ''} placeholder="imap.gmail.com" onChange={(e) => setField('servidor_imap', e.target.value || null)} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Puerto IMAP</label>
                      <input className="form-control" type="number" value={form.puerto_imap ?? 993} onChange={(e) => setField('puerto_imap', parseInt(e.target.value) || 993)} />
                    </div>
                  </div>
                </div>

                {/* Opciones */}
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.usa_tls ?? true} onChange={(e) => setField('usa_tls', e.target.checked)} style={{ width: 15, height: 15 }} />
                    <span className="form-label" style={{ margin: 0 }}>Usar TLS/SSL</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.es_remitente_defecto ?? false} onChange={(e) => setField('es_remitente_defecto', e.target.checked)} style={{ width: 15, height: 15 }} />
                    <span className="form-label" style={{ margin: 0 }}>Remitente por defecto</span>
                  </label>
                  {editing && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.activa ?? true} onChange={(e) => setField('activa', e.target.checked)} style={{ width: 15, height: 15 }} />
                      <span className="form-label" style={{ margin: 0 }}>Cuenta activa</span>
                    </label>
                  )}
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear cuenta')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar cuenta</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar la cuenta <strong>{confirmDelete.nombre}</strong> ({confirmDelete.direccion})?</p>
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
