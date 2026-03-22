import { useQuery } from '@tanstack/react-query';
import type { HeatPoint } from '@erp/types';
import { supabase } from '@/lib/supabase';

export function useHeatmap() {
  return useQuery<{ data: HeatPoint[]; error: null }>({
    queryKey: ['geo-heatmap'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/planning/geo/heatmap`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error al cargar heatmap');
      return res.json();
    },
    staleTime: 120_000,
  });
}
