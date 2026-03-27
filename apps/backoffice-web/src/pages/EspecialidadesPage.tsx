import { useState } from 'react';
import { Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useEspecialidades,
  useCreateEspecialidad,
  useUpdateEspecialidad,
  useDeleteEspecialidad,
  type Especialidad,
} from '@/hooks/useEspecialidades';

type Filtro = 'todas' | 'activas' | 'inactivas';

const FILTRO_LABELS: Record<Filtro, string> = {
  todas: 'Todas',
  activas: 'Activas',
  inactivas: 'Inactivas',
};

const EMPTY_FORM = { nombre: '', codigo: '', descripcion: '' };

export function EspecialidadesPage() {
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const activaParam = filtro === 'todas' ? undefined : filtro === 'activas';

  const { data: res, isLoading } = useEspecialidades(activaParam);
  const crear = useCreateEspecialidad();
  const actualizar = useUpdateEspecialidad();
  const eliminar = useDeleteEspecialidad();

  const [editing, setEditing] = useState<Especialidad | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Especialidad | null>(null);
  const [formError, setFormError] = useState('');

  const especialidades: Especialidad[] = res?.data ?? [];

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(e: Especialidad) {
    setEditing(e);
    setForm({ nombre: e.nombre, codigo: e.codigo ?? '', descripcion: e.descripcion ?? '' });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await actualizar.mutateAsync({ id: editing.id, nombre: form.nombre, codigo: form.codigo || undefined, descripcion: form.descripcion || undefined });
      } else {
        await crear.mutateAsync({ nombre: form.nombre, codigo: form.codigo || undefined, descripcion: form.descripcion || undefined });
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message ?? 'Error al guardar');
    }
  }

  async function handleToggle(e: Especialidad) {
    await actualizar.mutateAsync({ id: e.id, activa: !e.activa });
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
            <Wrench size={20} />
            Especialidades
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Catálogo de gremios y especialidades técnicas del sistema
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nueva especialidad
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['activas', 'inactivas', 'todas'] as Filtro[]).map((f) => (
          <button
            key={f}
            className={`btn ${filtro === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltro(f)}
          >
            {FILTRO_LABELS[f]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {especialidades.length} especialidad{especialidades.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="loading">Cargando especialidades...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {especialidades.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                    No hay especialidades
                  </td>
                </tr>
              )}
              {especialidades.map((e) => (
                <tr key={e.id} style={{ opacity: e.activa ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                  <td>
                    {e.codigo
                      ? <code style={{ fontSize: 12, background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{e.codigo}</code>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                    }
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{e.descripcion ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${e.activa ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(e)}
                      title={e.activa ? 'Desactivar' : 'Activar'}
                    >
                      {e.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(e)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(e)} title="Eliminar">
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
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar especialidad' : 'Nueva especialidad'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Nombre / Descripción</label>
                  <input
                    className="form-control"
                    value={form.nombre}
                    autoFocus
                    required
                    placeholder="Ej. Fontanería"
                    onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Código</label>
                  <input
                    className="form-control"
                    value={form.codigo}
                    placeholder="Ej. FONT (opcional, debe ser único)"
                    onChange={(e) => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Descripción</label>
                  <input
                    className="form-control"
                    value={form.descripcion}
                    placeholder="Descripción opcional"
                    onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear especialidad')}
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
              <div className="modal-v2__title">Eliminar especialidad</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar la especialidad <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.nombre}</strong>?
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
