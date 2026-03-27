import { useState } from 'react';
import { FolderArchive, Plus, Pencil, Trash2, FileText, Tag } from 'lucide-react';
import {
  usePlantillasDocumento,
  useCreatePlantillaDocumento,
  useUpdatePlantillaDocumento,
  useDeletePlantillaDocumento,
  type PlantillaDocumento,
} from '@/hooks/usePlantillasDocumento';

const SECCIONES = [
  'Expedientes', 'Presupuestos', 'Facturas', 'Partes de trabajo',
  'Contratos', 'Comunicaciones', 'Legal', 'Otros',
];

type Filtro = 'todas' | 'activas' | 'inactivas';

const EMPTY_FORM = {
  nombre: '', seccion: '', fichero_url: '',
  palabras_clave: [] as string[],
  requiere_firma_operario: false, requiere_firma_asegurado: false,
  activa: true,
};

export function GestionDocumentosPage() {
  const [filtro, setFiltro]     = useState<Filtro>('activas');
  const [seccionFilter, setSeccionFilter] = useState('');
  const activaParam = filtro === 'todas' ? undefined : filtro === 'activas';

  const { data: plantillas = [], isLoading } = usePlantillasDocumento({
    activa: activaParam,
    seccion: seccionFilter || undefined,
  });
  const crear     = useCreatePlantillaDocumento();
  const actualizar = useUpdatePlantillaDocumento();
  const eliminar  = useDeletePlantillaDocumento();

  const [editing, setEditing]               = useState<PlantillaDocumento | null>(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [keywordInput, setKeywordInput]     = useState('');
  const [showForm, setShowForm]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState<PlantillaDocumento | null>(null);
  const [formError, setFormError]           = useState('');

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setKeywordInput('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(p: PlantillaDocumento) {
    setEditing(p);
    setForm({
      nombre:                   p.nombre,
      seccion:                  p.seccion ?? '',
      fichero_url:              p.fichero_url ?? '',
      palabras_clave:           [...p.palabras_clave],
      requiere_firma_operario:  p.requiere_firma_operario,
      requiere_firma_asegurado: p.requiere_firma_asegurado,
      activa:                   p.activa,
    });
    setKeywordInput('');
    setFormError('');
    setShowForm(true);
  }

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !form.palabras_clave.includes(kw)) {
      setForm((p) => ({ ...p, palabras_clave: [...p.palabras_clave, kw] }));
    }
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    setForm((p) => ({ ...p, palabras_clave: p.palabras_clave.filter((k) => k !== kw) }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      const payload = {
        nombre:                   form.nombre.trim(),
        seccion:                  form.seccion.trim() || undefined,
        fichero_url:              form.fichero_url.trim() || undefined,
        palabras_clave:           form.palabras_clave,
        requiere_firma_operario:  form.requiere_firma_operario,
        requiere_firma_asegurado: form.requiere_firma_asegurado,
        activa:                   form.activa,
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

  async function handleToggle(p: PlantillaDocumento) {
    await actualizar.mutateAsync({ id: p.id, activa: !p.activa });
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
            <FolderArchive size={20} />
            Gestión de Documentos
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Plantillas de documentos para expedientes, presupuestos y comunicaciones
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nueva plantilla
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['activas', 'inactivas', 'todas'] as Filtro[]).map((f) => (
          <button
            key={f}
            className={`btn ${filtro === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltro(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <select
          className="form-control"
          value={seccionFilter}
          onChange={(e) => setSeccionFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todas las secciones</option>
          {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="loading">Cargando plantillas...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Sección</th>
                <th>Palabras clave</th>
                <th style={{ textAlign: 'center' }}>Firma Op.</th>
                <th style={{ textAlign: 'center' }}>Firma As.</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillas.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                    No hay plantillas
                  </td>
                </tr>
              )}
              {plantillas.map((p) => (
                <tr key={p.id} style={{ opacity: p.activa ? 1 : 0.55 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                    </div>
                    {p.fichero_url && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, paddingLeft: 22 }}>
                        {p.fichero_url.split('/').pop()}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>
                    {p.seccion ?? <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.palabras_clave.length === 0
                        ? <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>
                        : p.palabras_clave.slice(0, 3).map((kw) => (
                          <span key={kw} className="badge badge-default" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                            <Tag size={9} /> {kw}
                          </span>
                        ))
                      }
                      {p.palabras_clave.length > 3 && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>+{p.palabras_clave.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${p.requiere_firma_operario ? 'badge-warning' : 'badge-default'}`}>
                      {p.requiere_firma_operario ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${p.requiere_firma_asegurado ? 'badge-warning' : 'badge-default'}`}>
                      {p.requiere_firma_asegurado ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${p.activa ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(p)}
                      title={p.activa ? 'Desactivar' : 'Activar'}
                    >
                      {p.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(p)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(p)} title="Eliminar">
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
              <div className="modal-v2__title">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</div>
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
                    placeholder="Ej. Acta de visita"
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Sección</label>
                    <select
                      className="form-control"
                      value={form.seccion}
                      onChange={(e) => setForm((p) => ({ ...p, seccion: e.target.value }))}
                    >
                      <option value="">— Sin sección —</option>
                      {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">URL del fichero</label>
                    <input
                      className="form-control"
                      value={form.fichero_url}
                      placeholder="https://... (opcional)"
                      onChange={(e) => setForm((p) => ({ ...p, fichero_url: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group-v2">
                  <label className="form-label">Palabras clave</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="form-control"
                      value={keywordInput}
                      placeholder="Añadir palabra clave..."
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    />
                    <button type="button" className="btn btn-secondary" onClick={addKeyword}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {form.palabras_clave.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {form.palabras_clave.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          className="badge badge-default"
                          style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => removeKeyword(kw)}
                          title="Eliminar"
                        >
                          {kw} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.requiere_firma_operario}
                      onChange={(e) => setForm((p) => ({ ...p, requiere_firma_operario: e.target.checked }))}
                    />
                    Requiere firma del operario
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.requiere_firma_asegurado}
                      onChange={(e) => setForm((p) => ({ ...p, requiere_firma_asegurado: e.target.checked }))}
                    />
                    Requiere firma del asegurado
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.activa}
                      onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
                    />
                    Plantilla activa
                  </label>
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear plantilla')}
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
              <div className="modal-v2__title">Eliminar plantilla</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar la plantilla <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.nombre}</strong>?
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
