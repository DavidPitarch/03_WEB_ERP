import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CampoPersonalizado {
  id: string;
  grupo_id: string;
  nombre: string;
  tipo: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  opciones: string[];
  obligatorio: boolean;
  orden: number;
}

export interface GrupoCampos {
  id: string;
  compania_id: string | null;
  nombre: string;
  entidad: string;
  orden: number;
  campos?: CampoPersonalizado[];
}

interface ListOpts {
  compania_id?: string;
  entidad?: string;
}

async function fetchGrupos(opts: ListOpts = {}): Promise<GrupoCampos[]> {
  const params = new URLSearchParams();
  if (opts.compania_id) params.set('compania_id', opts.compania_id);
  if (opts.entidad) params.set('entidad', opts.entidad);
  const qs = params.toString();
  const res = await api.get<{ data: GrupoCampos[] }>(`/grupos-campos${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export function useGruposCampos(opts: ListOpts = {}) {
  return useQuery({
    queryKey: ['grupos-campos', opts],
    queryFn: () => fetchGrupos(opts),
  });
}

export function useCreateGrupoCampos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; entidad?: string; orden?: number; compania_id?: string }) =>
      api.post<{ data: GrupoCampos }>('/grupos-campos', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}

export function useUpdateGrupoCampos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<GrupoCampos> & { id: string }) =>
      api.put<{ data: GrupoCampos }>(`/grupos-campos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}

export function useDeleteGrupoCampos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/grupos-campos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}

// ── Campos ──────────────────────────────────────────────────────────────────

type CampoPayload = {
  nombre: string; tipo?: string; opciones?: string[]; obligatorio?: boolean; orden?: number;
};

export function useCreateCampo(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CampoPayload) =>
      api.post<{ data: CampoPersonalizado }>(`/grupos-campos/${grupoId}/campos`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}

export function useUpdateCampo(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CampoPersonalizado> & { id: string }) =>
      api.put<{ data: CampoPersonalizado }>(`/grupos-campos/${grupoId}/campos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}

export function useDeleteCampo(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/grupos-campos/${grupoId}/campos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos-campos'] }),
  });
}
