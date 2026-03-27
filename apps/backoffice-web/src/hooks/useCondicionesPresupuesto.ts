import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CondicionPresupuesto {
  id: string;
  compania_id: string | null;
  titulo: string;
  contenido: string;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export function useCondicionesPresupuesto(activa?: boolean) {
  const params = new URLSearchParams();
  if (activa !== undefined) params.set('activa', String(activa));
  const qs = params.toString();
  return useQuery({
    queryKey: ['condiciones-presupuesto', activa],
    queryFn: () => api.get<CondicionPresupuesto[]>(`/condiciones-presupuesto${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateCondicion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CondicionPresupuesto>) => api.post<CondicionPresupuesto>('/condiciones-presupuesto', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['condiciones-presupuesto'] }),
  });
}

export function useUpdateCondicion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CondicionPresupuesto> & { id: string }) =>
      api.put<CondicionPresupuesto>(`/condiciones-presupuesto/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['condiciones-presupuesto'] }),
  });
}

export function useDeleteCondicion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/condiciones-presupuesto/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['condiciones-presupuesto'] }),
  });
}
