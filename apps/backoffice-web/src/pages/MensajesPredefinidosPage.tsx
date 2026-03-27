import { useState } from 'react';
import { MessageCircle, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import {
  useMensajesPredefinidos,
  useCreateMensaje,
  useUpdateMensaje,
  useDeleteMensaje,
  type MensajePredefinido,
} from '@/hooks/useMensajesPredefinidos';

const EMPTY: Partial<MensajePredefinido> = { nombre: '', tipo: 'ambos', asunto: null, contenido: '', variables: [], activo: true };

const TIPO_LABELS: Record<string, string> = { sms: 'SMS', email: 'Email', ambos: 'SMS y Email' };
const TIPO_BADGE: Record<string, string> = { sms: 'badge-info', email: 'badge-warning', ambos: 'badge-default' };

const VARIABLES_DISPONIBLES = [
  '{{nombre_asegurado}}', '{{apellidos_asegurado}}', '{{numero_expediente}}',
  '{{fecha_cita}}', '{{hora_cita}}', '{{nombre_tramitador}}',
  '{{telefono_empresa}}', '{{empresa}}', '{{nombre_operario}}',
];

function insertVariable(text: string, cursorPos: number, variable: string): { text: string; cursor: number } {
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);
  const newText = before + variable + after;
  return { text: newText, cursor: cursorPos + variable.length };
}

export function MensajesPredefinidosPage() {
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroActivo, setFiltroActivo] = useState<boolean | undefined>(true);
  const { data: res, isLoading } = useMensajesPredefinidos({ activo: filtroActivo, tipo: filtroTipo || undefined });
  const crear = useCreateMensaje();
  const actualizar = useUpdateMensaje();
  const eliminar = useDeleteMensaje();

  const [editing, setEditing] = useState<MensajePredefinido | null>(null);
  const [form, setForm] = useState<Partial<MensajePredefinido>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState<MensajePredefinido | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MensajePredefinido | null>(null);
  const [formError, setFormError] = useState('');
  const [contenidoRef, setContenidoRef] = useState<HTMLTextAreaElement | null>(null);

  const mensajes: MensajePredefinido[] = res?.data ?? [];

  function openNew() { setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true); }
  function openEdit(m: MensajePredefinido) { setEditing(m); setForm({ ...m }); setFormError(''); setShowForm(true); }
  function setField(k: keyof MensajePredefinido, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  function addVariable(variable: string) {
    const pos = contenidoRef?.selectionStart ?? (form.contenido?.length ?? 0);
    const { text, cursor } = insertVariable(form.contenido ?? '', pos, variable);
    setField('contenido', text);
    // Extraer variables del contenido actualizado
    const found = (text.match(/\{\{[\w_]+\}\}/g) ?? []).filter((v, i, a) => a.indexOf(v) === i);
    setField('variables', found);
    setTimeout(() => { if (contenidoRef) { contenidoRef.focus(); contenidoRef.setSelectionRange(cursor, cursor); } }, 0);
  }

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

  async function handleToggle(m: MensajePredefinido) {
    await actualizar.mutateAsync({ id: m.id, activo: !m.activo });
  }

  const isPending = crear.isPending || actualizar.isPending;

  function renderPreview(contenido: string): string {
    return contenido
      .replace(/\{\{nombre_asegurado\}\}/g, 'Juan')
      .replace(/\{\{apellidos_asegurado\}\}/g, 'García López')
      .replace(/\{\{numero_expediente\}\}/g, 'EXP-2026-00123')
      .replace(/\{\{fecha_cita\}\}/g, '15/04/2026')
      .replace(/\{\{hora_cita\}\}/g, '10:30')
      .replace(/\{\{nombre_tramitador\}\}/g, 'María Sánchez')
      .replace(/\{\{telefono_empresa\}\}/g, '963 123 456')
      .replace(/\{\{empresa\}\}/g, 'GUAI Servicios S.L.')
      .replace(/\{\{nombre_operario\}\}/g, 'Carlos Martínez');
  }

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={20} /> Mensajes Predefinidos</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Plantillas de comunicación para SMS y email con variables dinámicas</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nuevo mensaje
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([true, false, undefined] as const).map((v) => (
          <button key={String(v)} className={`btn ${filtroActivo === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroActivo(v)}>
            {v === true ? 'Activos' : v === false ? 'Inactivos' : 'Todos'}
          </button>
        ))}
        <select className="form-control" style={{ width: 160 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
          <option value="ambos">SMS y Email</option>
        </select>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? <div className="loading">Cargando mensajes...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th style={{ textAlign: 'center' }}>Tipo</th>
                <th>Asunto</th>
                <th>Variables</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mensajes.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin mensajes predefinidos</td></tr>
              )}
              {mensajes.map((m) => (
                <tr key={m.id} style={{ opacity: m.activo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${TIPO_BADGE[m.tipo]}`}>{TIPO_LABELS[m.tipo]}</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{m.asunto ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    {m.variables.slice(0, 3).map(v => (
                      <span key={v} style={{ display: 'inline-block', background: 'var(--color-bg-muted)', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontFamily: 'monospace' }}>{v}</span>
                    ))}
                    {m.variables.length > 3 && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>+{m.variables.length - 3}</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${m.activo ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(m)}
                    >{m.activo ? 'Activo' : 'Inactivo'}</button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowPreview(m)} title="Previsualizar"><Eye size={13} /></button>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(m)} title="Editar"><Pencil size={13} /></button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(m)} title="Eliminar"><Trash2 size={13} /></button>
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
              <div className="modal-v2__title">{editing ? 'Editar mensaje' : 'Nuevo mensaje predefinido'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-grid-v2">
                  <div className="form-group-v2">
                    <label className="form-label required">Nombre</label>
                    <input className="form-control" value={form.nombre ?? ''} required autoFocus placeholder="Ej. Confirmación de cita" onChange={(e) => setField('nombre', e.target.value)} />
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label required">Tipo</label>
                    <select className="form-control" value={form.tipo ?? 'ambos'} onChange={(e) => setField('tipo', e.target.value)}>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="ambos">SMS y Email</option>
                    </select>
                  </div>
                  {(form.tipo === 'email' || form.tipo === 'ambos') && (
                    <div className="form-group-v2 span-full">
                      <label className="form-label">Asunto (email)</label>
                      <input className="form-control" value={form.asunto ?? ''} placeholder="Asunto del email" onChange={(e) => setField('asunto', e.target.value || null)} />
                    </div>
                  )}
                </div>

                {/* Variables disponibles */}
                <div className="form-group-v2">
                  <label className="form-label">Variables disponibles</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {VARIABLES_DISPONIBLES.map((v) => (
                      <button key={v} type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', fontFamily: 'monospace' }} onClick={() => addVariable(v)}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <div className="form-hint">Clic en una variable para insertarla en el contenido</div>
                </div>

                <div className="form-group-v2">
                  <label className="form-label required">Contenido del mensaje</label>
                  <textarea
                    ref={setContenidoRef}
                    className="form-control"
                    rows={6}
                    required
                    value={form.contenido ?? ''}
                    placeholder="Texto del mensaje con {{variables}}"
                    onChange={(e) => {
                      setField('contenido', e.target.value);
                      const found = (e.target.value.match(/\{\{[\w_]+\}\}/g) ?? []).filter((v, i, a) => a.indexOf(v) === i);
                      setField('variables', found);
                    }}
                  />
                  {form.variables && form.variables.length > 0 && (
                    <div className="form-hint">Variables detectadas: {form.variables.join(', ')}</div>
                  )}
                </div>

                {editing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="activo-cb" checked={form.activo ?? true} onChange={(e) => setField('activo', e.target.checked)} style={{ width: 15, height: 15 }} />
                    <label htmlFor="activo-cb" className="form-label" style={{ margin: 0 }}>Activo</label>
                  </div>
                )}
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Preview */}
      {showPreview && (
        <div className="modal-overlay-v2" onClick={() => setShowPreview(null)}>
          <div className="modal-v2 modal-v2--md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Preview: {showPreview.nombre}</div>
              <button className="modal-v2__close" onClick={() => setShowPreview(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge ${TIPO_BADGE[showPreview.tipo]}`}>{TIPO_LABELS[showPreview.tipo]}</span>
              </div>
              {showPreview.asunto && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Asunto:</div>
                  <div style={{ fontWeight: 600 }}>{renderPreview(showPreview.asunto)}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Mensaje:</div>
                <div style={{ background: 'var(--color-bg-muted)', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {renderPreview(showPreview.contenido)}
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>Preview con datos de ejemplo</p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setShowPreview(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación */}
      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar mensaje</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0 }}>¿Eliminar el mensaje <strong>{confirmDelete.nombre}</strong>?</p>
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
