import { useState } from 'react';
import { Receipt, Plus, Pencil, Trash2, Search } from 'lucide-react';
import {
  useLineasFacturacion,
  useCreateLineaFacturacion,
  useUpdateLineaFacturacion,
  useDeleteLineaFacturacion,
  type LineaFacturacion,
} from '@/hooks/useLineasFacturacion';

const TIPOS_IVA = [
  { value: 'general',       label: 'General (21%)',        pct: 21 },
  { value: 'reducido',      label: 'Reducido (10%)',       pct: 10 },
  { value: 'superreducido', label: 'Superreducido (4%)',   pct: 4  },
  { value: 'exento',        label: 'Exento (0%)',          pct: 0  },
];

type Filtro = 'todas' | 'activas' | 'inactivas';

const EMPTY_FORM = {
  descripcion: '', codigo: '', unidad: 'ud', precio: 0,
  tipo_iva: 'general', porcentaje_iva: 21, activa: true, orden: 0,
};

function ivaBadgeClass(tipo: string) {
  if (tipo === 'general')       return 'badge-default';
  if (tipo === 'reducido')      return 'badge-info';
  if (tipo === 'superreducido') return 'badge-warning';
  return 'badge';
}

export function LineasFacturacionPage() {
  const [filtro, setFiltro]   = useState<Filtro>('activas');
  const [search, setSearch]   = useState('');
  const [tipoIva, setTipoIva] = useState('');

  const activaParam = filtro === 'todas' ? undefined : filtro === 'activas';

  const { data: res, isLoading } = useLineasFacturacion({
    activa: activaParam,
    search: search || undefined,
    tipo_iva: tipoIva || undefined,
  });
  const crear     = useCreateLineaFacturacion();
  const actualizar = useUpdateLineaFacturacion();
  const eliminar  = useDeleteLineaFacturacion();

  const [editing, setEditing]           = useState<LineaFacturacion | null>(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [showForm, setShowForm]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LineaFacturacion | null>(null);
  const [formError, setFormError]       = useState('');

  const lineas: LineaFacturacion[] = res ?? [];

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(l: LineaFacturacion) {
    setEditing(l);
    setForm({
      descripcion:    l.descripcion,
      codigo:         l.codigo ?? '',
      unidad:         l.unidad,
      precio:         l.precio,
      tipo_iva:       l.tipo_iva,
      porcentaje_iva: l.porcentaje_iva,
      activa:         l.activa,
      orden:          l.orden,
    });
    setFormError('');
    setShowForm(true);
  }

  function handleTipoIvaChange(tipo: string) {
    const found = TIPOS_IVA.find((t) => t.value === tipo);
    setForm((p) => ({ ...p, tipo_iva: tipo, porcentaje_iva: found?.pct ?? p.porcentaje_iva }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      const payload = {
        descripcion:    form.descripcion.trim(),
        codigo:         form.codigo.trim() || undefined,
        unidad:         form.unidad.trim() || 'ud',
        precio:         form.precio,
        tipo_iva:       form.tipo_iva,
        porcentaje_iva: form.porcentaje_iva,
        activa:         form.activa,
        orden:          form.orden,
      };
      if (editing) {
        await actualizar.mutateAsync({ id: editing.id, ...payload });
      } else {
        await crear.mutateAsync(payload);
      }
      setShowForm(false);
    } catch (err: any) {
      const msg = err?.data?.error?.message ?? err?.message ?? 'Error al guardar';
      setFormError(msg.includes('23505') || msg.includes('DUPLICATE')
        ? 'Ya existe una línea con ese código'
        : msg);
    }
  }

  async function handleToggle(l: LineaFacturacion) {
    await actualizar.mutateAsync({ id: l.id, activa: !l.activa });
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
            <Receipt size={20} />
            Líneas de Facturación
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Catálogo de conceptos reutilizables en presupuestos y facturas
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nueva línea
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

        <div style={{ position: 'relative', marginLeft: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            className="form-control"
            placeholder="Buscar descripción o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 28, width: 220 }}
          />
        </div>

        <select
          className="form-control"
          value={tipoIva}
          onChange={(e) => setTipoIva(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todos los tipos IVA</option>
          {TIPOS_IVA.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', fontSize: 13, alignSelf: 'center' }}>
          {lineas.length} línea{lineas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="loading">Cargando líneas...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'center' }}>IVA</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                    No hay líneas de facturación
                  </td>
                </tr>
              )}
              {lineas.map((l) => (
                <tr key={l.id} style={{ opacity: l.activa ? 1 : 0.55 }}>
                  <td>
                    {l.codigo
                      ? <code style={{ fontSize: 12, background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{l.codigo}</code>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontWeight: 600 }}>{l.descripcion}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{l.unidad}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {l.precio === 0
                      ? <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      : `${Number(l.precio).toFixed(2)} €`
                    }
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${ivaBadgeClass(l.tipo_iva)}`}>
                      {l.porcentaje_iva}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`badge ${l.activa ? 'badge-success' : 'badge-default'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => handleToggle(l)}
                      title={l.activa ? 'Desactivar' : 'Activar'}
                    >
                      {l.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(l)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setConfirmDelete(l)} title="Eliminar">
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
              <div className="modal-v2__title">{editing ? 'Editar línea' : 'Nueva línea de facturación'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-group-v2">
                  <label className="form-label required">Descripción</label>
                  <input
                    className="form-control"
                    value={form.descripcion}
                    autoFocus
                    required
                    placeholder="Ej. Mano de obra"
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                  />
                </div>

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Código</label>
                    <input
                      className="form-control"
                      value={form.codigo}
                      placeholder="Ej. MANO_OBR"
                      style={{ fontFamily: 'monospace' }}
                      onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Unidad</label>
                    <input
                      className="form-control"
                      value={form.unidad}
                      placeholder="ud, h, km..."
                      onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Precio unitario (€)</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.precio}
                      onChange={(e) => setForm((p) => ({ ...p, precio: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
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
                </div>

                <div className="form-grid-v2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group-v2">
                    <label className="form-label">Tipo IVA</label>
                    <select
                      className="form-control"
                      value={form.tipo_iva}
                      onChange={(e) => handleTipoIvaChange(e.target.value)}
                    >
                      {TIPOS_IVA.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">% IVA</label>
                    <input
                      className="form-control"
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={form.porcentaje_iva}
                      onChange={(e) => setForm((p) => ({ ...p, porcentaje_iva: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="form-group-v2">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.activa}
                      onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
                    />
                    Línea activa
                  </label>
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear línea')}
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
              <div className="modal-v2__title">Eliminar línea</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar la línea <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.descripcion}</strong>?
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
