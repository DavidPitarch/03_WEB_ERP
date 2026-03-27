import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PreguntaEncuesta {
  id: string;
  encuesta_id: string;
  texto: string;
  tipo: 'escala' | 'nps' | 'texto' | 'opcion_multiple' | 'si_no';
  opciones: string[];
  obligatoria: boolean;
  orden: number;
}

export interface Encuesta {
  id: string;
  compania_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: 'satisfaccion' | 'nps' | 'personalizada';
  activa: boolean;
  envio_auto: boolean;
  dias_espera: number;
  created_at: string;
  updated_at: string;
  preguntas?: PreguntaEncuesta[];
}

interface ListOpts {
  activa?: boolean;
  compania_id?: string;
}

async function fetchEncuestas(opts: ListOpts = {}): Promise<Encuesta[]> {
  const params = new URLSearchParams();
  if (opts.activa !== undefined) params.set('activa', String(opts.activa));
  if (opts.compania_id) params.set('compania_id', opts.compania_id);
  const qs = params.toString();
  const res = await api.get<Encuesta[]>(`/encuestas${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export function useEncuestas(opts: ListOpts = {}) {
  return useQuery({
    queryKey: ['encuestas', opts],
    queryFn: () => fetchEncuestas(opts),
  });
}

export function useEncuesta(id: string) {
  return useQuery({
    queryKey: ['encuestas', id],
    queryFn: async () => {
      const res = await api.get<{ data: Encuesta }>(`/encuestas/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

type PreguntaPayload = {
  texto: string;
  tipo: string;
  opciones?: string[];
  obligatoria?: boolean;
  orden?: number;
};

type CreateEncuestaPayload = {
  titulo: string;
  descripcion?: string;
  tipo?: string;
  activa?: boolean;
  envio_auto?: boolean;
  dias_espera?: number;
  compania_id?: string;
  preguntas?: PreguntaPayload[];
};

export function useCreateEncuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEncuestaPayload) => api.post<{ data: Encuesta }>('/encuestas', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encuestas'] }),
  });
}

export function useUpdateEncuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Omit<Encuesta, 'preguntas'>> & { id: string }) =>
      api.put<{ data: Encuesta }>(`/encuestas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encuestas'] }),
  });
}

export function useDeleteEncuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/encuestas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encuestas'] }),
  });
}
