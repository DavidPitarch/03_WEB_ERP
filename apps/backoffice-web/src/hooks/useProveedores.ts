import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Proveedor, CreateProveedorRequest } from '@erp/types';

const BASE = '/proveedores';

export interface ProveedoresFilters {
  search?: string;
  activo?: boolean;
  page?: number;
  per_page?: number;
}

export interface ProveedoresListResult {
  items: Proveedor[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

function buildQs(filters: object = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Listado paginado ────────────────────────────────────────────────────────

export function useProveedores(filters: ProveedoresFilters = {}) {
  return useQuery({
    queryKey: ['proveedores', filters],
    queryFn: () => api.get<ProveedoresListResult>(`${BASE}${buildQs(filters as Record<string, unknown>)}`),
  });
}

// ─── Detalle de un proveedor ─────────────────────────────────────────────────

export function useProveedor(id: string | null) {
  return useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => api.get<Proveedor>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

// ─── Crear proveedor ──────────────────────────────────────────────────────────

export function useCrearProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProveedorRequest) => api.post<Proveedor>(BASE, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });
}

// ─── Actualizar proveedor ─────────────────────────────────────────────────────

export function useUpdateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Proveedor> & { id: string }) =>
      api.put<Proveedor>(`${BASE}/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['proveedor', vars.id] });
    },
  });
}

// ─── Borrar proveedor (baja lógica) ──────────────────────────────────────────

export function useDeleteProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
  });
}

// ─── Reactivar proveedor ──────────────────────────────────────────────────────

export function useActivateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; nombre: string; activo: boolean }>(`${BASE}/${id}/activate`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
    },
  });
}
