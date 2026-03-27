import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TipoSiniestro {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export function useTiposSiniestro(activo?: boolean) {
  const params = activo !== undefined ? `?activo=${activo}` : '';
  return useQuery({
    queryKey: ['tipos-siniestro', activo],
    queryFn: () => api.get<TipoSiniestro[]>(`/tipos-siniestro${params}`),
  });
}

export function useCreateTipoSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; color?: string; orden?: number }) =>
      api.post<TipoSiniestro>('/tipos-siniestro', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-siniestro'] }),
  });
}

export function useUpdateTipoSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<TipoSiniestro> & { id: string }) =>
      api.put<TipoSiniestro>(`/tipos-siniestro/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-siniestro'] }),
  });
}

export function useDeleteTipoSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/tipos-siniestro/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-siniestro'] }),
  });
}
