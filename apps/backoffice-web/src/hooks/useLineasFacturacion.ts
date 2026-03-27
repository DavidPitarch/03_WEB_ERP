import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LineaFacturacion {
  id: string;
  compania_id: string | null;
  codigo: string | null;
  descripcion: string;
  unidad: string;
  precio: number;
  tipo_iva: 'general' | 'reducido' | 'superreducido' | 'exento';
  porcentaje_iva: number;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  activa?: boolean;
  tipo_iva?: string;
  compania_id?: string;
  search?: string;
}

async function fetchLineas(opts: ListOpts = {}): Promise<LineaFacturacion[]> {
  const params = new URLSearchParams();
  if (opts.activa !== undefined) params.set('activa', String(opts.activa));
  if (opts.tipo_iva) params.set('tipo_iva', opts.tipo_iva);
  if (opts.compania_id) params.set('compania_id', opts.compania_id);
  if (opts.search) params.set('search', opts.search);
  const qs = params.toString();
  const res = await api.get<{ data: LineaFacturacion[] }>(`/lineas-facturacion${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export function useLineasFacturacion(opts: ListOpts = {}) {
  return useQuery({
    queryKey: ['lineas-facturacion', opts],
    queryFn: () => fetchLineas(opts),
  });
}

type CreatePayload = {
  descripcion: string;
  codigo?: string;
  unidad?: string;
  precio?: number;
  tipo_iva?: string;
  porcentaje_iva?: number;
  activa?: boolean;
  orden?: number;
  compania_id?: string;
};

export function useCreateLineaFacturacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayload) => api.post<{ data: LineaFacturacion }>('/lineas-facturacion', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lineas-facturacion'] }),
  });
}

export function useUpdateLineaFacturacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<LineaFacturacion> & { id: string }) =>
      api.put<{ data: LineaFacturacion }>(`/lineas-facturacion/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lineas-facturacion'] }),
  });
}

export function useDeleteLineaFacturacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/lineas-facturacion/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lineas-facturacion'] }),
  });
}
