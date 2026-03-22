import { ChevronUp, ChevronDown, Gauge } from 'lucide-react';
import { COCKPIT_MODULES } from '@/navigation/nav-config';
import { useCockpit } from '@/hooks/useCockpit';
import { CockpitModule } from './CockpitModule';

interface TopCockpitProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Strip de cockpit operativo superior.
 * Muestra 3 módulos grandes (Asignaciones, Solicitudes, Trabajos no revisados)
 * con sus contadores, feeds recientes y filtros rápidos.
 */
export function TopCockpit({ collapsed, onToggle }: TopCockpitProps) {
  const { feed, isLoading } = useCockpit();

  return (
    <>
      {/* Barra de control del cockpit */}
      <div className="cockpit-bar">
        <div className="cockpit-bar__label">
          <Gauge size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Cockpit operativo
        </div>
        <button
          className="cockpit-bar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir cockpit' : 'Colapsar cockpit'}
          type="button"
        >
          {collapsed ? (
            <>Mostrar <ChevronDown size={12} /></>
          ) : (
            <>Ocultar <ChevronUp size={12} /></>
          )}
        </button>
      </div>

      {/* Los 3 módulos */}
      <div className={`top-cockpit${collapsed ? ' cockpit--collapsed' : ''}`}>
        {COCKPIT_MODULES.map((config) => (
          <CockpitModule
            key={config.id}
            config={config}
            data={feed[config.feedKey]}
            isLoading={isLoading}
          />
        ))}
      </div>
    </>
  );
}
