import { useQuery } from '@tanstack/react-query';
import type { GeoOperario } from '@erp/types';
import { supabase } from '@/lib/supabase';

interface GeoOperariosResponse {
  data: GeoOperario[];
  error: null;
}

export function useGeoOperarios(gremio?: string) {
  return useQuery<GeoOperariosResponse>({
    queryKey: ['geo-operarios', gremio],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = new URLSearchParams();
      if (gremio) params.set('gremio', gremio);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/planning/geo/operarios?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error al cargar operarios geo');
      return res.json();
    },
    staleTime: 60_000,
  });
}
