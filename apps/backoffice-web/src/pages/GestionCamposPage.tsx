import { useState } from 'react';
import { LayoutTemplate, Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import {
  useGruposCampos,
  useCreateGrupoCampos,
  useUpdateGrupoCampos,
  useDeleteGrupoCampos,
  useCreateCampo,
  useUpdateCampo,
  useDeleteCampo,
  type GrupoCampos,
  type CampoPersonalizado,
} from '@/hooks/useGruposCampos';

const TIPOS_CAMPO = [
  { value: 'text',      label: 'Texto corto' },
  { value: 'textarea',  label: 'Texto largo' },
  { value: 'number',    label: 'Número' },
  { value: 'date',      label: 'Fecha' },
  { value: 'select',    label: 'Selección' },
  { value: 'checkbox',  label: 'Casilla' },
];

const ENTIDADES = [
  { value: 'expediente', label: 'Expediente' },
  { value: 'parte',      label: 'Parte de trabajo' },
  { value: 'cliente',    label: 'Cliente' },
  { value: 'operario',   label: 'Operario' },
];

function tipoBadgeClass(tipo: string) {
  if (tipo === 'select')   return 'badge-info';
  if (tipo === 'checkbox') return 'badge-warning';
  if (tipo === 'number' || tipo === 'date') return 'badge-default';
  return 'badge-default';
}

const EMPTY_GRUPO = { nombre: '', entidad: 'expediente', orden: 0 };
const EMPTY_CAMPO = { nombre: '', tipo: 'text', opciones: [] as string[], obligatorio: false, orden: 0 };

export function GestionCamposPage() {
  const [entidadFilter, setEntidadFilter] = useState('');

  const { data: grupos = [], isLoading } = useGruposCampos({
    entidad: entidadFilter || undefined,
  });

  const crearGrupo   = useCreateGrupoCampos();
  const editarGrupo  = useUpdateGrupoCampos();
  const borrarGrupo  = useDeleteGrupoCampos();

  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [editingGrupo, setEditingGrupo]       = useState<GrupoCampos | null>(null);
  const [grupoForm, setGrupoForm]             = useState(EMPTY_GRUPO);
  const [showGrupoModal, setShowGrupoModal]   = useState(false);
  const [confirmDeleteGrupo, setConfirmDeleteGrupo] = useState<GrupoCampos | null>(null);
  const [grupoError, setGrupoError]           = useState('');

  // Campo state
  const [editingCampo, setEditingCampo]       = useState<CampoPersonalizado | null>(null);
  const [activoGrupoId, setActivoGrupoId]     = useState<string | null>(null);
  const [campoForm, setCampoForm]             = useState(EMPTY_CAMPO);
  const [opcionInput, setOpcionInput]         = useState('');
  const [showCampoModal, setShowCampoModal]   = useState(false);
  const [confirmDeleteCampo, setConfirmDeleteCampo] = useState<{ campo: CampoPersonalizado; grupoId: string } | null>(null);
  const [campoError, setCampoError]           = useState('');

  const crearCampo  = useCreateCampo(activoGrupoId ?? '');
  const editarCampo = useUpdateCampo(activoGrupoId ?? '');
  const borrarCampo = useDeleteCampo(activoGrupoId ?? '');

  // ── Grupo handlers ──────────────────────────────────────────────────────────

  function openNewGrupo() {
    setEditingGrupo(null);
    setGrupoForm(EMPTY_GRUPO);
    setGrupoError('');
    setShowGrupoModal(true);
  }

  function openEditGrupo(g: GrupoCampos) {
    setEditingGrupo(g);
    setGrupoForm({ nombre: g.nombre, entidad: g.entidad, orden: g.orden });
    setGrupoError('');
    setShowGrupoModal(true);
  }

  async function handleGrupoSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setGrupoError('');
    try {
      if (editingGrupo) {
        await editarGrupo.mutateAsync({ id: editingGrupo.id, ...grupoForm });
      } else {
        await crearGrupo.mutateAsync(grupoForm);
      }
      setShowGrupoModal(false);
    } catch (err: any) {
      setGrupoError(err?.data?.error?.message ?? err?.message ?? 'Error al guardar');
    }
  }

  async function handleDeleteGrupo() {
    if (!confirmDeleteGrupo) return;
    await borrarGrupo.mutateAsync(confirmDeleteGrupo.id);
    setConfirmDeleteGrupo(null);
  }

  // ── Campo handlers ──────────────────────────────────────────────────────────

  function openNewCampo(grupoId: string) {
    setActivoGrupoId(grupoId);
    setEditingCampo(null);
    setCampoForm(EMPTY_CAMPO);
    setOpcionInput('');
    setCampoError('');
    setShowCampoModal(true);
  }

  function openEditCampo(campo: CampoPersonalizado, grupoId: string) {
    setActivoGrupoId(grupoId);
    setEditingCampo(campo);
    setCampoForm({
      nombre:     campo.nombre,
      tipo:       campo.tipo,
      opciones:   [...campo.opciones],
      obligatorio: campo.obligatorio,
      orden:      campo.orden,
    });
    setOpcionInput('');
    setCampoError('');
    setShowCampoModal(true);
  }

  function addOpcion() {
    const op = opcionInput.trim();
    if (op && !campoForm.opciones.includes(op)) {
      setCampoForm((p) => ({ ...p, opciones: [...p.opciones, op] }));
    }
    setOpcionInput('');
  }

  function removeOpcion(op: string) {
    setCampoForm((p) => ({ ...p, opciones: p.opciones.filter((o) => o !== op) }));
  }

  async function handleCampoSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setCampoError('');
    try {
      const payload = { ...campoForm };
      if (editingCampo) {
        await editarCampo.mutateAsync({ id: editingCampo.id, ...payload });
      } else {
        await crearCampo.mutateAsync(payload);
      }
      setShowCampoModal(false);
    } catch (err: any) {
      setCampoError(err?.data?.error?.message ?? err?.message ?? 'Error al guardar');
    }
  }

  async function handleDeleteCampo() {
    if (!confirmDeleteCampo) return;
    setActivoGrupoId(confirmDeleteCampo.grupoId);
    await borrarCampo.mutateAsync(confirmDeleteCampo.campo.id);
    setConfirmDeleteCampo(null);
  }

  const isGrupoPending = crearGrupo.isPending || editarGrupo.isPending;
  const isCampoPending = crearCampo.isPending || editarCampo.isPending;

  return (
    <div className="page-stub">
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutTemplate size={20} />
            Gestión de Campos
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Grupos y campos personalizados por entidad
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewGrupo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nuevo grupo
        </button>
      </div>

      {/* ── Filtro entidad ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select
          className="form-control"
          value={entidadFilter}
          onChange={(e) => setEntidadFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todas las entidades</option>
          {ENTIDADES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Lista de grupos ── */}
      {isLoading ? (
        <div className="loading">Cargando campos...</div>
      ) : grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-tertiary)' }}>
          No hay grupos de campos
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grupos.map((g) => {
            const campos = (g.campos ?? []).slice().sort((a, b) => a.orden - b.orden);
            const isOpen = expandedId === g.id;
            return (
              <div key={g.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Grupo header */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-surface)' }}>
                  <GripVertical size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {g.nombre}
                      <span className="badge badge-default" style={{ fontSize: 11 }}>
                        {ENTIDADES.find((e) => e.value === g.entidad)?.label ?? g.entidad}
                      </span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                        {campos.length} campo{campos.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => openNewCampo(g.id)}
                      title="Añadir campo"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px' }}
                      onClick={() => setExpandedId(isOpen ? null : g.id)}
                      title={isOpen ? 'Colapsar' : 'Expandir'}
                    >
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEditGrupo(g)} title="Editar grupo">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDeleteGrupo(g)} title="Eliminar grupo">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Campos list */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-subtle)' }}>
                    {campos.length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                        Sin campos. Usa el botón + para añadir.
                      </div>
                    ) : (
                      <table className="data-table" style={{ margin: 0, border: 'none' }}>
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: 32 }}>Nombre</th>
                            <th style={{ textAlign: 'center' }}>Tipo</th>
                            <th style={{ textAlign: 'center' }}>Obligatorio</th>
                            <th style={{ textAlign: 'center' }}>Opciones</th>
                            <th style={{ textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campos.map((campo) => (
                            <tr key={campo.id}>
                              <td style={{ paddingLeft: 32, fontWeight: 500 }}>{campo.nombre}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${tipoBadgeClass(campo.tipo)}`}>
                                  {TIPOS_CAMPO.find((t) => t.value === campo.tipo)?.label ?? campo.tipo}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${campo.obligatorio ? 'badge-warning' : 'badge-default'}`}>
                                  {campo.obligatorio ? 'Sí' : 'No'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                                {campo.tipo === 'select' && campo.opciones.length > 0
                                  ? campo.opciones.slice(0, 2).join(', ') + (campo.opciones.length > 2 ? `... (+${campo.opciones.length - 2})` : '')
                                  : '—'
                                }
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEditCampo(campo, g.id)} title="Editar">
                                    <Pencil size={12} />
                                  </button>
                                  <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDeleteCampo({ campo, grupoId: g.id })} title="Eliminar">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Crear/Editar Grupo ── */}
      {showGrupoModal && (
        <div className="modal-overlay-v2" onClick={() => setShowGrupoModal(false)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editingGrupo ? 'Editar grupo' : 'Nuevo grupo de campos'}</div>
              <button className="modal-v2__close" onClick={() => setShowGrupoModal(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleGrupoSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {grupoError && <div className="alert alert-error">{grupoError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Nombre del grupo</label>
                  <input
                    className="form-control"
                    value={grupoForm.nombre}
                    autoFocus
                    required
                    placeholder="Ej. Datos técnicos"
                    onChange={(e) => setGrupoForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Entidad</label>
                    <select
                      className="form-control"
                      value={grupoForm.entidad}
                      onChange={(e) => setGrupoForm((p) => ({ ...p, entidad: e.target.value }))}
                    >
                      {ENTIDADES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Orden</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      value={grupoForm.orden}
                      onChange={(e) => setGrupoForm((p) => ({ ...p, orden: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGrupoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isGrupoPending}>
                  {isGrupoPending ? 'Guardando...' : (editingGrupo ? 'Guardar' : 'Crear grupo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Crear/Editar Campo ── */}
      {showCampoModal && (
        <div className="modal-overlay-v2" onClick={() => setShowCampoModal(false)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editingCampo ? 'Editar campo' : 'Nuevo campo'}</div>
              <button className="modal-v2__close" onClick={() => setShowCampoModal(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleCampoSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {campoError && <div className="alert alert-error">{campoError}</div>}
                <div className="form-group-v2">
                  <label className="form-label required">Nombre del campo</label>
                  <input
                    className="form-control"
                    value={campoForm.nombre}
                    autoFocus
                    required
                    placeholder="Ej. Número de expediente interno"
                    onChange={(e) => setCampoForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-control"
                      value={campoForm.tipo}
                      onChange={(e) => setCampoForm((p) => ({ ...p, tipo: e.target.value }))}
                    >
                      {TIPOS_CAMPO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Orden</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      value={campoForm.orden}
                      onChange={(e) => setCampoForm((p) => ({ ...p, orden: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {campoForm.tipo === 'select' && (
                  <div className="form-group-v2">
                    <label className="form-label">Opciones</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-control"
                        value={opcionInput}
                        placeholder="Nueva opción..."
                        onChange={(e) => setOpcionInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpcion(); } }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={addOpcion}>
                        <Plus size={14} />
                      </button>
                    </div>
                    {campoForm.opciones.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {campoForm.opciones.map((op) => (
                          <button
                            key={op}
                            type="button"
                            className="badge badge-default"
                            style={{ cursor: 'pointer', border: 'none' }}
                            onClick={() => removeOpcion(op)}
                            title="Eliminar opción"
                          >
                            {op} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={campoForm.obligatorio}
                    onChange={(e) => setCampoForm((p) => ({ ...p, obligatorio: e.target.checked }))}
                  />
                  Campo obligatorio
                </label>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCampoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isCampoPending}>
                  {isCampoPending ? 'Guardando...' : (editingCampo ? 'Guardar' : 'Añadir campo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación grupo ── */}
      {confirmDeleteGrupo && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDeleteGrupo(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar grupo</div>
              <button className="modal-v2__close" onClick={() => setConfirmDeleteGrupo(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar el grupo <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDeleteGrupo.nombre}</strong> y todos sus campos?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteGrupo(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteGrupo} disabled={borrarGrupo.isPending}>
                {borrarGrupo.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación campo ── */}
      {confirmDeleteCampo && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDeleteCampo(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Eliminar campo</div>
              <button className="modal-v2__close" onClick={() => setConfirmDeleteCampo(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar el campo <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDeleteCampo.campo.nombre}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteCampo(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteCampo} disabled={borrarCampo.isPending}>
                {borrarCampo.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
