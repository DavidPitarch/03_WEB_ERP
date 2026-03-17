import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAlertas(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString();
  return useQuery({
    queryKey: ['alertas', filters],
    queryFn: () => api.get<any[]>(`/alertas${params ? `?${params}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useAlertasCount() {
  return useQuery({
    queryKey: ['alertas-count'],
    queryFn: () => api.get<{ count: number }>('/alertas/count'),
    refetchInterval: 30_000,
  });
}

export function usePosponerAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hasta }: { id: string; hasta: string }) =>
      api.post<any>(`/alertas/${id}/posponer`, { hasta }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['alertas-count'] });
    },
  });
}

export function useResolverAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<any>(`/alertas/${id}/resolver`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['alertas-count'] });
    },
  });
}

export function useDescartarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<any>(`/alertas/${id}/descartar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['alertas-count'] });
    },
  });
}

export function useGenerarAlertas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ created: number; skipped: number }>('/alertas/generate', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] });
      qc.invalidateQueries({ queryKey: ['alertas-count'] });
    },
  });
}
