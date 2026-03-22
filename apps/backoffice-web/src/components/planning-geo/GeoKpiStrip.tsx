import { MapPin, AlertTriangle, Users, Percent } from 'lucide-react';
import type { GeoExpedientesMeta, GeoOperario } from '@/hooks/usePlanningGeo';

interface GeoKpiStripProps {
  meta: GeoExpedientesMeta | null;
  totalExpedientes: number;
  ungeocodedCount: number;
  operarios: GeoOperario[];
}

export function GeoKpiStrip({ meta, totalExpedientes, ungeocodedCount, operarios }: GeoKpiStripProps) {
  const geolocalizados = totalExpedientes - ungeocodedCount;
  const pctGeo = totalExpedientes > 0 ? Math.round((geolocalizados / totalExpedientes) * 100) : 0;
  const sobrecargados = operarios.filter((o) => o.overloaded).length;

  return (
    <div className="geo-kpi-strip">
      <KpiCard
        icon={<MapPin size={14} />}
        label="Geolocalizados"
        value={`${geolocalizados} / ${totalExpedientes}`}
        sub={`${pctGeo}%`}
        variant={pctGeo < 80 ? 'warning' : 'ok'}
      />
      <KpiCard
        icon={<AlertTriangle size={14} />}
        label="Sin asignar"
        value={String(meta?.unassigned_count ?? 0)}
        variant={(meta?.unassigned_count ?? 0) > 0 ? 'warning' : 'ok'}
      />
      <KpiCard
        icon={<AlertTriangle size={14} />}
        label="SLA crítico"
        value={String(meta?.alert_count ?? 0)}
        variant={(meta?.alert_count ?? 0) > 0 ? 'critical' : 'ok'}
      />
      <KpiCard
        icon={<Users size={14} />}
        label="Operarios sobrecargados"
        value={String(sobrecargados)}
        variant={sobrecargados > 0 ? 'critical' : 'ok'}
      />
      <KpiCard
        icon={<Percent size={14} />}
        label="Cobertura geo"
        value={`${pctGeo}%`}
        variant={pctGeo < 80 ? 'warning' : 'ok'}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant: 'ok' | 'warning' | 'critical';
}) {
  return (
    <div className={`geo-kpi-card geo-kpi-card--${variant}`}>
      <span className="geo-kpi-card__icon">{icon}</span>
      <div className="geo-kpi-card__body">
        <div className="geo-kpi-card__value">{value}{sub && <span className="geo-kpi-card__sub">&nbsp;{sub}</span>}</div>
        <div className="geo-kpi-card__label">{label}</div>
      </div>
    </div>
  );
}
