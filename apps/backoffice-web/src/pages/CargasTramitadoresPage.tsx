import { Link } from 'react-router-dom';
import { useTramitadoresDashboard } from '@/hooks/useTramitadores';

const SEMAFORO_LABEL: Record<string, string> = { verde: 'OK', amarillo: 'Alerta', rojo: 'Lleno' };
const SEMAFORO_COLORS: Record<string, string> = { verde: '#22c55e', amarillo: '#f59e0b', rojo: '#ef4444' };
const SEMAFORO_BG: Record<string, string> = { verde: '#f0fdf4', amarillo: '#fffbeb', rojo: '#fef2f2' };

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 20px', minWidth: 130 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? 'var(--color-foreground)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function CargasTramitadoresPage() {
  const { data: res, isLoading } = useTramitadoresDashboard();
  const kpis = res?.data;
  const tramitadores: any[] = kpis?.tramitadores ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Panel de Cargas de Trabajo</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Distribución de trabajo por tramitador en tiempo real</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/usuarios" className="btn btn-secondary">Gestión usuarios</Link>
          <Link to="/usuarios/cola" className="btn btn-primary">Cola de asignación</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Cargando dashboard...</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <KpiCard label="Tramitadores activos" value={kpis?.total_tramitadores_activos ?? 0} />
            <KpiCard label="Sin tramitador" value={kpis?.expedientes_sin_tramitador ?? 0} color={kpis?.expedientes_sin_tramitador > 0 ? '#ef4444' : undefined} />
            <KpiCard label="En alerta de carga" value={kpis?.tramitadores_en_alerta ?? 0} color={kpis?.tramitadores_en_alerta > 0 ? '#f59e0b' : undefined} />
            <KpiCard label="Sobrecargados" value={kpis?.tramitadores_sobrecargados ?? 0} color={kpis?.tramitadores_sobrecargados > 0 ? '#ef4444' : undefined} />
            <KpiCard label="SLA vencidos" value={kpis?.total_sla_vencidos ?? 0} color={kpis?.total_sla_vencidos > 0 ? '#ef4444' : undefined} />
            <KpiCard label="Sin cita asignada" value={kpis?.total_sin_cita ?? 0} />
            <KpiCard label="Bloqueados" value={kpis?.total_bloqueados ?? 0} />
            <KpiCard label="Carga promedio" value={`${kpis?.carga_promedio_pct ?? 0}%`} />
          </div>

          {/* Tabla de tramitadores */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tramitador</th>
                  <th>Estado</th>
                  <th style={{ width: 180 }}>Carga</th>
                  <th>Urgentes</th>
                  <th>SLA ven.</th>
                  <th>Sin cita</th>
                  <th>Bloqueados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tramitadores.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px 0' }}>
                      No hay tramitadores activos
                    </td>
                  </tr>
                )}
                {tramitadores.map((t: any) => (
                  <tr key={t.tramitador_id} style={{ background: t.semaforo === 'rojo' ? '#fef2f2' : undefined }}>
                    <td>
                      <Link to={`/usuarios/tramitador/${t.tramitador_id}`} style={{ fontWeight: 600 }}>
                        {t.nombre_completo}
                      </Link>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{t.nivel}</div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: SEMAFORO_COLORS[t.semaforo ?? 'verde'],
                        background: SEMAFORO_BG[t.semaforo ?? 'verde'],
                        padding: '2px 8px',
                        borderRadius: 20,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEMAFORO_COLORS[t.semaforo ?? 'verde'], display: 'inline-block' }} />
                        {SEMAFORO_LABEL[t.semaforo ?? 'verde']}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(t.porcentaje_carga ?? 0, 100)}%`,
                            background: SEMAFORO_COLORS[t.semaforo ?? 'verde'],
                            borderRadius: 4,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>
                          {t.total_activos}/{t.max_expedientes_activos}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: (t.total_urgentes ?? 0) > 0 ? 700 : 400, color: (t.total_urgentes ?? 0) > 0 ? '#ef4444' : undefined }}>
                      {t.total_urgentes ?? 0}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: (t.total_sla_vencidos ?? 0) > 0 ? 700 : 400, color: (t.total_sla_vencidos ?? 0) > 0 ? '#ef4444' : undefined }}>
                      {t.total_sla_vencidos ?? 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>{t.total_sin_cita ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (t.total_bloqueados ?? 0) > 0 ? '#f59e0b' : undefined }}>
                      {t.total_bloqueados ?? 0}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/usuarios/tramitador/${t.tramitador_id}`} className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 8px' }}>
                          Ver
                        </Link>
                        {t.semaforo === 'rojo' && (
                          <Link to={`/usuarios/reasignacion-masiva?origen=${t.tramitador_id}`} className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 8px', color: '#ef4444' }}>
                            Reasignar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
