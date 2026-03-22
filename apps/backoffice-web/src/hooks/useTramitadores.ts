import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api/v1';

function useAuthHeaders() {
  const { session } = useAuth();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Queries ─────────────────────────────────────────────────

export function useTramitadoresDashboard(empresaId?: string) {
  const headers = useAuthHeaders();
  const params = empresaId ? `?empresa_facturadora_id=${empresaId}` : '';
  return useQuery({
    queryKey: ['tramitadores-dashboard', empresaId],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores/dashboard${params}`, { headers }),
    refetchInterval: 30_000,
  });
}

export function useTramitadores(empresaId?: string, activo?: boolean) {
  const headers = useAuthHeaders();
  const params = new URLSearchParams();
  if (empresaId) params.set('empresa_facturadora_id', empresaId);
  if (activo !== undefined) params.set('activo', String(activo));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['tramitadores', empresaId, activo],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores${qs}`, { headers }),
    refetchInterval: 30_000,
  });
}

export function useTramitador(id: string) {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: ['tramitador', id],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores/${id}`, { headers }),
    enabled: Boolean(id),
  });
}

export function useTramitadorExpedientes(id: string, options?: { estado?: string; page?: number }) {
  const headers = useAuthHeaders();
  const params = new URLSearchParams();
  if (options?.estado) params.set('estado', options.estado);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['tramitador-expedientes', id, options],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores/${id}/expedientes${qs}`, { headers }),
    enabled: Boolean(id),
  });
}

export function useTramitadorHistorial(id: string, page = 1) {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: ['tramitador-historial', id, page],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores/${id}/historial?page=${page}`, { headers }),
    enabled: Boolean(id),
  });
}

export function useTramitadorPreasignaciones(id: string) {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: ['tramitador-preasignaciones', id],
    queryFn: () => apiFetch(`${API_BASE}/tramitadores/${id}/preasignaciones`, { headers }),
    enabled: Boolean(id),
  });
}

export function useColaAsignacion(options?: { empresaId?: string; page?: number }) {
  const headers = useAuthHeaders();
  const params = new URLSearchParams();
  if (options?.empresaId) params.set('empresa_facturadora_id', options.empresaId);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['cola-asignacion', options],
    queryFn: () => apiFetch(`${API_BASE}/asignaciones/cola${qs}`, { headers }),
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
  const headers = useAuthHeaders();
  const params = new URLSearchParams();
  if (options?.tramitadorId) params.set('tramitador_id', options.tramitadorId);
  if (options?.expedienteId) params.set('expediente_id', options.expedienteId);
  if (options?.tipo) params.set('tipo', options.tipo);
  if (options?.batchId) params.set('batch_id', options.batchId);
  if (options?.page) params.set('page', String(options.page));
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['historial-asignaciones', options],
    queryFn: () => apiFetch(`${API_BASE}/asignaciones/historial${qs}`, { headers }),
  });
}

export function useSugerenciasAsignacion(expedienteId: string) {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: ['sugerencias-asignacion', expedienteId],
    queryFn: () => apiFetch(`${API_BASE}/asignaciones/sugerencias/${expedienteId}`, { headers }),
    enabled: Boolean(expedienteId),
  });
}

export function useReglasReparto(empresaId?: string) {
  const headers = useAuthHeaders();
  const qs = empresaId ? `?empresa_facturadora_id=${empresaId}` : '';
  return useQuery({
    queryKey: ['reglas-reparto', empresaId],
    queryFn: () => apiFetch(`${API_BASE}/asignaciones/reglas-reparto${qs}`, { headers }),
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useCrearTramitador() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (body: any) =>
      apiFetch(`${API_BASE}/tramitadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tramitadores'] }); },
  });
}

export function useActualizarTramitador() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ id, ...body }: any) =>
      apiFetch(`${API_BASE}/tramitadores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador', vars.id] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
    },
  });
}

export function useActualizarCapacidad() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ id, ...body }: any) =>
      apiFetch(`${API_BASE}/tramitadores/${id}/capacidad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador', vars.id] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
    },
  });
}

export function useToggleTramitador() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ id, activar }: { id: string; activar: boolean }) =>
      apiFetch(`${API_BASE}/tramitadores/${id}/activate`, {
        method: activar ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
    },
  });
}

export function useAsignarTramitador() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (body: {
      expediente_id: string;
      tramitador_id: string;
      motivo?: string;
      motivo_codigo?: string;
      force?: boolean;
    }) =>
      apiFetch(`${API_BASE}/asignaciones/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cola-asignacion'] });
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
    },
  });
}

export function useReasignacionMasiva() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (body: {
      tramitador_origen_id?: string;
      tramitador_destino_id: string;
      expediente_ids: string[];
      motivo: string;
      motivo_codigo?: string;
    }) =>
      apiFetch(`${API_BASE}/asignaciones/reasignar-masivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tramitadores-dashboard'] });
      qc.invalidateQueries({ queryKey: ['tramitadores'] });
      qc.invalidateQueries({ queryKey: ['cola-asignacion'] });
    },
  });
}

export function useCrearPreasignacion() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ tramitadorId, ...body }: any) =>
      apiFetch(`${API_BASE}/tramitadores/${tramitadorId}/preasignaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador-preasignaciones', vars.tramitadorId] });
    },
  });
}

export function useEliminarPreasignacion() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ tramitadorId, ruleId }: { tramitadorId: string; ruleId: string }) =>
      apiFetch(`${API_BASE}/tramitadores/${tramitadorId}/preasignaciones/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tramitador-preasignaciones', vars.tramitadorId] });
    },
  });
}

export function useActivarReglaReparto() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${API_BASE}/asignaciones/reglas-reparto/${id}/activar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reglas-reparto'] }); },
  });
}

export function useCrearReglaReparto() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (body: any) =>
      apiFetch(`${API_BASE}/asignaciones/reglas-reparto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reglas-reparto'] }); },
  });
}
