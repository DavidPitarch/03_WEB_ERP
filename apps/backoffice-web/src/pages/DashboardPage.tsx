import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, CreditCard, Clock, FileWarning } from 'lucide-react';
import { useDashboardKpis, useCompaniasKpisMes } from '@/hooks/useDashboard';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Period = 'semana' | 'mes' | 'trimestre' | 'año';

const PERIOD_LABELS: Record<Period, string> = {
  semana:    'Última semana',
  mes:       'Último mes',
  trimestre: 'Último trimestre',
  año:       'Último año',
};

const PERIOD_BADGE: Record<Period, string> = {
  semana:    'ÚLT. SEMANA',
  mes:       'ÚLT. MES',
  trimestre: 'ÚLT. TRIMESTRE',
  año:       'ÚLT. AÑO',
};

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

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodDates(period: Period) {
  const now = new Date();
  const today = toDate(now);

  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return toDate(d);
  };

  const yearsAgo = (n: number) => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - n);
    return toDate(d);
  };

  if (period === 'semana') {
    const curFrom = daysAgo(7);
    return {
      current:  { fecha_desde: curFrom,    fecha_hasta: today },
      previous: { fecha_desde: daysAgo(14), fecha_hasta: curFrom },
    };
  }
  if (period === 'mes') {
    const curFrom = daysAgo(30);
    return {
      current:  { fecha_desde: curFrom,    fecha_hasta: today },
      previous: { fecha_desde: daysAgo(60), fecha_hasta: curFrom },
    };
  }
  if (period === 'trimestre') {
    const curFrom = daysAgo(90);
    return {
      current:  { fecha_desde: curFrom,     fecha_hasta: today },
      previous: { fecha_desde: daysAgo(180), fecha_hasta: curFrom },
    };
  }
  // año
  const curFrom = yearsAgo(1);
  return {
    current:  { fecha_desde: curFrom,     fecha_hasta: today },
    previous: { fecha_desde: yearsAgo(2), fecha_hasta: curFrom },
  };
}

function calcDelta(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── KpiChip ──────────────────────────────────────────────────────────────────
interface KpiChipProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
  delta?: number;
}

function KpiChip({ label, value, icon, variant = 'default', delta }: KpiChipProps) {
  const deltaOk = delta !== undefined && !isNaN(delta) && isFinite(delta);
  const up = deltaOk && delta! >= 0;

  return (
    <div className={`kpi-chip kpi-chip--${variant}`}>
      {icon && <span className="kpi-chip__icon">{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="kpi-chip__value">{value}</div>
        <div className="kpi-chip__label">{label}</div>
        {deltaOk && (
          <div className={`kpi-chip__delta kpi-chip__delta--${up ? 'up' : 'down'}`}>
            {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            <span>{up ? '+' : ''}{delta!.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CompaniasKpiTable ────────────────────────────────────────────────────────
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
        <div className="ckpi-cell ckpi-cell--num" title="Expedientes cerrados este mes">Cerr...</div>
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
  const [period, setPeriod] = useState<Period | null>(null);
  const mesLabel = getMesLabel();

  const dates = period ? getPeriodDates(period) : null;
  const currentFilters  = dates?.current  ?? {};
  const previousFilters = dates?.previous ?? {};

  const { data: kpiData,     isLoading: kpiLoading }  = useDashboardKpis(currentFilters);
  const { data: prevKpiData, isLoading: prevLoading }  = useDashboardKpis(previousFilters);

  const kpis:     any = kpiData     && 'data' in kpiData     ? kpiData.data     : null;
  const prevKpis: any = prevKpiData && 'data' in prevKpiData ? prevKpiData.data : null;

  const { data: compData, isLoading: compLoading } = useCompaniasKpisMes();
  const companias: CompaniaRow[] = compData && 'data' in compData ? (compData.data as CompaniaRow[]) ?? [] : [];

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const delta = (key: string) => {
    if (!period || !kpis || !prevKpis || (kpiLoading || prevLoading)) return undefined;
    return calcDelta(Number(kpis[key] ?? 0), Number(prevKpis[key] ?? 0));
  };

  const badgeLabel = period ? PERIOD_BADGE[period] : mesLabel.toUpperCase();

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header dashboard-mes-header">
        <h2 className="page-title">Cuadro de mando</h2>
        <div className="dashboard-period-filters">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`period-btn${period === p ? ' period-btn--active' : ''}`}
              onClick={() => setPeriod(period === p ? null : p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <span className="mes-badge">{badgeLabel}</span>
        </div>
      </div>

      {/* ── KPI strip ── */}
      {!kpiLoading && kpis && (
        <div className="dashboard-kpi-strip">
          <KpiChip
            label="En curso"
            value={fmtNum(kpis.en_curso ?? 0)}
            icon={<Activity size={14} />}
            variant="info"
            delta={delta('en_curso')}
          />
          <KpiChip
            label="Pendientes"
            value={fmtNum(kpis.pendientes ?? 0)}
            icon={<Clock size={14} />}
            variant={Number(kpis.pendientes) > 0 ? 'warning' : 'default'}
            delta={delta('pendientes')}
          />
          <KpiChip
            label="Sin facturar"
            value={fmtNum(kpis.finalizados_sin_factura ?? 0)}
            icon={<FileWarning size={14} />}
            variant={Number(kpis.finalizados_sin_factura) > 0 ? 'warning' : 'default'}
            delta={delta('finalizados_sin_factura')}
          />
          <KpiChip
            label="Total facturado"
            value={fmt(kpis.total_facturado ?? 0)}
            icon={<CreditCard size={14} />}
            variant="success"
            delta={delta('total_facturado')}
          />
          <KpiChip
            label="Total cobrado"
            value={fmt(kpis.total_cobrado ?? 0)}
            icon={<CheckCircle size={14} />}
            variant="success"
            delta={delta('total_cobrado')}
          />
          <KpiChip
            label="Pendiente cobro"
            value={fmt(kpis.pendiente_cobro ?? 0)}
            icon={<TrendingUp size={14} />}
            variant={Number(kpis.pendiente_cobro) > 0 ? 'warning' : 'default'}
            delta={delta('pendiente_cobro')}
          />
          {Number(kpis.facturas_vencidas) > 0 && (
            <KpiChip
              label="Facturas vencidas"
              value={fmtNum(kpis.facturas_vencidas)}
              icon={<AlertTriangle size={14} />}
              variant="danger"
              delta={delta('facturas_vencidas')}
            />
          )}
          {Number(kpis.informes_caducados) > 0 && (
            <KpiChip
              label="Inf. caducados"
              value={fmtNum(kpis.informes_caducados)}
              icon={<TrendingDown size={14} />}
              variant="danger"
              delta={delta('informes_caducados')}
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
