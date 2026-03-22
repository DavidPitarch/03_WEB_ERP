import { RotateCcw, Thermometer, Layers, Route } from 'lucide-react';
import type { GeoFilters } from '@/hooks/useGeoFilters';
import type { GeoOperario } from '@/hooks/usePlanningGeo';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const ESTADOS = [
  { value: 'NUEVO',            label: 'Nuevo' },
  { value: 'NO_ASIGNADO',      label: 'No asignado' },
  { value: 'EN_PLANIFICACION', label: 'En planificación' },
  { value: 'EN_CURSO',         label: 'En curso' },
  { value: 'PENDIENTE',        label: 'Pendiente' },
];

const PRIORIDADES = [
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta',    label: 'Alta' },
  { value: 'media',   label: 'Media' },
  { value: 'baja',    label: 'Baja' },
];

const GREMIOS = [
  { value: 'fontaneria',    label: 'Fontanería' },
  { value: 'electricidad',  label: 'Electricidad' },
  { value: 'albanileria',   label: 'Albañilería' },
  { value: 'carpinteria',   label: 'Carpintería' },
  { value: 'pintura',       label: 'Pintura' },
  { value: 'cerrajeria',    label: 'Cerrajería' },
  { value: 'cristaleria',   label: 'Cristalería' },
  { value: 'climatizacion', label: 'Climatización' },
];

interface GeoFiltersPanelProps {
  filters: GeoFilters;
  operarios: GeoOperario[];
  onChange: (patch: Partial<GeoFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  totalShown: number;
}

export function GeoFiltersPanel({
  filters,
  operarios,
  onChange,
  onReset,
  hasActiveFilters,
  totalShown,
}: GeoFiltersPanelProps) {
  const { data: companies } = useQuery({
    queryKey: ['masters-companies-geo'],
    queryFn: () => api.get<{ companias: Array<{ id: string; nombre: string }> }>('/masters'),
    staleTime: 300_000,
    select: (res: any) => (res.data?.companias ?? []) as Array<{ id: string; nombre: string }>,
  });

  function toggleArray(key: 'estado' | 'prioridad', val: string) {
    const current = filters[key] as string[];
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    onChange({ [key]: next });
  }

  return (
    <aside className="geo-filters-panel">
      <div className="geo-filters-panel__header">
        <span className="geo-filters-panel__title">Filtros</span>
        <span className="geo-filters-panel__count">{totalShown} expedientes</span>
        {hasActiveFilters && (
          <button className="geo-filters-panel__reset" onClick={onReset} title="Borrar filtros">
            <RotateCcw size={12} />
          </button>
        )}
      </div>

      {/* ── Capas de visualización ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Capas</div>
        <label className="geo-toggle">
          <input
            type="checkbox"
            checked={filters.showHeatmap}
            onChange={(e) => onChange({ showHeatmap: e.target.checked })}
          />
          <Thermometer size={12} />
          Mapa de calor
        </label>
        <label className="geo-toggle">
          <input
            type="checkbox"
            checked={filters.showZonas}
            onChange={(e) => onChange({ showZonas: e.target.checked })}
          />
          <Layers size={12} />
          Zonas operarios
        </label>
        <label className="geo-toggle">
          <input
            type="checkbox"
            checked={filters.showRutas}
            onChange={(e) => onChange({ showRutas: e.target.checked })}
          />
          <Route size={12} />
          Rutas del día
        </label>
      </div>

      {/* ── Estado ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Estado</div>
        <div className="geo-chip-group">
          {ESTADOS.map((e) => (
            <button
              key={e.value}
              className={`geo-chip ${filters.estado.includes(e.value) ? 'geo-chip--active' : ''}`}
              onClick={() => toggleArray('estado', e.value)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Prioridad ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Prioridad</div>
        <div className="geo-chip-group">
          {PRIORIDADES.map((p) => (
            <button
              key={p.value}
              className={`geo-chip geo-chip--prio-${p.value} ${filters.prioridad.includes(p.value) ? 'geo-chip--active' : ''}`}
              onClick={() => toggleArray('prioridad', p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gremio ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Especialidad</div>
        <select
          className="geo-select"
          value={filters.gremio}
          onChange={(e) => onChange({ gremio: e.target.value })}
        >
          <option value="">Todas</option>
          {GREMIOS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
      </div>

      {/* ── Compañía ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Compañía</div>
        <select
          className="geo-select"
          value={filters.compania_id}
          onChange={(e) => onChange({ compania_id: e.target.value })}
        >
          <option value="">Todas</option>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* ── Operario ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Operario</div>
        <select
          className="geo-select"
          value={filters.operario_id}
          onChange={(e) => onChange({ operario_id: e.target.value })}
        >
          <option value="">Todos</option>
          {operarios.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre} {o.apellidos}
              {o.overloaded ? ' ⚠' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── Rango de fechas ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Fecha encargo</div>
        <input
          type="date"
          className="geo-input"
          value={filters.fecha_ini}
          onChange={(e) => onChange({ fecha_ini: e.target.value })}
          placeholder="Desde"
        />
        <input
          type="date"
          className="geo-input"
          value={filters.fecha_fin}
          onChange={(e) => onChange({ fecha_fin: e.target.value })}
          placeholder="Hasta"
          style={{ marginTop: '4px' }}
        />
      </div>

      {/* ── Leyenda ── */}
      <div className="geo-filter-group">
        <div className="geo-filter-group__label">Leyenda SLA</div>
        <div className="geo-legend">
          <div className="geo-legend__item">
            <span className="geo-legend__dot geo-legend__dot--ok" />
            En plazo
          </div>
          <div className="geo-legend__item">
            <span className="geo-legend__dot geo-legend__dot--urgente" />
            Urgente (&lt;24h)
          </div>
          <div className="geo-legend__item">
            <span className="geo-legend__dot geo-legend__dot--vencido" />
            Vencido
          </div>
          <div className="geo-legend__item">
            <span className="geo-legend__dot geo-legend__dot--op" />
            Operario
          </div>
        </div>
      </div>
    </aside>
  );
}
