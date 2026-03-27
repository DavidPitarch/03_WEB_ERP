import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Festivo {
  id: string;
  fecha: string;
  nombre: string;
  ambito: 'nacional' | 'autonomico' | 'provincial' | 'local' | 'empresa';
  comunidad_autonoma: string | null;
  provincia: string | null;
  municipio: string | null;
}

export function useFestivos(anio: number) {
  return useQuery({
    queryKey: ['festivos', anio],
    queryFn: () => api.get<Festivo[]>(`/festivos?anio=${anio}`),
  });
}

export function useCreateFestivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha: string; nombre: string; ambito?: string; comunidad_autonoma?: string; provincia?: string }) =>
      api.post<Festivo>('/festivos', data),
    onSuccess: (_d, vars) => {
      const anio = parseInt(vars.fecha.slice(0, 4));
      qc.invalidateQueries({ queryKey: ['festivos', anio] });
    },
  });
}

export function useDeleteFestivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/festivos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['festivos'] }),
  });
}
