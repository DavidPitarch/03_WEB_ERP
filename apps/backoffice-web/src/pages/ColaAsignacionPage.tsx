import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useColaAsignacion,
  useTramitadores,
  useAsignarTramitador,
} from '@/hooks/useTramitadores';

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', media: '#f59e0b', baja: '#6b7280',
};

const SEMAFORO_COLORS: Record<string, string> = { verde: '#22c55e', amarillo: '#f59e0b', rojo: '#ef4444' };

function SemaBadge({ semaforo }: { semaforo: string }) {
  return (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEMAFORO_COLORS[semaforo] ?? '#22c55e', display: 'inline-block', marginRight: 4 }} />
  );
}

function SLACountdown({ fechaLimite }: { fechaLimite: string | null }) {
  if (!fechaLimite) return <span style={{ color: 'var(--color-muted)' }}>—</span>;
  const days = Math.ceil((new Date(fechaLimite).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? '#ef4444' : days <= 2 ? '#f59e0b' : 'var(--color-muted)';
  return <span style={{ color, fontWeight: days <= 2 ? 700 : 400, fontSize: 13 }}>{days < 0 ? `${Math.abs(days)}d vencido` : `${days}d`}</span>;
}

function ExpedienteRow({ exp, tramitadores, onAsignar }: { exp: any; tramitadores: any[]; onAsignar: (expId: string, tramId: string) => void }) {
  const [selected, setSelected] = useState('');

  return (
    <tr>
      <td>
        <Link to={`/expedientes/${exp.id}`} style={{ fontWeight: 600 }}>
          {exp.numero_expediente}
        </Link>
        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          {exp.asegurados?.nombre} {exp.asegurados?.apellidos}
        </div>
      </td>
      <td style={{ fontSize: 13 }}>{exp.companias?.nombre ?? '—'}</td>
      <td style={{ fontSize: 13 }}>{exp.tipo_siniestro ?? '—'}</td>
      <td>
        <span style={{ fontSize: 12, fontWeight: 700, color: PRIORIDAD_COLOR[exp.prioridad] ?? '#6b7280' }}>
          {exp.prioridad?.toUpperCase()}
        </span>
      </td>
      <td><SLACountdown fechaLimite={exp.fecha_limite_sla} /></td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ fontSize: 12, padding: '3px 6px', minWidth: 160 }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {tramitadores.map((t: any) => (
              <option key={t.tramitador_id} value={t.tramitador_id} disabled={t.semaforo === 'rojo'}>
                {t.semaforo !== 'verde' ? `⚠ ` : ''}{t.nombre_completo} ({t.total_activos}/{t.max_expedientes_activos})
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '3px 10px', whiteSpace: 'nowrap' }}
            disabled={!selected}
            onClick={() => { if (selected) onAsignar(exp.id, selected); }}
          >
            Asignar
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ColaAsignacionPage() {
  const [page, setPage] = useState(1);
  const { data: colaRes, isLoading, refetch } = useColaAsignacion({ page });
  const { data: tramRes } = useTramitadores(undefined, true);
  const asignar = useAsignarTramitador();

  const cola: any[] = colaRes?.data?.items ?? [];
  const total: number = colaRes?.data?.total ?? 0;
  const totalPages: number = colaRes?.data?.total_pages ?? 1;
  const tramitadores: any[] = tramRes?.data ?? [];

  async function handleAsignar(expedienteId: string, tramitadorId: string) {
    try {
      await asignar.mutateAsync({ expediente_id: expedienteId, tramitador_id: tramitadorId });
      refetch();
    } catch (err: any) {
      alert(err.message ?? 'Error al asignar');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Asignaciones</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Expedientes en entrada (NUEVO / NO ASIGNADO) — {total} pendientes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/usuarios/cargas" className="btn btn-secondary">Panel de cargas</Link>
          <Link to="/usuarios/reasignacion-masiva" className="btn btn-secondary">Reasignación masiva</Link>
        </div>
      </div>

      {/* Leyenda de semáforo */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--color-muted)' }}>
        <span><SemaBadge semaforo="verde" />Disponible</span>
        <span><SemaBadge semaforo="amarillo" />En alerta</span>
        <span><SemaBadge semaforo="rojo" />Lleno (deshabilitado)</span>
      </div>

      {isLoading ? (
        <div className="loading">Cargando cola...</div>
      ) : cola.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-muted)' }}>
          No hay expedientes sin asignar
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expediente</th>
                  <th>Compañía</th>
                  <th>Tipo siniestro</th>
                  <th>Prioridad</th>
                  <th>SLA</th>
                  <th style={{ minWidth: 280 }}>Asignar a</th>
                </tr>
              </thead>
              <tbody>
                {cola.map((exp: any) => (
                  <ExpedienteRow
                    key={exp.id}
                    exp={exp}
                    tramitadores={tramitadores}
                    onAsignar={handleAsignar}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </button>
              <span style={{ padding: '6px 12px', fontSize: 13 }}>Página {page} de {totalPages}</span>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
