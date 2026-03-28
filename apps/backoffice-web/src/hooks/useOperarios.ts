import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Operario, OperarioEspecialidad } from '@erp/types';

const BASE = '/operarios-mgmt';

// ─── Listado con paginación y filtros ─────────────────────────────────────────

export interface OperariosFilters {
  search?: string;
  cp?: string;
  especialidad_id?: string;
  estado?: 'activos' | 'eliminados' | 'todos';
  page?: number;
  per_page?: number;
}

export interface OperariosListResult {
  items: Operario[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function useOperariosLista(filters?: OperariosFilters) {
  const params = new URLSearchParams();
  if (filters?.search)        params.set('search', filters.search);
  if (filters?.cp)            params.set('cp', filters.cp);
  if (filters?.especialidad_id) params.set('especialidad_id', filters.especialidad_id);
  if (filters?.estado && filters.estado !== 'todos') params.set('estado', filters.estado);
  if (filters?.estado === 'todos') params.set('estado', 'todos');
  if (filters?.page)          params.set('page', String(filters.page));
  if (filters?.per_page)      params.set('per_page', String(filters.per_page));
  const qs = params.toString();

  return useQuery({
    queryKey: ['operarios-lista', filters],
    queryFn: () => api.get<OperariosListResult>(`${BASE}${qs ? `?${qs}` : ''}`),
  });
}

// ─── Detalle de un operario ───────────────────────────────────────────────────

export function useOperario(id: string | null) {
  return useQuery({
    queryKey: ['operario', id],
    queryFn: () => api.get<Operario>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

// ─── Crear operario ───────────────────────────────────────────────────────────

export function useCreateOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Operario>) => api.post<Operario>(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios-lista'] }),
  });
}

// ─── Actualizar operario ──────────────────────────────────────────────────────

export function useUpdateOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Operario> & { id: string }) =>
      api.put<Operario>(`${BASE}/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['operarios-lista'] });
      qc.invalidateQueries({ queryKey: ['operario', vars.id] });
    },
  });
}

// ─── Dar de baja / reactivar ──────────────────────────────────────────────────

export function useActivateOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      activo
        ? api.post<Operario>(`${BASE}/${id}/activate`, {})
        : api.del<Operario>(`${BASE}/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios-lista'] }),
  });
}

// ─── Eliminar (baja lógica) ───────────────────────────────────────────────────

export function useDeleteOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios-lista'] }),
  });
}

// ─── Especialidades del operario ─────────────────────────────────────────────

export interface EspecialidadesPaginadasResult {
  items: OperarioEspecialidad[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function useOperarioEspecialidades(
  operarioId: string | null,
  page = 1,
  perPage = 50,
) {
  return useQuery({
    queryKey: ['operario-especialidades', operarioId, page, perPage],
    queryFn: () =>
      api.get<EspecialidadesPaginadasResult>(
        `${BASE}/${operarioId}/especialidades?page=${page}&per_page=${perPage}`,
      ),
    enabled: !!operarioId,
  });
}

export function useAddOperarioEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operarioId, especialidadId, esPrincipal }: { operarioId: string; especialidadId: string; esPrincipal?: boolean }) =>
      api.post<OperarioEspecialidad>(`${BASE}/${operarioId}/especialidades`, {
        especialidad_id: especialidadId,
        es_principal: esPrincipal ?? false,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['operario-especialidades', vars.operarioId] });
    },
  });
}

export function useUpdateOperarioEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operarioId, espRelId, esPrincipal }: { operarioId: string; espRelId: string; esPrincipal: boolean }) =>
      api.patch<OperarioEspecialidad>(`${BASE}/${operarioId}/especialidades/${espRelId}`, { es_principal: esPrincipal }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['operario-especialidades', vars.operarioId] });
    },
  });
}

export function useRemoveOperarioEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operarioId, espRelId }: { operarioId: string; espRelId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${operarioId}/especialidades/${espRelId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['operario-especialidades', vars.operarioId] });
    },
  });
}
