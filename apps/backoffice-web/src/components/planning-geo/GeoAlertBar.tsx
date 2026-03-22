import { AlertTriangle, X } from 'lucide-react';
import type { GeoExpedientesMeta } from '@/hooks/usePlanningGeo';

interface GeoAlertBarProps {
  meta: GeoExpedientesMeta | null;
  ungeocodedCount: number;
  overloadedCount: number;
  onDismiss?: () => void;
}

export function GeoAlertBar({ meta, ungeocodedCount, overloadedCount, onDismiss }: GeoAlertBarProps) {
  const alerts: { msg: string; sev: 'warning' | 'critical' }[] = [];

  if (meta && meta.unassigned_count > 0) {
    alerts.push({ msg: `${meta.unassigned_count} expediente${meta.unassigned_count > 1 ? 's' : ''} sin asignar`, sev: 'warning' });
  }
  if (meta && meta.alert_count > 0) {
    alerts.push({ msg: `${meta.alert_count} con SLA vencido o urgente`, sev: 'critical' });
  }
  if (overloadedCount > 0) {
    alerts.push({ msg: `${overloadedCount} operario${overloadedCount > 1 ? 's' : ''} con sobrecarga`, sev: 'critical' });
  }
  if (ungeocodedCount > 0) {
    alerts.push({ msg: `${ungeocodedCount} expediente${ungeocodedCount > 1 ? 's' : ''} sin geolocalizar`, sev: 'warning' });
  }

  if (!alerts.length) return null;

  const hasCritical = alerts.some((a) => a.sev === 'critical');

  return (
    <div className={`geo-alert-bar geo-alert-bar--${hasCritical ? 'critical' : 'warning'}`}>
      <AlertTriangle size={14} className="geo-alert-bar__icon" />
      <div className="geo-alert-bar__msgs">
        {alerts.map((a, i) => (
          <span key={i} className={`geo-alert-bar__item geo-alert-bar__item--${a.sev}`}>
            {a.msg}
          </span>
        ))}
      </div>
      {onDismiss && (
        <button className="geo-alert-bar__dismiss" onClick={onDismiss} title="Cerrar">
          <X size={12} />
        </button>
      )}
    </div>
  );
}
