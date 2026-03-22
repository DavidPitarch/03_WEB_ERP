import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { CockpitModuleConfig, CockpitModuleData } from '@/navigation/types';

interface CockpitModuleProps {
  config: CockpitModuleConfig;
  data: CockpitModuleData;
  isLoading: boolean;
}

/** Resuelve un icono de Lucide por nombre de forma segura. */
function DynamicIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

/** Chip de prioridad / estado */
function PriorityBadge({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span className={`cockpit-item__badge cockpit-item__badge--${value}`}>
      {value}
    </span>
  );
}

export function CockpitModule({ config, data, isLoading }: CockpitModuleProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredItems = activeFilter
    ? data.items.filter((i) =>
        i.prioridad === activeFilter ||
        i.estado   === activeFilter ||
        i.etiqueta === activeFilter,
      )
    : data.items;

  return (
    <div className={`cockpit-module cockpit-module--${config.variant}`}>
      {/* ── Header ── */}
      <div className="cockpit-module__header">
        <div className="cockpit-module__icon">
          <DynamicIcon name={config.icon} size={16} />
        </div>

        <div className="cockpit-module__title-group">
          <Link to={config.path} className="cockpit-module__title">
            {config.label}
          </Link>
          <div className="cockpit-module__meta">
            <span className="cockpit-module__count">
              {isLoading ? '—' : data.total}
            </span>
            {!isLoading && data.criticos > 0 && (
              <span className="cockpit-module__critical">
                {data.criticos} crítico{data.criticos !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Filtros rápidos ── */}
      {config.quickFilters.length > 0 && (
        <div className="cockpit-module__filters">
          <button
            className={`cockpit-filter-btn${!activeFilter ? ' active' : ''}`}
            onClick={() => setActiveFilter(null)}
          >
            Todos
          </button>
          {config.quickFilters.map((f) => (
            <button
              key={f.value}
              className={`cockpit-filter-btn${activeFilter === f.value ? ' active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === f.value ? null : f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Lista de items ── */}
      <div className="cockpit-module__list">
        {isLoading ? (
          <SkeletonList />
        ) : filteredItems.length === 0 ? (
          <div className="cockpit-module__empty">Sin expedientes</div>
        ) : (
          filteredItems.slice(0, 5).map((item) => (
            <Link key={item.id} to={item.detailPath} className="cockpit-item">
              <span className="cockpit-item__numero">{item.numero}</span>
              <span className="cockpit-item__info">
                {[item.tipo, item.localidad].filter(Boolean).join(' · ')}
              </span>
              <PriorityBadge value={item.prioridad ?? item.etiqueta} />
            </Link>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div className="cockpit-module__footer">
        <Link to={config.path} className="cockpit-module__see-all">
          Ver todos
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="cockpit-skeleton">
      {[70, 55, 65, 50].map((w, i) => (
        <div
          key={i}
          className="cockpit-skeleton__line"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}
