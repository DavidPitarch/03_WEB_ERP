import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Queries ─────────────────────────────────────────────────

export function useTramitadoresDashboard(empresaId?: string) {
  const params = empresaId ? `?empresa_facturadora_id=${empresaId}` : '';
  return useQuery({
    queryKey: ['tramitadores-dashboard', empresaId],
    queryFn: () => api.get<any>(`/tramitadores/dashboard${params}`),
    refetchInterval: 30_000,
  });
}

export function useTramitadores(empresaId?: string, activo?: boolean) {
  const params = new URLSearchParams();
  if (empresaId) params.set('empresa_facturadora_id', empresaId);
  if (activo !== undefined) params.set('activo', String(activo));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['tramitadores', empresaId, activo],
    queryFn: () => api.get<any>(`/tramitadores${qs}`),
    refetchInterval: 30_000,
  });
}

export function useTramitador(id: string) {
  return useQuery({
    queryKey: ['tramitador', id],
    queryFn: () => api.get<any>(`/tramitadores/${id}`),
    enabled: Boolean(id),
  });
}

export function useTramitadorExpedientes(id: string, options?: { estado?: string; page?: number }) {
  const params = new URLSearchParams();
  if (options?.estado) params.set('estado', options.estado);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['tramitador-expedientes', id, options],
    queryFn: () => api.get<any>(`/tramitadores/${id}/expedientes${qs}`),
    enabled: Boolean(id),
  });
}

export function useTramitadorHistorial(id: string, page = 1) {
  return useQuery({
    queryKey: ['tramitador-historial', id, page],
    queryFn: () => api.get<any>(`/tramitadores/${id}/historial?page=${page}`),
    enabled: Boolean(id),
  });
}

export function useTramitadorPreasignaciones(id: string) {
  return useQuery({
    queryKey: ['tramitador-preasignaciones', id],
    queryFn: () => api.get<any>(`/tramitadores/${id}/preasignaciones`),
    enabled: Boolean(id),
  });
}

export function useColaAsignacion(options?: { empresaId?: string; page?: number }) {
  const params = new URLSearchParams();
  if (options?.empresaId) params.set('empresa_facturadora_id', options.empresaId);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['cola-asignacion', options],
    queryFn: () => api.get<any>(`/asignaciones/cola${qs}`),
    refetchInterval: 60_000,
  });
}

export function useHistorialAsignaciones(options?: {
  tramitadorId?: string;
  expedienteId?: string;
  tipo?: string;
  batchId?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (options?.tramitadorId) params.set('tramitador_id', options.tramitadorId);
  if (options?.expedienteId) params.set('expediente_id', options.expedienteId);
  if (options?.tipo) params.set('tipo', options.tipo);
  if (options?.batchId) params.set('batch_id', options.batchId);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['historial-asignaciones', options],
    queryFn: () => api.get<any>(`/asignaciones/historial${qs}`),
  });
}

export function useSugerenciasAsignacion(expedienteId: string) {
  return useQuery({
    queryKey: ['sugerencias-asignacion', expedienteId],
    queryFn: () => api.get<any>(`/asignaciones/sugerencias/${expedienteId}`),
    enabled: Boolean(expedienteId),
  });
}

export function useReglasReparto(empresaId?: string) {
  const qs = empresaId ? `?empresa_facturadora_id=${empresaId}` : '';
  return useQuery({
    queryKey: ['reglas-reparto', empresaId],
    queryFn: () => api.get<any>(`/asignaciones/reglas-reparto${qs}`),
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useCrearTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post('/tramitadores', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tramitadores'] }); },
  });
}

export function useActualizarTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/tramitadores/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador', vars.id] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
    },
  });
}

export function useActualizarCapacidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/tramitadores/${id}/capacidad`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador', vars.id] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
    },
  });
}

export function useToggleTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activar }: { id: string; activar: boolean }) =>
      activar ? api.post(`/tramitadores/${id}/activate`, {}) : api.del(`/tramitadores/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
    },
  });
}

export function useToggleAusente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ausente }: { id: string; ausente: boolean }) =>
      api.patch(`/tramitadores/${id}/ausente`, { ausente }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
    },
  });
}

export function useAsignarTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      expediente_id: string;
      tramitador_id: string;
      motivo?: string;
      motivo_codigo?: string;
      force?: boolean;
    }) => api.post('/asignaciones/asignar', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cola-asignacion'] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
    },
  });
}

export function useReasignacionMasiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      tramitador_origen_id?: string;
      tramitador_destino_id: string;
      expediente_ids: string[];
      motivo: string;
      motivo_codigo?: string;
    }) => api.post('/asignaciones/reasignar-masivo', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
      qc.invalidateQueries({ queryKey: ['cola-asignacion'] });
    },
  });
}

export function useCrearPreasignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tramitadorId, ...body }: any) =>
      api.post(`/tramitadores/${tramitadorId}/preasignaciones`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador-preasignaciones', vars.tramitadorId] });
    },
  });
}

export function useEliminarPreasignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tramitadorId, ruleId }: { tramitadorId: string; ruleId: string }) =>
      api.del(`/tramitadores/${tramitadorId}/preasignaciones/${ruleId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador-preasignaciones', vars.tramitadorId] });
    },
  });
}

export function useActivarReglaReparto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/asignaciones/reglas-reparto/${id}/activar`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reglas-reparto'] }); },
  });
}

export function useCrearReglaReparto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post('/asignaciones/reglas-reparto', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reglas-reparto'] }); },
  });
}
