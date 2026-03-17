import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Expediente, PaginatedResult, ExpedienteFilters } from '@erp/types';

export function useExpedientes(filters: ExpedienteFilters & { page?: number; per_page?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.compania_id) params.set('compania_id', filters.compania_id);
  if (filters.search) params.set('search', filters.search);
  if (filters.prioridad) params.set('prioridad', filters.prioridad);

  const qs = params.toString();
  return useQuery({
    queryKey: ['expedientes', filters],
    queryFn: () => api.get<PaginatedResult<Expediente>>(`/expedientes${qs ? `?${qs}` : ''}`),
  });
}

export function useExpediente(id: string) {
  return useQuery({
    queryKey: ['expediente', id],
    queryFn: () => api.get<Expediente>(`/expedientes/${id}`),
    enabled: !!id,
  });
}

export function useExpedienteTimeline(id: string) {
  return useQuery({
    queryKey: ['expediente-timeline', id],
    queryFn: () => api.get<unknown[]>(`/expedientes/${id}/timeline`),
    enabled: !!id,
  });
}

export function useExpedientePartes(id: string) {
  return useQuery({
    queryKey: ['expediente-partes', id],
    queryFn: () => api.get<unknown[]>(`/expedientes/${id}/partes`),
    enabled: !!id,
  });
}

export function useTransicionEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado_nuevo, motivo }: { id: string; estado_nuevo: string; motivo?: string }) =>
      api.post(`/expedientes/${id}/transicion`, { estado_nuevo, motivo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['expediente', vars.id] });
      qc.invalidateQueries({ queryKey: ['expediente-timeline', vars.id] });
      qc.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}
