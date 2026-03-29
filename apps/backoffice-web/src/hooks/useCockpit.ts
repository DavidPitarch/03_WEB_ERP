import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CockpitFeed, CockpitModuleData } from '@/navigation/types';

const EMPTY_MODULE: CockpitModuleData = { total: 0, criticos: 0, items: [] };

const EMPTY_FEED: CockpitFeed = {
  asignaciones:          EMPTY_MODULE,
  solicitudes:           EMPTY_MODULE,
  trabajos_no_revisados: EMPTY_MODULE,
  tareas_caducadas:      EMPTY_MODULE,
};

/**
 * Obtiene el feed completo del cockpit operativo superior.
 * Endpoint: GET /api/v1/cockpit/feed
 *
 * Refresca cada 30 segundos para mantener los 3 módulos actualizados.
 * Cuando el endpoint no existe todavía, devuelve datos vacíos de forma segura.
 */
export function useCockpit(activeFilter?: Record<string, string>) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cockpit-feed', activeFilter],
    queryFn: async () => {
      const params = activeFilter
        ? '?' + new URLSearchParams(activeFilter).toString()
        : '';
      return api.get<CockpitFeed>(`/cockpit/feed${params}`);
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
    // No crashear si el endpoint aún no existe
    retry: 1,
  });

  const feed: CockpitFeed =
    data && 'data' in data && data.data ? data.data : EMPTY_FEED;

  return {
    feed,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * Obtiene solo los datos de un módulo específico del cockpit.
 * Útil si se quiere cargar de forma independiente por módulo.
 */
export function useCockpitModule(
  moduleId: 'asignaciones' | 'solicitudes' | 'trabajos_no_revisados' | 'tareas_caducadas',
  filter?: string,
) {
  const { feed, isLoading, isError } = useCockpit(filter ? { filter } : undefined);
  return { data: feed[moduleId], isLoading, isError };
}
