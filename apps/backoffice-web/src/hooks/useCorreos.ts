import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CuentaCorreo {
  id: string;
  compania_id: string | null;
  nombre: string;
  direccion: string;
  usuario: string;
  servidor_imap: string | null;
  puerto_imap: number;
  servidor_smtp: string;
  puerto_smtp: number;
  usa_tls: boolean;
  activa: boolean;
  es_remitente_defecto: boolean;
  created_at: string;
  updated_at: string;
}

export function useCorreos(opts?: { activa?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.activa !== undefined) params.set('activa', String(opts.activa));
  const qs = params.toString();
  return useQuery({
    queryKey: ['correos', opts],
    queryFn: () => api.get<CuentaCorreo[]>(`/correos${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateCuentaCorreo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CuentaCorreo> & { password_encrypted?: string }) =>
      api.post<CuentaCorreo>('/correos', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['correos'] }),
  });
}

export function useUpdateCuentaCorreo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CuentaCorreo> & { id: string; password_encrypted?: string }) =>
      api.put<CuentaCorreo>(`/correos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['correos'] }),
  });
}

export function useDeleteCuentaCorreo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/correos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['correos'] }),
  });
}
