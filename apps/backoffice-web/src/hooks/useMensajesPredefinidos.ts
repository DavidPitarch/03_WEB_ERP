import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MensajePredefinido {
  id: string;
  compania_id: string | null;
  nombre: string;
  tipo: 'sms' | 'email' | 'ambos';
  asunto: string | null;
  contenido: string;
  variables: string[];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export function useMensajesPredefinidos(opts?: { activo?: boolean; tipo?: string }) {
  const params = new URLSearchParams();
  if (opts?.activo !== undefined) params.set('activo', String(opts.activo));
  if (opts?.tipo) params.set('tipo', opts.tipo);
  const qs = params.toString();
  return useQuery({
    queryKey: ['mensajes-predefinidos', opts],
    queryFn: () => api.get<MensajePredefinido[]>(`/mensajes-predefinidos${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateMensaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MensajePredefinido>) => api.post<MensajePredefinido>('/mensajes-predefinidos', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mensajes-predefinidos'] }),
  });
}

export function useUpdateMensaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<MensajePredefinido> & { id: string }) =>
      api.put<MensajePredefinido>(`/mensajes-predefinidos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mensajes-predefinidos'] }),
  });
}

export function useDeleteMensaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/mensajes-predefinidos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mensajes-predefinidos'] }),
  });
}
