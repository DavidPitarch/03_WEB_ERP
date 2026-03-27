import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Comercial {
  id: string;
  nombre: string;
  apellidos: string | null;
  tipo_identificacion: string;
  nif: string | null;
  telefono: string | null;
  fax: string | null;
  email: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  usuario_intranet: string | null;
  email_app: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export function useComerciales(filters?: { activo?: boolean; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.activo !== undefined) params.set('activo', String(filters.activo));
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['comerciales', filters],
    queryFn: () => api.get<Comercial[]>(`/comerciales${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateComercial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Comercial>) => api.post<Comercial>('/comerciales', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comerciales'] }),
  });
}

export function useUpdateComercial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Comercial> & { id: string }) =>
      api.put<Comercial>(`/comerciales/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comerciales'] }),
  });
}

export function useDeleteComercial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/comerciales/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comerciales'] }),
  });
}
