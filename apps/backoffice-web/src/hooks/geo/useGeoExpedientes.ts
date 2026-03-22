import { useQuery } from '@tanstack/react-query';
import type { GeoExpediente, GeoMapFilters } from '@erp/types';
import { supabase } from '@/lib/supabase';

interface GeoExpedientesResponse {
  data: GeoExpediente[];
  meta: {
    total: number;
    unassigned_count: number;
    alert_count: number;
  };
  error: null;
}

function buildParams(filters: Partial<GeoMapFilters>, bbox?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.estado?.length)     p.set('estado', filters.estado.join(','));
  if (filters.prioridad?.length)  p.set('prioridad', filters.prioridad.join(','));
  if (filters.operario_id)        p.set('operario_id', filters.operario_id);
  if (filters.compania_id)        p.set('compania_id', filters.compania_id);
  if (filters.gremio)             p.set('gremio', filters.gremio);
  if (filters.fecha_ini)          p.set('fecha_ini', filters.fecha_ini);
  if (filters.fecha_fin)          p.set('fecha_fin', filters.fecha_fin);
  if (bbox)                       p.set('bbox', bbox);
  return p;
}

export function useGeoExpedientes(
  filters: Partial<GeoMapFilters> = {},
  bbox?: string
) {
  return useQuery<GeoExpedientesResponse>({
    queryKey: ['geo-expedientes', filters, bbox],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = buildParams(filters, bbox);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/planning/geo/expedientes?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error al cargar expedientes geo');
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
