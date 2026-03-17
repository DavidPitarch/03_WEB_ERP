import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildQs(filters: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useOperariosLiquidables(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['autofacturas-liquidables', filters],
    queryFn: () => api.get(`/autofacturas/liquidables${buildQs(filters)}`),
  });
}

export function useAutofacturas(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['autofacturas', filters],
    queryFn: () => api.get(`/autofacturas${buildQs(filters)}`),
  });
}

export function useAutofacturaDetail(id: string) {
  return useQuery({
    queryKey: ['autofactura', id],
    queryFn: () => api.get(`/autofacturas/${id}`),
    enabled: !!id,
  });
}

export function useGenerarAutofactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/autofacturas/generar', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autofacturas'] });
      qc.invalidateQueries({ queryKey: ['autofacturas-liquidables'] });
    },
  });
}

export function useRevisarAutofactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/autofacturas/${id}/revisar`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['autofactura', id] });
      qc.invalidateQueries({ queryKey: ['autofacturas'] });
    },
  });
}

export function useEmitirAutofactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/autofacturas/${id}/emitir`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['autofactura', id] });
      qc.invalidateQueries({ queryKey: ['autofacturas'] });
    },
  });
}

export function useAnularAutofactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/autofacturas/${id}/anular`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['autofactura', id] });
      qc.invalidateQueries({ queryKey: ['autofacturas'] });
    },
  });
}
