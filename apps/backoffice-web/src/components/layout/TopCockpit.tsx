import { COCKPIT_MODULES } from '@/navigation/nav-config';
import { useCockpit } from '@/hooks/useCockpit';
import { CockpitModule } from './CockpitModule';

/**
 * Strip de cockpit operativo superior.
 * Muestra 3 módulos (Asignaciones, Solicitudes, Trabajos no revisados)
 * con sus contadores, feeds recientes y filtros rápidos.
 */
export function TopCockpit() {
  const { feed, isLoading } = useCockpit();

  return (
    <div className="top-cockpit">
      {COCKPIT_MODULES.map((config) => (
        <CockpitModule
          key={config.id}
          config={config}
          data={feed[config.feedKey]}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
