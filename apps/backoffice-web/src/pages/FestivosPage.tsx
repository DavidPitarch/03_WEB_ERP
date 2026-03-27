import { useState } from 'react';
import { CalendarRange, Trash2 } from 'lucide-react';
import { useFestivos, useCreateFestivo, useDeleteFestivo, type Festivo } from '@/hooks/useFestivos';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEM = ['L','M','X','J','V','S','D'];

const AMBITO_LABELS: Record<string, string> = {
  nacional: 'Nacional',
  autonomico: 'Autonómico',
  provincial: 'Provincial',
  local: 'Local',
  empresa: 'Empresa',
};

const AMBITO_COLORS: Record<string, string> = {
  nacional: '#ef4444',
  autonomico: '#f97316',
  provincial: '#eab308',
  local: '#22c55e',
  empresa: '#3b82f6',
};

function getDiasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

function getPrimerDia(anio: number, mes: number): number {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1; // Lunes = 0
}

function toFechaStr(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function FestivosPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [ambitoFiltro, setAmbitoFiltro] = useState<string>('todos');
  const [addForm, setAddForm] = useState<{ fecha: string; nombre: string; ambito: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Festivo | null>(null);

  const { data: res, isLoading } = useFestivos(anio);
  const crear = useCreateFestivo();
  const eliminar = useDeleteFestivo();

  const festivos: Festivo[] = res?.data ?? [];

  // Índice de festivos por fecha
  const festivosPorFecha = new Map<string, Festivo[]>();
  for (const f of festivos) {
    const key = f.fecha;
    if (!festivosPorFecha.has(key)) festivosPorFecha.set(key, []);
    festivosPorFecha.get(key)!.push(f);
  }

  const festivosFiltrados = ambitoFiltro === 'todos'
    ? festivos
    : festivos.filter((f) => f.ambito === ambitoFiltro);

  function handleDayClick(fecha: string) {
    setAddForm({ fecha, nombre: '', ambito: 'nacional' });
  }

  async function handleAddFestivo(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm) return;
    await crear.mutateAsync({ fecha: addForm.fecha, nombre: addForm.nombre, ambito: addForm.ambito });
    setAddForm(null);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await eliminar.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  return (
    <div className="page-stub">
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarRange size={20} />
            Festivos
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Calendario de días festivos que afectan a la planificación de citas y SLAs
          </p>
        </div>
        {/* Selector de año */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setAnio(a => a - 1)}>&#8592;</button>
          <span style={{ fontWeight: 600, fontSize: 18, minWidth: 60, textAlign: 'center' }}>{anio}</span>
          <button className="btn btn-secondary" onClick={() => setAnio(a => a + 1)}>&#8594;</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* ── Calendario ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Leyenda ámbitos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {Object.entries(AMBITO_LABELS).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: AMBITO_COLORS[k], display: 'inline-block' }} />
                {v}
              </span>
            ))}
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
              Clic en un día para añadir festivo
            </span>
          </div>

          {/* Grid de meses */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {MESES.map((mes, mesIdx) => {
              const dias = getDiasEnMes(anio, mesIdx);
              const primerDia = getPrimerDia(anio, mesIdx);
              const celdas: (number | null)[] = [...Array(primerDia).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
              while (celdas.length % 7 !== 0) celdas.push(null);

              return (
                <div key={mes} style={{ border: '1px solid var(--color-border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--color-text-primary)', textAlign: 'center' }}>{mes}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                    {DIAS_SEM.map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-text-tertiary)', paddingBottom: 4 }}>{d}</div>
                    ))}
                    {celdas.map((dia, i) => {
                      if (!dia) return <div key={`e-${i}`} />;
                      const fecha = toFechaStr(anio, mesIdx, dia);
                      const festivosDia = festivosPorFecha.get(fecha) ?? [];
                      const hayFestivo = festivosDia.length > 0;
                      const primerColor = hayFestivo ? AMBITO_COLORS[festivosDia[0].ambito] ?? '#f97316' : undefined;

                      return (
                        <button
                          key={dia}
                          title={hayFestivo ? festivosDia.map(f => f.nombre).join(', ') : `Añadir festivo ${fecha}`}
                          onClick={() => handleDayClick(fecha)}
                          style={{
                            textAlign: 'center',
                            fontSize: 12,
                            padding: '3px 0',
                            borderRadius: 4,
                            cursor: 'pointer',
                            border: hayFestivo ? `2px solid ${primerColor}` : '2px solid transparent',
                            background: hayFestivo ? `${primerColor}22` : 'transparent',
                            color: hayFestivo ? primerColor : 'var(--color-text-primary)',
                            fontWeight: hayFestivo ? 700 : 400,
                            transition: 'background 0.15s',
                          }}
                        >
                          {dia}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Lista de festivos ── */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['todos', ...Object.keys(AMBITO_LABELS)].map((a) => (
              <button
                key={a}
                className={`btn ${ambitoFiltro === a ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: 12 }}
                onClick={() => setAmbitoFiltro(a)}
              >
                {a === 'todos' ? 'Todos' : AMBITO_LABELS[a]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="loading">Cargando...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
              {festivosFiltrados.length === 0 && (
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sin festivos para este filtro</p>
              )}
              {festivosFiltrados
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((f) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--color-bg-subtle)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: AMBITO_COLORS[f.ambito] ?? '#9ca3af', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{f.fecha} · {AMBITO_LABELS[f.ambito]}</div>
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '2px 6px', flexShrink: 0 }}
                      onClick={() => setConfirmDelete(f)}
                      title="Eliminar festivo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Añadir festivo ── */}
      {addForm && (
        <div className="modal-overlay-v2" onClick={() => setAddForm(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Añadir festivo — {addForm.fecha}</div>
              <button className="modal-v2__close" onClick={() => setAddForm(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddFestivo}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group-v2">
                  <label className="form-label required">Nombre del festivo</label>
                  <input
                    className="form-control"
                    autoFocus
                    required
                    value={addForm.nombre}
                    placeholder="Ej. Día de la Constitución"
                    onChange={(e) => setAddForm(p => p ? { ...p, nombre: e.target.value } : null)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label required">Ámbito</label>
                  <select
                    className="form-control"
                    value={addForm.ambito}
                    onChange={(e) => setAddForm(p => p ? { ...p, ambito: e.target.value } : null)}
                  >
                    {Object.entries(AMBITO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddForm(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={crear.isPending}>
                  {crear.isPending ? 'Añadiendo...' : 'Añadir festivo'}
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
              <div className="modal-v2__title">Eliminar festivo</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Eliminar el festivo <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.nombre}</strong> ({confirmDelete.fecha})?
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
