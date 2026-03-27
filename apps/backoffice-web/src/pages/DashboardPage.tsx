import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, CreditCard, Clock, FileWarning } from 'lucide-react';
import { useDashboardKpis, useCompaniasKpisMes } from '@/hooks/useDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function getMesLabel() {
  const d = new Date();
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtMoney(v: number) {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v: number) {
  return v.toLocaleString('es-ES');
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface KpiChipProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
}

function KpiChip({ label, value, icon, variant = 'default' }: KpiChipProps) {
  return (
    <div className={`kpi-chip kpi-chip--${variant}`}>
      {icon && <span className="kpi-chip__icon">{icon}</span>}
      <div>
        <div className="kpi-chip__value">{value}</div>
        <div className="kpi-chip__label">{label}</div>
      </div>
    </div>
  );
}

interface CompaniaRow {
  compania_id: string;
  compania_nombre: string;
  prefijo: string;
  nuevos_mes: number;
  cerrados_mes: number;
  en_curso: number;
  facturado_mes: number;
  coste_operario_mes: number;
}

function CompaniasKpiTable({ rows, isLoading }: { rows: CompaniaRow[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="ckpi-table">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="ckpi-row ckpi-row--skeleton">
            {[72, 0, 56, 56, 110, 110, 64].map((w, j) => (
              <div key={j} className="ckpi-cell">
                <div className="ckpi-skel" style={{ width: w || '100%', maxWidth: w || undefined }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        No hay compañías activas.
      </div>
    );
  }

  const totales: CompaniaRow = rows.reduce(
    (acc, r) => ({
      ...acc,
      nuevos_mes:         acc.nuevos_mes         + r.nuevos_mes,
      cerrados_mes:       acc.cerrados_mes        + r.cerrados_mes,
      en_curso:           acc.en_curso            + r.en_curso,
      facturado_mes:      acc.facturado_mes       + r.facturado_mes,
      coste_operario_mes: acc.coste_operario_mes  + r.coste_operario_mes,
    }),
    { compania_id: '', compania_nombre: 'TOTAL', prefijo: '', nuevos_mes: 0, cerrados_mes: 0, en_curso: 0, facturado_mes: 0, coste_operario_mes: 0 },
  );

  return (
    <div className="ckpi-table">
      {/* Header */}
      <div className="ckpi-header">
        <div className="ckpi-cell ckpi-cell--prefijo">Clave</div>
        <div className="ckpi-cell ckpi-cell--name">Compañía</div>
        <div className="ckpi-cell ckpi-cell--num" title="Expedientes nuevos asignados este mes">Nuevos</div>
        <div className="ckpi-cell ckpi-cell--num" title="Expedientes cerrados este mes">Cerrados</div>
        <div className="ckpi-cell ckpi-cell--money" title="Importe base facturado este mes (€)">Facturado</div>
        <div className="ckpi-cell ckpi-cell--money" title="Coste operario estimado este mes (€)">Coste op.</div>
        <div className="ckpi-cell ckpi-cell--num" title="Expedientes activos en este momento">Activos</div>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <Link
          key={row.compania_id}
          to={`/expedientes?compania_id=${row.compania_id}`}
          className="ckpi-row"
        >
          <div className="ckpi-cell ckpi-cell--prefijo">
            <span className="ckpi-prefijo">{row.prefijo || '—'}</span>
          </div>
          <div className="ckpi-cell ckpi-cell--name ckpi-nombre">{row.compania_nombre}</div>
          <div className="ckpi-cell ckpi-cell--num">
            <span className={`ckpi-num${row.nuevos_mes > 0 ? ' ckpi-num--blue' : ' ckpi-num--zero'}`}>
              {row.nuevos_mes}
            </span>
          </div>
          <div className="ckpi-cell ckpi-cell--num">
            <span className={`ckpi-num${row.cerrados_mes > 0 ? ' ckpi-num--green' : ' ckpi-num--zero'}`}>
              {row.cerrados_mes}
            </span>
          </div>
          <div className="ckpi-cell ckpi-cell--money">
            {row.facturado_mes > 0 ? (
              <span className="ckpi-money">{fmtMoney(row.facturado_mes)}</span>
            ) : (
              <span className="ckpi-num--zero">—</span>
            )}
          </div>
          <div className="ckpi-cell ckpi-cell--money">
            {row.coste_operario_mes > 0 ? (
              <span className="ckpi-cost">{fmtMoney(row.coste_operario_mes)}</span>
            ) : (
              <span className="ckpi-num--zero">—</span>
            )}
          </div>
          <div className="ckpi-cell ckpi-cell--num">
            <span className={`ckpi-num${row.en_curso > 20 ? ' ckpi-num--amber' : row.en_curso > 0 ? '' : ' ckpi-num--zero'}`}>
              {row.en_curso}
            </span>
          </div>
        </Link>
      ))}

      {/* Totals */}
      <div className="ckpi-row ckpi-row--total">
        <div className="ckpi-cell ckpi-cell--prefijo" />
        <div className="ckpi-cell ckpi-cell--name ckpi-nombre">TOTAL</div>
        <div className="ckpi-cell ckpi-cell--num">
          <span className="ckpi-num ckpi-num--blue">{fmtNum(totales.nuevos_mes)}</span>
        </div>
        <div className="ckpi-cell ckpi-cell--num">
          <span className="ckpi-num ckpi-num--green">{fmtNum(totales.cerrados_mes)}</span>
        </div>
        <div className="ckpi-cell ckpi-cell--money">
          <span className="ckpi-money">{fmtMoney(totales.facturado_mes)}</span>
        </div>
        <div className="ckpi-cell ckpi-cell--money">
          <span className="ckpi-cost">{fmtMoney(totales.coste_operario_mes)}</span>
        </div>
        <div className="ckpi-cell ckpi-cell--num">
          <span className="ckpi-num">{fmtNum(totales.en_curso)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const mesLabel = getMesLabel();

  const { data: kpiData, isLoading: kpiLoading } = useDashboardKpis({});
  const kpis: any = kpiData && 'data' in kpiData ? kpiData.data : null;

  const { data: compData, isLoading: compLoading } = useCompaniasKpisMes();
  const companias: CompaniaRow[] = compData && 'data' in compData ? (compData.data as CompaniaRow[]) ?? [] : [];

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header dashboard-mes-header">
        <h2 className="page-title">Cuadro de mando</h2>
        <span className="mes-badge">{mesLabel}</span>
      </div>

      {/* ── KPI strip ── */}
      {!kpiLoading && kpis && (
        <div className="dashboard-kpi-strip">
          <KpiChip
            label="En curso"
            value={fmtNum(kpis.en_curso ?? 0)}
            icon={<Activity size={14} />}
            variant="info"
          />
          <KpiChip
            label="Pendientes"
            value={fmtNum(kpis.pendientes ?? 0)}
            icon={<Clock size={14} />}
            variant={Number(kpis.pendientes) > 0 ? 'warning' : 'default'}
          />
          <KpiChip
            label="Sin facturar"
            value={fmtNum(kpis.finalizados_sin_factura ?? 0)}
            icon={<FileWarning size={14} />}
            variant={Number(kpis.finalizados_sin_factura) > 0 ? 'warning' : 'default'}
          />
          <KpiChip
            label="Total facturado"
            value={fmt(kpis.total_facturado ?? 0)}
            icon={<CreditCard size={14} />}
            variant="success"
          />
          <KpiChip
            label="Total cobrado"
            value={fmt(kpis.total_cobrado ?? 0)}
            icon={<CheckCircle size={14} />}
            variant="success"
          />
          <KpiChip
            label="Pendiente cobro"
            value={fmt(kpis.pendiente_cobro ?? 0)}
            icon={<TrendingUp size={14} />}
            variant={Number(kpis.pendiente_cobro) > 0 ? 'warning' : 'default'}
          />
          {Number(kpis.facturas_vencidas) > 0 && (
            <KpiChip
              label="Facturas vencidas"
              value={fmtNum(kpis.facturas_vencidas)}
              icon={<AlertTriangle size={14} />}
              variant="danger"
            />
          )}
          {Number(kpis.informes_caducados) > 0 && (
            <KpiChip
              label="Inf. caducados"
              value={fmtNum(kpis.informes_caducados)}
              icon={<TrendingDown size={14} />}
              variant="danger"
            />
          )}
        </div>
      )}

      {/* ── Company KPI table ── */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3>Actividad por compañía</h3>
          <span className="section-meta">{mesLabel} · {companias.length} compañías activas</span>
        </div>
        <CompaniasKpiTable rows={companias} isLoading={compLoading} />
      </div>
    </div>
  );
}
