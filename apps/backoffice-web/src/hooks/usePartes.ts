import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePartesPendientes() {
  return useQuery({
    queryKey: ['partes-pendientes'],
    queryFn: () => api.get<any[]>('/partes/pendientes'),
    refetchInterval: 30_000,
  });
}

export function useParteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['parte', id],
    queryFn: () => api.get<any>(`/partes/${id}`),
    enabled: !!id,
  });
}

export function useValidarParte() {
  return useMutation({
    mutationFn: (id: string) => api.post<any>(`/partes/${id}/validar`, {}),
  });
}

export function useRechazarParte() {
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post<any>(`/partes/${id}/rechazar`, { motivo }),
  });
}
