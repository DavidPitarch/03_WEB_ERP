import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RgpdConfig {
  empresa_id: string;
  dias_conservacion_expedientes: number;
  dias_conservacion_comunicaciones: number;
  dias_conservacion_evidencias: number;
  dias_conservacion_facturas: number;
  texto_politica: string | null;
  updated_at?: string;
}

export interface RgpdEliminacion {
  id: string;
  entidad: string;
  entidad_id: string;
  motivo: string | null;
  actor_id: string | null;
  eliminado_at: string;
  actor?: { email: string } | null;
}

export function useRgpdConfig(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['rgpd-config', empresaId],
    queryFn: () => api.get<RgpdConfig>(`/rgpd/config/${empresaId}`),
    enabled: !!empresaId,
  });
}

export function useUpdateRgpdConfig(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<RgpdConfig>) => api.put<RgpdConfig>(`/rgpd/config/${empresaId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rgpd-config', empresaId] }),
  });
}

export function useRgpdEliminaciones(page = 1) {
  return useQuery({
    queryKey: ['rgpd-eliminaciones', page],
    queryFn: () => api.get<RgpdEliminacion[]>(`/rgpd/eliminaciones?page=${page}`),
  });
}

export function useCreateRgpdEliminacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { entidad: string; entidad_id: string; motivo?: string }) =>
      api.post<RgpdEliminacion>('/rgpd/eliminaciones', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rgpd-eliminaciones'] }),
  });
}
