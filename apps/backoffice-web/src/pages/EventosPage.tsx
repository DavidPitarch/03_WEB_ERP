import { useState } from 'react';
import { Zap, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  useEventos,
  useCreateEvento,
  useUpdateEvento,
  useDeleteEvento,
  type ReglaAutomatizacion,
} from '@/hooks/useEventos';

const TRIGGER_TIPOS = [
  { value: 'creacion',           label: 'Al crear expediente' },
  { value: 'cierre',             label: 'Al cerrar expediente' },
  { value: 'asignacion',         label: 'Al asignar operario' },
  { value: 'campo_cambia',       label: 'Cuando un campo cambia' },
  { value: 'tiempo_transcurrido', label: 'Tiempo transcurrido' },
];

const ACCION_TIPOS = [
  { value: 'notificacion', label: 'Notificación interna' },
  { value: 'enviar_email', label: 'Enviar email' },
  { value: 'enviar_sms',   label: 'Enviar SMS' },
  { value: 'crear_tarea',  label: 'Crear tarea' },
  { value: 'webhook',      label: 'Llamar webhook' },
];

function triggerLabel(tipo: string) {
  return TRIGGER_TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

function accionLabel(tipo: string) {
  return ACCION_TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

function triggerBadgeClass(tipo: string) {
  if (tipo === 'creacion' || tipo === 'cierre') return 'badge-info';
  if (tipo === 'asignacion') return 'badge-warning';
  return 'badge-default';
}

function accionBadgeClass(tipo: string) {
  if (tipo === 'enviar_sms' || tipo === 'enviar_email') return 'badge-success';
  if (tipo === 'webhook') return 'badge-warning';
  return 'badge-default';
}

const EMPTY_FORM = {
  nombre: '', descripcion: '',
  trigger_tipo: 'creacion' as ReglaAutomatizacion['trigger_tipo'],
  accion_tipo: 'notificacion' as ReglaAutomatizacion['accion_tipo'],
  activa: true, orden: 0,
};

type Filtro = 'todas' | 'activas' | 'inactivas';

export function EventosPage() {
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const activaParam = filtro === 'todas' ? undefined : filtro === 'activas';

  const { data: reglas = [], isLoading } = useEventos({ activa: activaParam });
  const crear     = useCreateEvento();
  const actualizar = useUpdateEvento();
  const eliminar  = useDeleteEvento();

  const [editing, setEditing]               = useState<ReglaAutomatizacion | null>(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [showForm, setShowForm]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState<ReglaAutomatizacion | null>(null);
  const [formError, setFormError]           = useState('');

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(r: ReglaAutomatizacion) {
    setEditing(r);
    setForm({
      nombre:       r.nombre,
      descripcion:  r.descripcion ?? '',
      trigger_tipo: r.trigger_tipo,
      accion_tipo:  r.accion_tipo,
      activa:       r.activa,
      orden:        r.orden,
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      const payload = {
        nombre:       form.nombre.trim(),
        descripcion:  form.descripcion.trim() || undefined,
        trigger_tipo: form.trigger_tipo,
        trigger_config: {},
        accion_tipo:  form.accion_tipo,
        accion_config: {},
        activa:       form.activa,
        orden:        form.orden,
      };
      if (editing) {
        await actualizar.mutateAsync({ id: editing.id, ...payload });
      } else {
        await crear.mutateAsync(payload);
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.data?.error?.message ?? err?.message ?? 'Error al guardar');
    }
  }

  async function handleToggle(r: ReglaAutomatizacion) {
    await actualizar.mutateAsync({ id: r.id, activa: !r.activa });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await eliminar.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <div className="page-stub">
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} />
            Eventos y Automatización
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Reglas automáticas que se disparan ante eventos del sistema
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nueva regla
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {(['activas', 'inactivas', 'todas'] as Filtro[]).map((f) => (
          <button
            key={f}
            className={`btn ${filtro === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltro(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {reglas.length} regla{reglas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="loading">Cargando reglas...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Trigger</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reglas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                    No hay reglas de automatización
                  </td>
                </tr>
              )}
              {reglas.map((r) => (
                <tr key={r.id} style={{ opacity: r.activa ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                    {r.descripcion ?? '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${triggerBadgeClass(r.trigger_tipo)}`}>
                      {triggerLabel(r.trigger_tipo)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${accionBadgeClass(r.accion_tipo)}`}>
                      {accionLabel(r.accion_tipo)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.activa ? 'var(--color-success)' : 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                      onClick={() => handleToggle(r)}
                      title={r.activa ? 'Desactivar' : 'Activar'}
                    >
                      {r.activa
                        ? <ToggleRight size={22} />
                        : <ToggleLeft size={22} />
                      }
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(r)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(r)} title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Crear / Editar ── */}
      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar regla' : 'Nueva regla de automatización'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-group-v2">
                  <label className="form-label required">Nombre</label>
                  <input
                    className="form-control"
                    value={form.nombre}
                    autoFocus
                    required
                    placeholder="Ej. Notificar al cerrar expediente"
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>

                <div className="form-group-v2">
                  <label className="form-label">Descripción</label>
                  <input
                    className="form-control"
                    value={form.descripcion}
                    placeholder="Descripción opcional"
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                    Condición (Trigger)
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label required">Cuando...</label>
                    <select
                      className="form-control"
                      value={form.trigger_tipo}
                      onChange={(e) => setForm((p) => ({ ...p, trigger_tipo: e.target.value as ReglaAutomatizacion['trigger_tipo'] }))}
                      required
                    >
                      {TRIGGER_TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                    Acción a ejecutar
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label required">Entonces...</label>
                    <select
                      className="form-control"
                      value={form.accion_tipo}
                      onChange={(e) => setForm((p) => ({ ...p, accion_tipo: e.target.value as ReglaAutomatizacion['accion_tipo'] }))}
                      required
                    >
                      {ACCION_TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Orden</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      value={form.orden}
                      onChange={(e) => setForm((p) => ({ ...p, orden: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="form-group-v2" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.activa}
                        onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
                      />
                      Regla activa
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear regla')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación ── */}
      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar regla</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar la regla <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.nombre}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={eliminar.isPending}>
                {eliminar.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
