import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Especialidad {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export function useEspecialidades(activa?: boolean) {
  const params = activa !== undefined ? `?activa=${activa}` : '';
  return useQuery({
    queryKey: ['especialidades', activa],
    queryFn: () => api.get<Especialidad[]>(`/especialidades${params}`),
  });
}

export function useCreateEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; codigo?: string; descripcion?: string; orden?: number }) =>
      api.post<Especialidad>('/especialidades', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especialidades'] }),
  });
}

export function useUpdateEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Especialidad> & { id: string }) =>
      api.put<Especialidad>(`/especialidades/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especialidades'] }),
  });
}

export function useDeleteEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/especialidades/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especialidades'] }),
  });
}
