import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CentralitaConfig {
  empresa_id: string;
  proveedor: string | null;
  config: Record<string, unknown>;
  activa: boolean;
  updated_at?: string;
}

export interface CentralitaLlamada {
  id: string;
  compania_id: string | null;
  origen: string | null;
  destino: string | null;
  tipo: 'entrante' | 'saliente' | 'perdida';
  duracion_segundos: number | null;
  expediente_id: string | null;
  usuario_id: string | null;
  iniciada_at: string;
  usuario?: { email: string } | null;
}

export function useCentralitaConfig(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['centralita-config', empresaId],
    queryFn: () => api.get<CentralitaConfig>(`/centralita/config/${empresaId}`),
    enabled: !!empresaId,
  });
}

export function useUpdateCentralitaConfig(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CentralitaConfig>) => api.put<CentralitaConfig>(`/centralita/config/${empresaId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centralita-config', empresaId] }),
  });
}

export function useCentralitaLlamadas(opts?: { tipo?: string; desde?: string; hasta?: string; search?: string; page?: number }) {
  const params = new URLSearchParams();
  if (opts?.tipo)   params.set('tipo', opts.tipo);
  if (opts?.desde)  params.set('desde', opts.desde);
  if (opts?.hasta)  params.set('hasta', opts.hasta);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.page)   params.set('page', String(opts.page));
  const qs = params.toString();
  return useQuery({
    queryKey: ['centralita-llamadas', opts],
    queryFn: () => api.get<CentralitaLlamada[]>(`/centralita/llamadas${qs ? `?${qs}` : ''}`),
  });
}
