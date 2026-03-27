import { useState } from 'react';
import { HardHat, Plus, Pencil, Search } from 'lucide-react';
import { useOperarios, useCreateOperario, useUpdateOperario, useCatalogos } from '@/hooks/useMasters';
import { useDocRequerida } from '@/hooks/useDocRequerida';

type ModalTab = 'datos' | 'doc' | 'servicios';

const TIPOS_SERVICIO = [
  'Fontanería', 'Electricidad', 'Carpintería', 'Cerrajería', 'Cristalería',
  'Pintura', 'Albañilería', 'Climatización', 'Jardinería', 'Limpieza',
  'Desbordamiento', 'Impermeabilización', 'Deshumectación', 'Caída de árbol', 'Otros',
];

const TIPO_ID = ['NIF', 'CIF', 'NIE', 'OTROS'];

const EMPTY_FORM = {
  nombre: '', apellidos: '', telefono: '', email: '',
  nif: '', tipo_identificacion: 'NIF',
  direccion: '', codigo_postal: '', ciudad: '', provincia: '',
  iban: '', tipo_operario: 'autonomo' as 'autonomo' | 'contratado',
  gremios: [] as string[], tipos_servicio: [] as string[],
  activo: true, observaciones: '',
};

export function OperariosConfigPage() {
  const { data: gremiosRes } = useCatalogos('gremio');
  const gremios = gremiosRes && 'data' in gremiosRes ? (gremiosRes.data as any[]) ?? [] : [];

  const { data: docRes } = useDocRequerida(true);
  const docsRequeridos: any[] = docRes?.data ?? [];

  const { data: res, isLoading } = useOperarios();
  const createMut = useCreateOperario();
  const updateMut = useUpdateOperario();

  const [search, setSearch] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'activos' | 'todos' | 'bajas'>('activos');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<ModalTab>('datos');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const operarios: any[] = res && 'data' in res ? (res.data as any[]) ?? [] : [];
  const filtered = operarios.filter((o: any) => {
    const matchActivo = filtroActivo === 'activos' ? o.activo : filtroActivo === 'bajas' ? !o.activo : true;
    const matchSearch = !search || `${o.nombre} ${o.apellidos} ${o.email}`.toLowerCase().includes(search.toLowerCase());
    return matchActivo && matchSearch;
  });

  function openNew() {
    setEditId(null); setForm(EMPTY_FORM); setFormError(''); setTab('datos'); setShowForm(true);
  }
  function openEdit(o: any) {
    setEditId(o.id);
    setForm({
      nombre: o.nombre ?? '', apellidos: o.apellidos ?? '', telefono: o.telefono ?? '', email: o.email ?? '',
      nif: o.nif ?? '', tipo_identificacion: o.tipo_identificacion ?? 'NIF',
      direccion: o.direccion ?? '', codigo_postal: o.codigo_postal ?? '', ciudad: o.ciudad ?? '', provincia: o.provincia ?? '',
      iban: o.iban ?? '', tipo_operario: o.tipo_operario ?? 'autonomo',
      gremios: o.gremios ?? [], tipos_servicio: o.tipos_servicio ?? [],
      activo: o.activo ?? true, observaciones: o.observaciones ?? '',
    });
    setFormError(''); setTab('datos'); setShowForm(true);
  }

  function setField(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  function toggleArr(k: 'gremios' | 'tipos_servicio', val: string) {
    setForm(p => ({ ...p, [k]: p[k].includes(val) ? p[k].filter((x: string) => x !== val) : [...p[k], val] }));
  }

  async function handleSave() {
    setFormError('');
    try {
      if (editId) await updateMut.mutateAsync({ id: editId, ...form } as any);
      else await createMut.mutateAsync(form as any);
      setShowForm(false);
    } catch (err: any) { setFormError(err.message ?? 'Error al guardar'); }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><HardHat size={20} /> Operarios</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Gestión de operarios, especialidades y documentación requerida</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nuevo operario
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['activos', 'todos', 'bajas'] as const).map((f) => (
          <button key={f} className={`btn ${filtroActivo === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroActivo(f)}>
            {f === 'activos' ? 'Activos' : f === 'bajas' ? 'Bajas' : 'Todos'}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input className="form-control" style={{ paddingLeft: 32, width: 220 }} placeholder="Buscar operario..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>{filtered.length} operario{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? <div className="loading">Cargando operarios...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Especialidades</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin operarios</td></tr>
              )}
              {filtered.map((o: any) => (
                <tr key={o.id} style={{ opacity: o.activo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{o.nombre} {o.apellidos}</td>
                  <td style={{ fontSize: 13 }}>{o.telefono ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{o.email || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    <span className="badge badge-default">{o.tipo_operario === 'contratado' ? 'Contratado' : 'Autónomo'}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{(o.gremios || []).slice(0, 3).join(', ') || '—'}{(o.gremios || []).length > 3 && '...'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${o.activo ? 'badge-success' : 'badge-default'}`}>{o.activo ? 'Activo' : 'Baja'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(o)} title="Editar"><Pencil size={13} /></button>
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
          <div className="modal-v2 modal-v2--lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editId ? 'Editar operario' : 'Nuevo operario'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', padding: '0 24px' }}>
              {([['datos', 'Datos'], ['doc', 'Doc. Requerida'], ['servicios', 'Tipos de Servicio']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>

            <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {formError && <div className="alert alert-error">{formError}</div>}

              {/* Tab: Datos */}
              {tab === 'datos' && (
                <>
                  <div className="form-section-v2">
                    <div className="form-section-v2__title">Datos personales</div>
                    <div className="form-grid-v2">
                      <div className="form-group-v2">
                        <label className="form-label required">Nombre</label>
                        <input className="form-control" value={form.nombre} required autoFocus onChange={(e) => setField('nombre', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label required">Apellidos</label>
                        <input className="form-control" value={form.apellidos} required onChange={(e) => setField('apellidos', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">Identificación</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="form-control" style={{ width: 80, flexShrink: 0 }} value={form.tipo_identificacion} onChange={(e) => setField('tipo_identificacion', e.target.value)}>
                            {TIPO_ID.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <input className="form-control" value={form.nif} placeholder="Número" onChange={(e) => setField('nif', e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">Tipo</label>
                        <select className="form-control" value={form.tipo_operario} onChange={(e) => setField('tipo_operario', e.target.value)}>
                          <option value="autonomo">Autónomo</option>
                          <option value="contratado">Contratado</option>
                        </select>
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label required">Teléfono</label>
                        <input className="form-control" value={form.telefono} required onChange={(e) => setField('telefono', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">Email</label>
                        <input className="form-control" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="form-section-v2">
                    <div className="form-section-v2__title">Dirección</div>
                    <div className="form-grid-v2">
                      <div className="form-group-v2 span-full">
                        <label className="form-label">Dirección</label>
                        <input className="form-control" value={form.direccion} onChange={(e) => setField('direccion', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">C.P.</label>
                        <input className="form-control" value={form.codigo_postal} onChange={(e) => setField('codigo_postal', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">Ciudad</label>
                        <input className="form-control" value={form.ciudad} onChange={(e) => setField('ciudad', e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label className="form-label">Provincia</label>
                        <input className="form-control" value={form.provincia} onChange={(e) => setField('provincia', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="form-section-v2">
                    <div className="form-section-v2__title">Datos bancarios</div>
                    <div className="form-group-v2">
                      <label className="form-label">IBAN</label>
                      <input className="form-control" value={form.iban} placeholder="ES00 0000 0000 0000 0000 0000" style={{ fontFamily: 'monospace' }}
                        onChange={(e) => setField('iban', e.target.value.toUpperCase())} />
                    </div>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Observaciones</label>
                    <textarea className="form-control" rows={3} value={form.observaciones} onChange={(e) => setField('observaciones', e.target.value)} />
                  </div>
                  {editId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.activo} onChange={(e) => setField('activo', e.target.checked)} style={{ width: 15, height: 15 }} />
                      <span className="form-label" style={{ margin: 0 }}>Operario activo</span>
                    </label>
                  )}
                  <div className="form-group-v2">
                    <label className="form-label">Especialidades (Gremios)</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {gremios.map((g: any) => (
                        <button key={g.codigo} type="button"
                          className={`btn ${form.gremios.includes(g.codigo) ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 12, padding: '3px 10px' }}
                          onClick={() => toggleArr('gremios', g.codigo)}>
                          {g.valor}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Tab: Doc Requerida */}
              {tab === 'doc' && (
                <div>
                  {docsRequeridos.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px 0' }}>
                      No hay tipos de documentos configurados. Configúralos en <strong>Doc. Requerida</strong>.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {docsRequeridos.map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-subtle)', borderRadius: 8, border: '1px solid var(--color-border-default)' }}>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{d.nombre}</div>
                            {d.dias_vigencia && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Vigencia: {d.dias_vigencia} días</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {d.obligatorio && <span className="badge badge-danger">Obligatorio</span>}
                            <span className="badge badge-default">Sin entregar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 16 }}>
                    La gestión de los documentos entregados por el operario se realizará desde el perfil individual.
                  </p>
                </div>
              )}

              {/* Tab: Tipos de Servicio */}
              {tab === 'servicios' && (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                    Selecciona los tipos de servicio que puede realizar este operario:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {TIPOS_SERVICIO.map((tipo) => (
                      <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: 6, border: `1px solid ${form.tipos_servicio.includes(tipo) ? 'var(--color-primary)' : 'var(--color-border-default)'}` }}>
                        <input type="checkbox" checked={form.tipos_servicio.includes(tipo)} onChange={() => toggleArr('tipos_servicio', tipo)} style={{ width: 15, height: 15 }} />
                        <span style={{ fontSize: 13 }}>{tipo}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 12 }}>
                    {form.tipos_servicio.length} tipo{form.tipos_servicio.length !== 1 ? 's' : ''} seleccionado{form.tipos_servicio.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-v2__footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Crear operario')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
