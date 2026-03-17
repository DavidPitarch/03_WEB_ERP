import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildQs(filters: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function usePeritosExpedientes(filters: {
  estado?: string;
  compania_id?: string;
  tipo_siniestro?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  per_page?: number;
} = {}) {
  return useQuery({
    queryKey: ['peritos-expedientes', filters],
    queryFn: () => api.get(`/peritos/mis-expedientes${buildQs(filters)}`),
  });
}

export function usePeritoExpedienteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['perito-expediente', id],
    queryFn: () => api.get(`/peritos/expedientes/${id}`),
    enabled: !!id,
  });
}

export function useDictamenes(filters: {
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  per_page?: number;
} = {}) {
  return useQuery({
    queryKey: ['dictamenes', filters],
    queryFn: () => api.get(`/peritos/dictamenes${buildQs(filters)}`),
  });
}

export function useDictamenDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['dictamen', id],
    queryFn: () => api.get(`/peritos/dictamenes/${id}`),
    enabled: !!id,
  });
}

export function useCreateDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/peritos/dictamenes', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dictamenes'] });
      qc.invalidateQueries({ queryKey: ['peritos-expedientes'] });
    },
  });
}

export function useUpdateDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.put(`/peritos/dictamenes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dictamenes'] });
      qc.invalidateQueries({ queryKey: ['dictamen'] });
    },
  });
}

export function useEmitirDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/peritos/dictamenes/${id}/emitir`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dictamenes'] });
      qc.invalidateQueries({ queryKey: ['dictamen'] });
      qc.invalidateQueries({ queryKey: ['peritos-expedientes'] });
    },
  });
}

export function useAddEvidenciaDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; storage_path: string; nombre_original: string; clasificacion: string; notas?: string }) =>
      api.post(`/peritos/dictamenes/${id}/evidencias`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dictamen'] });
    },
  });
}

// ─── Admin hooks ───

export function usePeritosAdmin(filters: { search?: string; activo?: boolean } = {}) {
  return useQuery({
    queryKey: ['peritos-admin', filters],
    queryFn: () => api.get(`/peritos${buildQs(filters)}`),
  });
}

export function useCrearPerito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/peritos', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['peritos-admin'] });
    },
  });
}

export function useUpdatePerito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.put(`/peritos/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['peritos-admin'] });
    },
  });
}

export function useAsignarPeritoExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, perito_id }: { expedienteId: string; perito_id: string }) =>
      api.put(`/peritos/asignar-expediente/${expedienteId}`, { perito_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['peritos-expedientes'] });
      qc.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}
