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

export function useProveedores(filters: { activo?: boolean; search?: string } = {}) {
  return useQuery({
    queryKey: ['proveedores', filters],
    queryFn: () => api.get(`/proveedores${buildQs(filters)}`),
  });
}

export function useCrearProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/proveedores', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });
}

export function useUpdateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.put(`/proveedores/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });
}
