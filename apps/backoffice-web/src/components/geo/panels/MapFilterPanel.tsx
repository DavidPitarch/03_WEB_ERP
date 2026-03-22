/**
 * Panel de filtros del mapa geográfico.
 * Collapsible, montado a la izquierda del mapa.
 */

import { X } from 'lucide-react';
import type { GeoMapFilters, GeoOperario } from '@erp/types';

const ESTADOS = [
  { value: 'NUEVO',            label: 'Nuevo' },
  { value: 'NO_ASIGNADO',      label: 'Sin asignar' },
  { value: 'EN_PLANIFICACION', label: 'Planificación' },
  { value: 'EN_CURSO',         label: 'En curso' },
  { value: 'PENDIENTE',        label: 'Pendiente' },
];

const PRIORIDADES = [
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta',    label: 'Alta' },
  { value: 'media',   label: 'Media' },
  { value: 'baja',    label: 'Baja' },
];

interface MapFilterPanelProps {
  filters: Partial<GeoMapFilters>;
  operarios: GeoOperario[];
  onChange: (f: Partial<GeoMapFilters>) => void;
  onClose: () => void;
  meta?: { total: number; unassigned_count: number; alert_count: number };
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function MapFilterPanel({ filters, operarios, onChange, onClose, meta }: MapFilterPanelProps) {
  const estados    = filters.estado    ?? [];
  const prioridades = filters.prioridad ?? [];

  return (
    <aside className="geo-filter-panel">
      <div className="geo-filter-panel__header">
        <span className="geo-filter-panel__title">Filtros</span>
        <button onClick={onClose} className="geo-filter-panel__close" type="button">
          <X size={14} />
        </button>
      </div>

      {meta && (
        <div className="geo-filter-panel__meta">
          <span className="geo-meta-chip geo-meta-chip--default">{meta.total} exp.</span>
          <span className="geo-meta-chip geo-meta-chip--warning">{meta.unassigned_count} sin asignar</span>
          <span className="geo-meta-chip geo-meta-chip--danger">{meta.alert_count} alertas</span>
        </div>
      )}

      <div className="geo-filter-panel__section">
        <div className="geo-filter-panel__section-label">Estado</div>
        {ESTADOS.map((e) => (
          <label key={e.value} className="geo-filter-checkbox">
            <input
              type="checkbox"
              checked={estados.includes(e.value)}
              onChange={() => onChange({ ...filters, estado: toggle(estados, e.value) })}
            />
            {e.label}
          </label>
        ))}
      </div>

      <div className="geo-filter-panel__section">
        <div className="geo-filter-panel__section-label">Prioridad</div>
        {PRIORIDADES.map((p) => (
          <label key={p.value} className="geo-filter-checkbox">
            <input
              type="checkbox"
              checked={prioridades.includes(p.value)}
              onChange={() => onChange({ ...filters, prioridad: toggle(prioridades, p.value) })}
            />
            {p.label}
          </label>
        ))}
      </div>

      <div className="geo-filter-panel__section">
        <div className="geo-filter-panel__section-label">Operario</div>
        <select
          className="geo-filter-select"
          value={filters.operario_id ?? ''}
          onChange={(e) => onChange({ ...filters, operario_id: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {operarios.map((op) => (
            <option key={op.id} value={op.id}>
              {op.nombre} {op.apellidos}
              {op.overloaded ? ' ⚠' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="geo-filter-panel__section">
        <div className="geo-filter-panel__section-label">Fecha encargo</div>
        <div className="geo-filter-date-row">
          <input
            type="date"
            className="geo-filter-date"
            value={filters.fecha_ini ?? ''}
            onChange={(e) => onChange({ ...filters, fecha_ini: e.target.value || undefined })}
          />
          <span>—</span>
          <input
            type="date"
            className="geo-filter-date"
            value={filters.fecha_fin ?? ''}
            onChange={(e) => onChange({ ...filters, fecha_fin: e.target.value || undefined })}
          />
        </div>
      </div>

      <div className="geo-filter-panel__section">
        <label className="geo-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.solo_sin_asignar ?? false}
            onChange={(e) => onChange({ ...filters, solo_sin_asignar: e.target.checked })}
          />
          Solo sin asignar
        </label>
        <label className="geo-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.solo_urgentes ?? false}
            onChange={(e) => onChange({ ...filters, solo_urgentes: e.target.checked })}
          />
          Solo urgentes / SLA riesgo
        </label>
      </div>

      <button
        className="btn btn--ghost btn--sm"
        style={{ marginTop: 8, width: '100%' }}
        type="button"
        onClick={() => onChange({})}
      >
        Limpiar filtros
      </button>
    </aside>
  );
}
