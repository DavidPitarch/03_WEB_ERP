import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  BaremoPlantilla,
  BaremoPlantillaTrabajo,
  BaremoPlantillaProveedor,
  CreateBaremoPlantillaRequest,
} from '@erp/types';

const BASE = '/baremos-plantilla';

export interface BaremosPlantillaFilters {
  tipo?: string;
  temporal?: 'actual' | 'futuros' | 'anteriores';
  search?: string;
}

function buildQs(filters: BaremosPlantillaFilters): string {
  const params = new URLSearchParams();
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.temporal) params.set('temporal', filters.temporal);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Listado de baremos ───────────────────────────────────────────────────────

export function useBaremosPlantilla(filters: BaremosPlantillaFilters = {}) {
  return useQuery({
    queryKey: ['baremos-plantilla', filters],
    queryFn: () => api.get<BaremoPlantilla[]>(`${BASE}${buildQs(filters)}`),
  });
}

// ─── Detalle de un baremo ─────────────────────────────────────────────────────

export function useBaremoPlantilla(id: string | null) {
  return useQuery({
    queryKey: ['baremo-plantilla', id],
    queryFn: () => api.get<BaremoPlantilla>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

// ─── Crear baremo ─────────────────────────────────────────────────────────────

export function useCrearBaremoPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBaremoPlantillaRequest) =>
      api.post<BaremoPlantilla>(BASE, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baremos-plantilla'] });
    },
  });
}

// ─── Actualizar baremo ────────────────────────────────────────────────────────

export function useUpdateBaremoPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateBaremoPlantillaRequest> & { id: string }) =>
      api.put<BaremoPlantilla>(`${BASE}/${id}`, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['baremos-plantilla'] });
      qc.invalidateQueries({ queryKey: ['baremo-plantilla', vars.id] });
    },
  });
}

// ─── Eliminar baremo ──────────────────────────────────────────────────────────

export function useDeleteBaremoPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baremos-plantilla'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// TRABAJOS
// ══════════════════════════════════════════════════════════════════════════════

export interface TrabajosBaremoPaginadosResult {
  items: BaremoPlantillaTrabajo[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function useBaremoTrabajos(
  baremoid: string | null,
  search?: string,
  page = 1,
  perPage = 100,
) {
  return useQuery({
    queryKey: ['baremo-plantilla-trabajos', baremoid, search, page, perPage],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      return api.get<TrabajosBaremoPaginadosResult>(
        `${BASE}/${baremoid}/trabajos?${params.toString()}`,
      );
    },
    enabled: !!baremoid,
  });
}

export function useCrearBaremoTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ baremoid, ...data }: Record<string, unknown> & { baremoid: string }) =>
      api.post<BaremoPlantillaTrabajo>(`${BASE}/${baremoid}/trabajos`, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['baremo-plantilla-trabajos', vars.baremoid] });
    },
  });
}

export function useUpdateBaremoTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      baremoid,
      trabajoId,
      ...data
    }: Record<string, unknown> & { baremoid: string; trabajoId: string }) =>
      api.put<BaremoPlantillaTrabajo>(`${BASE}/${baremoid}/trabajos/${trabajoId}`, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['baremo-plantilla-trabajos', vars.baremoid] });
    },
  });
}

export function useDeleteBaremoTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ baremoid, trabajoId }: { baremoid: string; trabajoId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${baremoid}/trabajos/${trabajoId}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['baremo-plantilla-trabajos', vars.baremoid] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES (asignación a baremos tipo Proveedor)
// ══════════════════════════════════════════════════════════════════════════════

export function useBaremoProveedoresAsignados(baremoid: string | null) {
  return useQuery({
    queryKey: ['baremo-plantilla-proveedores', baremoid],
    queryFn: () =>
      api.get<BaremoPlantillaProveedor[]>(`${BASE}/${baremoid}/proveedores`),
    enabled: !!baremoid,
  });
}

export function useAsignarProveedorBaremo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      baremoid,
      proveedor_id,
    }: {
      baremoid: string;
      proveedor_id: string;
    }) =>
      api.post<BaremoPlantillaProveedor>(`${BASE}/${baremoid}/proveedores`, {
        proveedor_id,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['baremo-plantilla-proveedores', vars.baremoid],
      });
      qc.invalidateQueries({
        queryKey: ['baremos-de-proveedor'],
      });
    },
  });
}

export function useDesasignarProveedorBaremo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      baremoid,
      proveedor_id,
    }: {
      baremoid: string;
      proveedor_id: string;
    }) =>
      api.del<{ deleted: boolean }>(
        `${BASE}/${baremoid}/proveedores/${proveedor_id}`,
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['baremo-plantilla-proveedores', vars.baremoid],
      });
      qc.invalidateQueries({
        queryKey: ['baremos-de-proveedor'],
      });
    },
  });
}

// ─── Baremos (tipo Proveedor) asignados a un proveedor concreto ───────────────

export function useBaremosDeProveedor(proveedorId: string | null) {
  return useQuery({
    queryKey: ['baremos-de-proveedor', proveedorId],
    queryFn: () =>
      api.get<BaremoPlantilla[]>(`/proveedores/${proveedorId}/baremos`),
    enabled: !!proveedorId,
  });
}
