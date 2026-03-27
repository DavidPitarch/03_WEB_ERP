import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Compania, CompaniaEspecialidad, CompaniaSistema, Operario, Asegurado, EmpresaFacturadora } from '@erp/types';

// ─── Tramitadores by company ───────────────────────────────────────────────────

export function useCompaniaTramitadores(companiaId: string | null) {
  return useQuery({
    queryKey: ['compania-tramitadores', companiaId],
    queryFn: () => api.get<any[]>(`/masters/companias/${companiaId}/tramitadores`),
    enabled: !!companiaId,
  });
}

export function useAllTramitadores() {
  return useQuery({
    queryKey: ['tramitadores-all'],
    queryFn: () => api.get<any[]>('/tramitadores?activo=true'),
  });
}

export function useAddCompaniaTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companiaId, tramitadorId }: { companiaId: string; tramitadorId: string }) =>
      api.post<any>(`/masters/companias/${companiaId}/tramitadores`, { tramitador_id: tramitadorId }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['compania-tramitadores', vars.companiaId] });
    },
  });
}

export function useRemoveCompaniaTramitador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companiaId, tramitadorId }: { companiaId: string; tramitadorId: string }) =>
      api.del<any>(`/masters/companias/${companiaId}/tramitadores/${tramitadorId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['compania-tramitadores', vars.companiaId] });
    },
  });
}

export function useCompanias() {
  return useQuery({
    queryKey: ['companias'],
    queryFn: () => api.get<Compania[]>('/masters/companias?activa=true'),
  });
}

export function useAllCompanias(filters?: { sistema_integracion?: CompaniaSistema | '' }) {
  const params = new URLSearchParams();
  if (filters?.sistema_integracion) params.set('sistema_integracion', filters.sistema_integracion);
  const qs = params.toString();
  return useQuery({
    queryKey: ['companias-all', filters],
    queryFn: () => api.get<Compania[]>(`/masters/companias${qs ? `?${qs}` : ''}`),
  });
}

// ─── Especialidades por compañía ──────────────────────────────────────────────

export function useCompaniaEspecialidades(companiaId: string | null) {
  return useQuery({
    queryKey: ['compania-especialidades', companiaId],
    queryFn: () => api.get<CompaniaEspecialidad[]>(`/masters/companias/${companiaId}/especialidades`),
    enabled: !!companiaId,
  });
}

export function useAddCompaniaEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companiaId, especialidadId, diasCaducidad, diasCaducidadConfirmar,
    }: { companiaId: string; especialidadId: string; diasCaducidad?: number; diasCaducidadConfirmar?: number }) =>
      api.post<CompaniaEspecialidad>(`/masters/companias/${companiaId}/especialidades`, {
        especialidad_id:          especialidadId,
        dias_caducidad:           diasCaducidad ?? 0,
        dias_caducidad_confirmar: diasCaducidadConfirmar ?? 0,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['compania-especialidades', vars.companiaId] });
    },
  });
}

export function useUpdateCompaniaEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companiaId, espId, diasCaducidad, diasCaducidadConfirmar,
    }: { companiaId: string; espId: string; diasCaducidad: number; diasCaducidadConfirmar: number }) =>
      api.put<CompaniaEspecialidad>(`/masters/companias/${companiaId}/especialidades/${espId}`, {
        dias_caducidad:           diasCaducidad,
        dias_caducidad_confirmar: diasCaducidadConfirmar,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['compania-especialidades', vars.companiaId] });
    },
  });
}

export function useRemoveCompaniaEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companiaId, espId }: { companiaId: string; espId: string }) =>
      api.del<{ deleted: boolean }>(`/masters/companias/${companiaId}/especialidades/${espId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['compania-especialidades', vars.companiaId] });
    },
  });
}

export function useCreateCompania() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Compania>) => api.post<Compania>('/masters/companias', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companias'] }); qc.invalidateQueries({ queryKey: ['companias-all'] }); },
  });
}

export function useUpdateCompania() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Compania> & { id: string }) => api.put<Compania>(`/masters/companias/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companias'] }); qc.invalidateQueries({ queryKey: ['companias-all'] }); },
  });
}

export function useOperarios(filters?: { activo?: boolean; gremio?: string }) {
  const params = new URLSearchParams();
  if (filters?.activo !== undefined) params.set('activo', String(filters.activo));
  if (filters?.gremio) params.set('gremio', filters.gremio);
  const qs = params.toString();
  return useQuery({
    queryKey: ['operarios', filters],
    queryFn: () => api.get<Operario[]>(`/masters/operarios${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Operario>) => api.post<Operario>('/masters/operarios', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}

export function useUpdateOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Operario> & { id: string }) => api.put<Operario>(`/masters/operarios/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}

export function useEmpresasFacturadoras() {
  return useQuery({
    queryKey: ['empresas-facturadoras'],
    queryFn: () => api.get<EmpresaFacturadora[]>('/masters/empresas-facturadoras'),
  });
}

export function useAsegurados(search?: string) {
  return useQuery({
    queryKey: ['asegurados', search],
    queryFn: () => api.get<Asegurado[]>(`/masters/asegurados${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    enabled: !search || search.length >= 2,
  });
}

export function useCreateAsegurado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Asegurado>) => api.post<Asegurado>('/masters/asegurados', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asegurados'] }),
  });
}

export function useCatalogos(tipo?: string) {
  return useQuery({
    queryKey: ['catalogos', tipo],
    queryFn: () => api.get<{ id: string; tipo: string; codigo: string; valor: string }[]>(`/masters/catalogos${tipo ? `?tipo=${tipo}` : ''}`),
  });
}
