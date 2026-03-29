import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { CockpitModuleConfig, CockpitModuleData, CockpitFeedItem } from '@/navigation/types';

interface CockpitModuleProps {
  config: CockpitModuleConfig;
  data: CockpitModuleData;
  isLoading: boolean;
}

/** Resuelve un icono de Lucide por nombre de forma segura. */
function DynamicIcon({ name, size = 14 }: { name: string; size?: number }) {
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

/** Badge de SLA con fecha y color semafórico */
function SlaBadge({ item }: { item: CockpitFeedItem }) {
  if (!item.sla_estado) return <PriorityBadge value={item.prioridad ?? item.etiqueta} />;
  return (
    <span className={`cockpit-item__badge cockpit-item__badge--sla-${item.sla_estado}`}>
      {item.sla_vencimiento ?? item.etiqueta}
    </span>
  );
}

export function CockpitModule({ config, data, isLoading }: CockpitModuleProps) {
  const [hoveredItem, setHoveredItem] = useState<CockpitFeedItem | null>(null);

  const displayItems = data.items.slice(0, 3);

  return (
    <div className={`cockpit-module cockpit-module--${config.variant}`}>
      {/* ── Header compacto ── */}
      <div className="cockpit-module__header">
        <div className="cockpit-module__icon">
          <DynamicIcon name={config.icon} size={14} />
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

        <Link to={config.path} className="cockpit-module__see-all">
          Ver todos <ArrowRight size={10} />
        </Link>
      </div>

      {/* ── Lista (máx. 3 items) ── */}
      <div className="cockpit-module__list">
        {isLoading ? (
          <SkeletonList />
        ) : displayItems.length === 0 ? (
          <div className="cockpit-module__empty">Sin expedientes</div>
        ) : (
          displayItems.map((item) => (
            <Link
              key={item.id}
              to={item.detailPath}
              className="cockpit-item"
              onMouseEnter={() => item.asegurado_nombre ? setHoveredItem(item) : undefined}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span className="cockpit-item__numero">{item.numero}</span>
              <span className="cockpit-item__info">
                {[item.tipo, item.localidad].filter(Boolean).join(' · ')}
              </span>
              {item.sla_estado
                ? <SlaBadge item={item} />
                : <PriorityBadge value={item.prioridad ?? item.etiqueta} />
              }
            </Link>
          ))
        )}
      </div>

      {/* ── Tooltip de asegurado (solo módulo Solicitudes/Avisos) ── */}
      {hoveredItem && hoveredItem.asegurado_nombre && (
        <div className="cockpit-module__tooltip">
          <div className="cockpit-tooltip__num">{hoveredItem.numero}</div>
          <div className="cockpit-tooltip__name">{hoveredItem.asegurado_nombre}</div>
          {hoveredItem.direccion_completa && (
            <div className="cockpit-tooltip__addr">{hoveredItem.direccion_completa}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="cockpit-skeleton">
      {[70, 55, 65].map((w, i) => (
        <div
          key={i}
          className="cockpit-skeleton__line"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}
