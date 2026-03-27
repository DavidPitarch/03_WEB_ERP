import { useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useEncuestas,
  useCreateEncuesta,
  useUpdateEncuesta,
  useDeleteEncuesta,
  type Encuesta,
  type PreguntaEncuesta,
} from '@/hooks/useEncuestas';

const TIPOS_ENCUESTA = [
  { value: 'satisfaccion', label: 'Satisfacción' },
  { value: 'nps',          label: 'NPS' },
  { value: 'personalizada', label: 'Personalizada' },
];

const TIPOS_PREGUNTA = [
  { value: 'escala',          label: 'Escala (1-5)' },
  { value: 'nps',             label: 'NPS (0-10)' },
  { value: 'texto',           label: 'Texto libre' },
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'si_no',           label: 'Sí / No' },
];

function tipoBadge(tipo: string) {
  if (tipo === 'nps')          return 'badge-info';
  if (tipo === 'satisfaccion') return 'badge-success';
  return 'badge-default';
}

type EmptyPregunta = { texto: string; tipo: string; obligatoria: boolean };

const EMPTY_PREGUNTA: EmptyPregunta = { texto: '', tipo: 'escala', obligatoria: true };

const EMPTY_FORM = {
  titulo: '', descripcion: '', tipo: 'satisfaccion',
  activa: true, envio_auto: false, dias_espera: 0,
};

type Filtro = 'todas' | 'activas' | 'inactivas';

export function EncuestasPage() {
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const activaParam = filtro === 'todas' ? undefined : filtro === 'activas';

  const { data: encuestas = [], isLoading } = useEncuestas({ activa: activaParam });
  const crear     = useCreateEncuesta();
  const actualizar = useUpdateEncuesta();
  const eliminar  = useDeleteEncuesta();

  const [editing, setEditing]               = useState<Encuesta | null>(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [preguntas, setPreguntas]           = useState<EmptyPregunta[]>([]);
  const [showForm, setShowForm]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState<Encuesta | null>(null);
  const [formError, setFormError]           = useState('');
  const [expandedId, setExpandedId]         = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreguntas([{ ...EMPTY_PREGUNTA }]);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(e: Encuesta) {
    setEditing(e);
    setForm({
      titulo:      e.titulo,
      descripcion: e.descripcion ?? '',
      tipo:        e.tipo,
      activa:      e.activa,
      envio_auto:  e.envio_auto,
      dias_espera: e.dias_espera,
    });
    setPreguntas([]);
    setFormError('');
    setShowForm(true);
  }

  function addPregunta() {
    setPreguntas((p) => [...p, { ...EMPTY_PREGUNTA }]);
  }

  function removePregunta(idx: number) {
    setPreguntas((p) => p.filter((_, i) => i !== idx));
  }

  function updatePregunta(idx: number, field: keyof EmptyPregunta, value: string | boolean) {
    setPreguntas((p) => p.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      const payload = {
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        tipo:        form.tipo,
        activa:      form.activa,
        envio_auto:  form.envio_auto,
        dias_espera: form.dias_espera,
        ...(!editing && preguntas.length > 0 ? {
          preguntas: preguntas
            .filter((p) => p.texto.trim())
            .map((p, idx) => ({ texto: p.texto.trim(), tipo: p.tipo, obligatoria: p.obligatoria, orden: idx })),
        } : {}),
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

  async function handleToggle(e: Encuesta) {
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
            <ClipboardList size={20} />
            Encuestas
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Gestión de encuestas de satisfacción y NPS
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nueva encuesta
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
          {encuestas.length} encuesta{encuestas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Lista de encuestas ── */}
      {isLoading ? (
        <div className="loading">Cargando encuestas...</div>
      ) : encuestas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-tertiary)' }}>
          No hay encuestas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {encuestas.map((e) => (
            <div
              key={e.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                overflow: 'hidden',
                opacity: e.activa ? 1 : 0.6,
              }}
            >
              {/* Card header */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-surface)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.titulo}
                    <span className={`badge ${tipoBadge(e.tipo)}`}>
                      {TIPOS_ENCUESTA.find((t) => t.value === e.tipo)?.label ?? e.tipo}
                    </span>
                    {e.envio_auto && (
                      <span className="badge badge-warning" title={`Envío automático a los ${e.dias_espera} días`}>
                        Auto
                      </span>
                    )}
                  </div>
                  {e.descripcion && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {e.descripcion}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {e.preguntas !== undefined && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MessageSquare size={12} />
                      {(e.preguntas as PreguntaEncuesta[]).length} preg.
                    </span>
                  )}

                  <button
                    className={`badge ${e.activa ? 'badge-success' : 'badge-default'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => handleToggle(e)}
                    title={e.activa ? 'Desactivar' : 'Activar'}
                  >
                    {e.activa ? 'Activa' : 'Inactiva'}
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px' }}
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    title="Ver preguntas"
                  >
                    {expandedId === e.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(e)} title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(e)} title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expandable preguntas list */}
              {expandedId === e.id && (
                <div style={{ padding: '12px 16px', background: 'var(--color-bg-subtle)', borderTop: '1px solid var(--color-border)' }}>
                  {!e.preguntas || (e.preguntas as PreguntaEncuesta[]).length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Sin preguntas configuradas</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(e.preguntas as PreguntaEncuesta[])
                        .sort((a, b) => a.orden - b.orden)
                        .map((p, idx) => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <span style={{ color: 'var(--color-text-tertiary)', minWidth: 20 }}>{idx + 1}.</span>
                            <span style={{ flex: 1 }}>{p.texto}</span>
                            <span className="badge badge-default">
                              {TIPOS_PREGUNTA.find((t) => t.value === p.tipo)?.label ?? p.tipo}
                            </span>
                            {p.obligatoria && <span className="badge badge-warning">Obligatoria</span>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Crear / Editar ── */}
      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar encuesta' : 'Nueva encuesta'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-v2__body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-group-v2">
                  <label className="form-label required">Título</label>
                  <input
                    className="form-control"
                    value={form.titulo}
                    autoFocus
                    required
                    placeholder="Ej. Encuesta de satisfacción post-servicio"
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
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

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-control"
                      value={form.tipo}
                      onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                    >
                      {TIPOS_ENCUESTA.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Días de espera (envío auto)</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      value={form.dias_espera}
                      disabled={!form.envio_auto}
                      onChange={(e) => setForm((p) => ({ ...p, dias_espera: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.activa}
                      onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
                    />
                    Encuesta activa
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.envio_auto}
                      onChange={(e) => setForm((p) => ({ ...p, envio_auto: e.target.checked }))}
                    />
                    Envío automático
                  </label>
                </div>

                {/* Preguntas — solo en creación */}
                {!editing && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Preguntas iniciales
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={addPregunta}>
                        + Añadir pregunta
                      </button>
                    </div>
                    {preguntas.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13, paddingTop: 8, minWidth: 20 }}>{idx + 1}.</span>
                        <input
                          className="form-control"
                          style={{ flex: 1 }}
                          value={p.texto}
                          placeholder="Texto de la pregunta"
                          onChange={(e) => updatePregunta(idx, 'texto', e.target.value)}
                        />
                        <select
                          className="form-control"
                          style={{ width: 160 }}
                          value={p.tipo}
                          onChange={(e) => updatePregunta(idx, 'tipo', e.target.value)}
                        >
                          {TIPOS_PREGUNTA.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, paddingTop: 8, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={p.obligatoria}
                            onChange={(e) => updatePregunta(idx, 'obligatoria', e.target.checked)}
                          />
                          Obl.
                        </label>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', flexShrink: 0 }}
                          onClick={() => removePregunta(idx)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editing && (
                  <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 6, padding: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Para gestionar las preguntas de esta encuesta, usa la vista de detalle.
                  </div>
                )}
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear encuesta')}
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
              <div className="modal-v2__title">Eliminar encuesta</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar la encuesta <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.titulo}</strong> y todas sus preguntas?
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
