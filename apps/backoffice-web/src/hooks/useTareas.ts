import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTareas(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString();
  return useQuery({
    queryKey: ['tareas', filters],
    queryFn: () => api.get<any[]>(`/tareas${params ? `?${params}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useTareaMetricas() {
  return useQuery({
    queryKey: ['tareas-metricas'],
    queryFn: () => api.get<any>('/tareas/metricas'),
    refetchInterval: 60_000,
  });
}

export function useTareaComentarios(tareaId: string | undefined) {
  return useQuery({
    queryKey: ['tarea-comentarios', tareaId],
    queryFn: () => api.get<any[]>(`/tareas/${tareaId}/comentarios`),
    enabled: !!tareaId,
  });
}

export function useCrearTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<any>('/tareas', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
}

export function useActualizarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api.put<any>(`/tareas/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
}

export function usePosponerTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pospuesta, motivo }: { id: string; fecha_pospuesta: string; motivo: string }) =>
      api.post<any>(`/tareas/${id}/posponer`, { fecha_pospuesta, motivo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
}

export function useResolverTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolucion }: { id: string; resolucion: string }) =>
      api.post<any>(`/tareas/${id}/resolver`, { resolucion }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
}

export function useComentarTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, contenido }: { id: string; contenido: string }) =>
      api.post<any>(`/tareas/${id}/comentarios`, { contenido }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['tarea-comentarios', vars.id] }),
  });
}
