import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePresupuestos(expedienteId: string | undefined) {
  return useQuery({
    queryKey: ['presupuestos', expedienteId],
    queryFn: () => api.get<any[]>(`/presupuestos?expediente_id=${expedienteId}`),
    enabled: !!expedienteId,
  });
}

export function usePresupuestoDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['presupuesto', id],
    queryFn: () => api.get<any>(`/presupuestos/${id}`),
    enabled: !!id,
  });
}

export function useCrearPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { expediente_id: string; parte_id?: string }) =>
      api.post<any>('/presupuestos', body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['presupuestos', vars.expediente_id] }),
  });
}

export function useAddLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presupuestoId, ...body }: any) =>
      api.post<any>(`/presupuestos/${presupuestoId}/lineas`, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['presupuesto', vars.presupuestoId] }),
  });
}

export function useUpdateLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presupuestoId, lineaId, ...body }: any) =>
      api.put<any>(`/presupuestos/${presupuestoId}/lineas/${lineaId}`, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['presupuesto', vars.presupuestoId] }),
  });
}

export function useDeleteLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presupuestoId, lineaId }: { presupuestoId: string; lineaId: string }) =>
      api.del<any>(`/presupuestos/${presupuestoId}/lineas/${lineaId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['presupuesto', vars.presupuestoId] }),
  });
}

export function useRecalcularPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<any>(`/presupuestos/${id}/recalcular`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto'] }),
  });
}

export function useAprobarPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<any>(`/presupuestos/${id}/aprobar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto'] }),
  });
}
