import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReglaAutomatizacion {
  id: string;
  compania_id: string | null;
  nombre: string;
  descripcion: string | null;
  trigger_tipo: 'campo_cambia' | 'tiempo_transcurrido' | 'creacion' | 'cierre' | 'asignacion';
  trigger_config: Record<string, unknown>;
  accion_tipo: 'enviar_sms' | 'enviar_email' | 'crear_tarea' | 'webhook' | 'notificacion';
  accion_config: Record<string, unknown>;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  activa?: boolean;
  compania_id?: string;
}

async function fetchEventos(opts: ListOpts = {}): Promise<ReglaAutomatizacion[]> {
  const params = new URLSearchParams();
  if (opts.activa !== undefined) params.set('activa', String(opts.activa));
  if (opts.compania_id) params.set('compania_id', opts.compania_id);
  const qs = params.toString();
  const res = await api.get<ReglaAutomatizacion[]>(`/eventos${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export function useEventos(opts: ListOpts = {}) {
  return useQuery({
    queryKey: ['eventos', opts],
    queryFn: () => fetchEventos(opts),
  });
}

type CreateEventoPayload = {
  nombre: string;
  descripcion?: string;
  trigger_tipo: string;
  trigger_config?: Record<string, unknown>;
  accion_tipo: string;
  accion_config?: Record<string, unknown>;
  activa?: boolean;
  orden?: number;
  compania_id?: string;
};

export function useCreateEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventoPayload) => api.post<{ data: ReglaAutomatizacion }>('/eventos', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventos'] }),
  });
}

export function useUpdateEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ReglaAutomatizacion> & { id: string }) =>
      api.put<{ data: ReglaAutomatizacion }>(`/eventos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventos'] }),
  });
}

export function useDeleteEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/eventos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventos'] }),
  });
}
