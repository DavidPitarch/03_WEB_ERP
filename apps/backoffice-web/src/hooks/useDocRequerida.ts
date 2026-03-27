import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DocRequeridaTipo {
  id: string;
  nombre: string;
  descripcion: string | null;
  dias_vigencia: number | null;
  obligatorio: boolean;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export function useDocRequerida(activo?: boolean) {
  const params = activo !== undefined ? `?activo=${activo}` : '';
  return useQuery({
    queryKey: ['doc-requerida', activo],
    queryFn: () => api.get<DocRequeridaTipo[]>(`/doc-requerida${params}`),
  });
}

export function useCreateDocRequerida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DocRequeridaTipo>) => api.post<DocRequeridaTipo>('/doc-requerida', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-requerida'] }),
  });
}

export function useUpdateDocRequerida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<DocRequeridaTipo> & { id: string }) =>
      api.put<DocRequeridaTipo>(`/doc-requerida/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-requerida'] }),
  });
}

export function useDeleteDocRequerida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/doc-requerida/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-requerida'] }),
  });
}
