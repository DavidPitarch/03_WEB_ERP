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

export function useFacturasPendientes(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['facturas-pendientes', filters],
    queryFn: () => api.get(`/facturas/pendientes${buildQs(filters)}`),
  });
}

export function useFacturasCaducadas(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['facturas-caducadas', filters],
    queryFn: () => api.get(`/facturas/caducadas${buildQs(filters)}`),
  });
}

export function useFacturas(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['facturas', filters],
    queryFn: () => api.get(`/facturas${buildQs(filters)}`),
    refetchInterval: 30_000,
  });
}

export function useFacturaDetail(id: string) {
  return useQuery({
    queryKey: ['factura', id],
    queryFn: () => api.get(`/facturas/${id}`),
    enabled: !!id,
  });
}

export function useEmitirFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/facturas/emitir', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas-pendientes'] });
    },
  });
}

export function useEnviarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/facturas/${id}/enviar`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['factura', id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    },
  });
}

export function useRegistrarCobro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/facturas/${id}/registrar-cobro`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['factura', vars.id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas-caducadas'] });
    },
  });
}

export function useReclamarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/facturas/${id}/reclamar`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['factura', vars.id] });
      qc.invalidateQueries({ queryKey: ['facturas-caducadas'] });
    },
  });
}

export function useAnularFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/facturas/${id}/anular`, { motivo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['factura', vars.id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    },
  });
}

export function useSeries(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['facturas-series', filters],
    queryFn: () => api.get(`/facturas/series${buildQs(filters)}`),
  });
}

export function useCrearSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/facturas/series', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas-series'] });
    },
  });
}
