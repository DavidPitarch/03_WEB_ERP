import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildQs(filters: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useDashboardKpis(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['dashboard-kpis', filters],
    queryFn: () => api.get(`/dashboard/kpis${buildQs(filters)}`),
    refetchInterval: 60_000,
  });
}

export function useRentabilidad(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['dashboard-rentabilidad', filters],
    queryFn: () => api.get(`/dashboard/rentabilidad${buildQs(filters)}`),
  });
}

export function useRentabilidadPorCompania() {
  return useQuery({
    queryKey: ['dashboard-rentabilidad-compania'],
    queryFn: () => api.get('/dashboard/rentabilidad/por-compania'),
  });
}

export function useRentabilidadPorOperario() {
  return useQuery({
    queryKey: ['dashboard-rentabilidad-operario'],
    queryFn: () => api.get('/dashboard/rentabilidad/por-operario'),
  });
}

export function useProductividad() {
  return useQuery({
    queryKey: ['dashboard-productividad'],
    queryFn: () => api.get('/dashboard/productividad'),
  });
}

export function useCompaniasKpisMes() {
  return useQuery({
    queryKey: ['dashboard-companias-kpis-mes'],
    queryFn: () => api.get('/dashboard/companias/kpis-mes'),
    refetchInterval: 60_000,
  });
}

export function useFacturacionReporting(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['dashboard-facturacion', filters],
    queryFn: () => api.get(`/dashboard/facturacion${buildQs(filters)}`),
  });
}
