import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AutoVisitasConfig {
  empresa_id: string;
  activo: boolean;
  horas_aviso_previo: number;
  max_cambios_cita: number;
  permitir_cancelacion: boolean;
  horas_min_cancelacion: number;
  config_operarios: Record<string, unknown>;
  config_companias: Record<string, unknown>;
  updated_at?: string;
}

export function useAutoVisitasConfig(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['auto-visitas', empresaId],
    queryFn: () => api.get<AutoVisitasConfig>(`/auto-visitas/${empresaId}`),
    enabled: !!empresaId,
  });
}

export function useUpdateAutoVisitas(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AutoVisitasConfig>) => api.put<AutoVisitasConfig>(`/auto-visitas/${empresaId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-visitas', empresaId] }),
  });
}
