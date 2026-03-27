import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PlantillaDocumento {
  id: string;
  compania_id: string | null;
  nombre: string;
  seccion: string | null;
  fichero_url: string | null;
  palabras_clave: string[];
  requiere_firma_operario: boolean;
  requiere_firma_asegurado: boolean;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  activa?: boolean;
  compania_id?: string;
  seccion?: string;
}

async function fetchPlantillas(opts: ListOpts = {}): Promise<PlantillaDocumento[]> {
  const params = new URLSearchParams();
  if (opts.activa !== undefined) params.set('activa', String(opts.activa));
  if (opts.compania_id) params.set('compania_id', opts.compania_id);
  if (opts.seccion) params.set('seccion', opts.seccion);
  const qs = params.toString();
  const res = await api.get<PlantillaDocumento[]>(`/plantillas-documento${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export function usePlantillasDocumento(opts: ListOpts = {}) {
  return useQuery({
    queryKey: ['plantillas-documento', opts],
    queryFn: () => fetchPlantillas(opts),
  });
}

type CreatePayload = {
  nombre: string;
  seccion?: string;
  fichero_url?: string;
  palabras_clave?: string[];
  requiere_firma_operario?: boolean;
  requiere_firma_asegurado?: boolean;
  activa?: boolean;
  compania_id?: string;
};

export function useCreatePlantillaDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayload) => api.post<{ data: PlantillaDocumento }>('/plantillas-documento', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas-documento'] }),
  });
}

export function useUpdatePlantillaDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PlantillaDocumento> & { id: string }) =>
      api.put<{ data: PlantillaDocumento }>(`/plantillas-documento/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas-documento'] }),
  });
}

export function useDeletePlantillaDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/plantillas-documento/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas-documento'] }),
  });
}
