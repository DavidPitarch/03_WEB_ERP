import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useTramitador,
  useTramitadorExpedientes,
  useTramitadorHistorial,
  useTramitadorPreasignaciones,
  useActualizarCapacidad,
  useCrearPreasignacion,
  useEliminarPreasignacion,
} from '@/hooks/useTramitadores';

const SEMAFORO_COLORS: Record<string, string> = { verde: '#22c55e', amarillo: '#f59e0b', rojo: '#ef4444' };
const TIPO_HIST_LABEL: Record<string, string> = {
  asignacion_inicial: 'Asignación inicial',
  reasignacion_manual: 'Reasignación manual',
  reasignacion_automatica: 'Reasignación automática',
  reasignacion_masiva: 'Reasignación masiva',
  desasignacion: 'Desasignación',
};

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', minWidth: 100 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--color-foreground)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function TramitadorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'expedientes' | 'preasignaciones' | 'capacidad' | 'historial'>('expedientes');
  const [expPage, setExpPage] = useState(1);
  const [histPage, setHistPage] = useState(1);
  const [showPreasigModal, setShowPreasigModal] = useState(false);
  const [preForm, setPreForm] = useState({ compania_id: '', tipo_siniestro: '', prioridad: '', zona_cp_patron: '', peso: 100, descripcion: '' });
  const [capForm, setCapForm] = useState<any>(null);
  const [capSaved, setCapSaved] = useState(false);

  const { data: tramRes } = useTramitador(id!);
  const { data: expRes, isLoading: loadingExp } = useTramitadorExpedientes(id!, { page: expPage });
  const { data: histRes } = useTramitadorHistorial(id!, histPage);
  const { data: preRes } = useTramitadorPreasignaciones(id!);
  const actualizarCap = useActualizarCapacidad();
  const crearPre = useCrearPreasignacion();
  const eliminarPre = useEliminarPreasignacion();

  const tramitador = tramRes?.data;
  const carga = tramitador?.carga;
  const expedientes: any[] = expRes?.data?.items ?? [];
  const historial: any[] = histRes?.data?.items ?? [];
  const preasignaciones: any[] = preRes?.data ?? [];

  if (!tramitador) return <div className="loading">Cargando...</div>;

  const capData = capForm ?? {
    max_expedientes_activos: tramitador.max_expedientes_activos,
    max_urgentes: tramitador.max_urgentes,
    umbral_alerta_pct: tramitador.umbral_alerta_pct,
  };

  async function handleSaveCap(e: React.FormEvent) {
    e.preventDefault();
    await actualizarCap.mutateAsync({ id: id!, ...capData });
    setCapSaved(true);
    setTimeout(() => setCapSaved(false), 3000);
  }

  async function handleCrearPre(e: React.FormEvent) {
    e.preventDefault();
    await crearPre.mutateAsync({ tramitadorId: id!, ...preForm });
    setShowPreasigModal(false);
    setPreForm({ compania_id: '', tipo_siniestro: '', prioridad: '', zona_cp_patron: '', peso: 100, descripcion: '' });
  }

  async function handleEliminarPre(ruleId: string) {
    if (!confirm('¿Eliminar esta regla de preasignación?')) return;
    await eliminarPre.mutateAsync({ tramitadorId: id!, ruleId });
  }

  return (
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/usuarios" style={{ fontSize: 13, color: 'var(--color-muted)' }}>← Usuarios</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{tramitador.nombre} {tramitador.apellidos}</h2>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
              <span>{tramitador.email}</span>
              <span className="badge badge-default">{tramitador.nivel}</span>
              <span style={{ color: tramitador.activo ? '#22c55e' : '#9ca3af' }}>
                {tramitador.activo ? '● Activo' : '○ Baja'}
              </span>
            </div>
          </div>
          <Link to={`/usuarios/reasignacion-masiva?origen=${id}`} className="btn btn-secondary">
            Reasignar expedientes
          </Link>
        </div>
      </div>

      {/* KPIs de carga */}
      {carga && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <StatCard label="Activos" value={carga.total_activos} color={SEMAFORO_COLORS[carga.semaforo]} />
          <StatCard label="Urgentes" value={carga.total_urgentes} color={carga.total_urgentes > 0 ? '#ef4444' : undefined} />
          <StatCard label="SLA vencidos" value={carga.total_sla_vencidos} color={carga.total_sla_vencidos > 0 ? '#ef4444' : undefined} />
          <StatCard label="Sin cita" value={carga.total_sin_cita} />
          <StatCard label="Bloqueados" value={carga.total_bloqueados} color={carga.total_bloqueados > 0 ? '#f59e0b' : undefined} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>
              Carga total: {carga.total_activos}/{tramitador.max_expedientes_activos}
            </div>
            <div style={{ width: 120, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(carga.porcentaje_carga ?? 0, 100)}%`,
                background: SEMAFORO_COLORS[carga.semaforo],
                borderRadius: 4,
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: SEMAFORO_COLORS[carga.semaforo], marginTop: 2 }}>
              {carga.porcentaje_carga}%
            </div>
          </div>
        </div>
      )}

      {/* Pestañas */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', marginBottom: 20, gap: 0 }}>
        {([
          ['expedientes', 'Expedientes activos'],
          ['preasignaciones', 'Preasignaciones'],
          ['capacidad', 'Capacidad'],
          ['historial', 'Historial'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === key ? 700 : 400,
              color: tab === key ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB: Expedientes */}
      {tab === 'expedientes' && (
        <div>
          {loadingExp ? (
            <div className="loading">Cargando expedientes...</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Expediente</th>
                    <th>Compañía</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {expedientes.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px 0' }}>Sin expedientes activos</td></tr>
                  )}
                  {expedientes.map((e: any) => (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/expedientes/${e.id}`} style={{ fontWeight: 600 }}>{e.numero_expediente}</Link>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{e.asegurados?.nombre} {e.asegurados?.apellidos}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{e.companias?.nombre ?? '—'}</td>
                      <td><span className="badge badge-default" style={{ fontSize: 11 }}>{e.estado}</span></td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: ({ urgente: '#ef4444', alta: '#f97316', media: '#f59e0b', baja: '#6b7280' } as any)[e.prioridad] }}>
                        {e.prioridad?.toUpperCase()}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        {e.fecha_limite_sla ? new Date(e.fecha_limite_sla).toLocaleDateString('es-ES') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={expPage <= 1} onClick={() => setExpPage(p => p - 1)}>Anterior</button>
            <span style={{ padding: '6px 12px', fontSize: 13 }}>Pág. {expPage}</span>
            <button className="btn btn-secondary" disabled={expedientes.length < 20} onClick={() => setExpPage(p => p + 1)}>Siguiente</button>
          </div>
        </div>
      )}

      {/* TAB: Preasignaciones */}
      {tab === 'preasignaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowPreasigModal(true)}>+ Nueva regla</button>
          </div>
          {preasignaciones.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>Sin reglas de preasignación</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Compañía</th><th>Tipo siniestro</th><th>Prioridad</th><th>Zona CP</th><th>Peso</th><th>Activa</th><th></th></tr>
                </thead>
                <tbody>
                  {preasignaciones.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 13 }}>{r.companias?.nombre ?? '— Todas —'}</td>
                      <td style={{ fontSize: 13 }}>{r.tipo_siniestro ?? '— Todos —'}</td>
                      <td style={{ fontSize: 13 }}>{r.prioridad ?? '— Todas —'}</td>
                      <td style={{ fontSize: 13 }}>{r.zona_cp_patron ?? '— Todas —'}</td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>{r.peso}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: r.activa ? '#22c55e' : '#9ca3af' }}>{r.activa ? '●' : '○'}</span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '2px 8px', color: '#ef4444' }}
                          onClick={() => handleEliminarPre(r.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showPreasigModal && (
            <div className="modal-overlay" onClick={() => setShowPreasigModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                  <h3>Nueva regla de preasignación</h3>
                  <button className="modal-close" onClick={() => setShowPreasigModal(false)}>×</button>
                </div>
                <form onSubmit={handleCrearPre}>
                  <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label className="form-field">
                      <span>ID Compañía (UUID)</span>
                      <input className="form-input" value={preForm.compania_id} placeholder="Dejar vacío = todas"
                        onChange={(e) => setPreForm(p => ({ ...p, compania_id: e.target.value }))} />
                    </label>
                    <label className="form-field">
                      <span>Tipo siniestro</span>
                      <input className="form-input" value={preForm.tipo_siniestro} placeholder="agua, incendio, ..."
                        onChange={(e) => setPreForm(p => ({ ...p, tipo_siniestro: e.target.value }))} />
                    </label>
                    <label className="form-field">
                      <span>Prioridad</span>
                      <select className="form-input" value={preForm.prioridad} onChange={(e) => setPreForm(p => ({ ...p, prioridad: e.target.value }))}>
                        <option value="">— Todas —</option>
                        <option value="urgente">Urgente</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Patrón CP (ej: 28%)</span>
                      <input className="form-input" value={preForm.zona_cp_patron} placeholder="28%"
                        onChange={(e) => setPreForm(p => ({ ...p, zona_cp_patron: e.target.value }))} />
                    </label>
                    <label className="form-field">
                      <span>Peso (1-1000)</span>
                      <input className="form-input" type="number" min={1} max={1000} value={preForm.peso}
                        onChange={(e) => setPreForm(p => ({ ...p, peso: parseInt(e.target.value) || 100 }))} />
                    </label>
                    <label className="form-field" style={{ gridColumn: '1/-1' }}>
                      <span>Descripción</span>
                      <input className="form-input" value={preForm.descripcion}
                        onChange={(e) => setPreForm(p => ({ ...p, descripcion: e.target.value }))} />
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPreasigModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={crearPre.isPending}>
                      {crearPre.isPending ? 'Creando...' : 'Crear regla'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Capacidad */}
      {tab === 'capacidad' && (
        <form onSubmit={handleSaveCap} style={{ maxWidth: 400 }}>
          {capSaved && <div className="alert alert-success" style={{ marginBottom: 12 }}>Configuración guardada</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="form-field">
              <span>Máx. expedientes activos</span>
              <input className="form-input" type="number" min={1} max={500} value={capData.max_expedientes_activos}
                onChange={(e) => setCapForm((p: any) => ({ ...(p ?? capData), max_expedientes_activos: parseInt(e.target.value) || 30 }))} />
            </label>
            <label className="form-field">
              <span>Máx. urgentes</span>
              <input className="form-input" type="number" min={0} max={100} value={capData.max_urgentes}
                onChange={(e) => setCapForm((p: any) => ({ ...(p ?? capData), max_urgentes: parseInt(e.target.value) || 0 }))} />
            </label>
            <label className="form-field">
              <span>Umbral de alerta (%)</span>
              <input className="form-input" type="number" min={10} max={100} value={capData.umbral_alerta_pct}
                onChange={(e) => setCapForm((p: any) => ({ ...(p ?? capData), umbral_alerta_pct: parseInt(e.target.value) || 90 }))} />
              <span style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, display: 'block' }}>
                Se generará alerta cuando la carga supere este porcentaje
              </span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={actualizarCap.isPending}>
            {actualizarCap.isPending ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div>
          {historial.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>Sin historial de asignaciones</div>
          ) : (
            <div className="timeline">
              {historial.map((h: any) => (
                <div key={h.id} className="timeline-item" style={{ paddingBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {TIPO_HIST_LABEL[h.tipo] ?? h.tipo}
                        {h.expedientes?.numero_expediente && (
                          <> — <Link to={`/expedientes/${h.expediente_id}`}>{h.expedientes.numero_expediente}</Link></>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        {new Date(h.created_at).toLocaleString('es-ES')}
                        {h.motivo && <> · {h.motivo}</>}
                        {h.batch_id && <> · Lote: <code style={{ fontSize: 10 }}>{h.batch_id.slice(0, 8)}…</code></>}
                      </div>
                      {h.tramitador_anterior && (
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {h.tramitador_anterior.nombre} {h.tramitador_anterior.apellidos} → {h.tramitador_nuevo?.nombre} {h.tramitador_nuevo?.apellidos}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}>Anterior</button>
            <span style={{ padding: '6px 12px', fontSize: 13 }}>Pág. {histPage}</span>
            <button className="btn btn-secondary" disabled={historial.length < 30} onClick={() => setHistPage(p => p + 1)}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
