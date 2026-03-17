import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBaremos(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString();
  return useQuery({
    queryKey: ['baremos', filters],
    queryFn: () => api.get<any[]>(`/baremos${params ? `?${params}` : ''}`),
  });
}

export function useBaremoDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['baremo', id],
    queryFn: () => api.get<any>(`/baremos/${id}`),
    enabled: !!id,
  });
}

export function useBaremoPartidas(id: string | undefined, especialidad?: string) {
  const params = especialidad ? `?especialidad=${encodeURIComponent(especialidad)}` : '';
  return useQuery({
    queryKey: ['baremo-partidas', id, especialidad],
    queryFn: () => api.get<any[]>(`/baremos/${id}/partidas${params}`),
    enabled: !!id,
  });
}

export function useImportBaremoCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      compania_id: string;
      nombre: string;
      tipo: 'compania' | 'operario';
      operario_id?: string;
      vigente_desde: string;
      csv_text: string;
    }) => api.post<{ baremo_id: string; partidas_count: number; errors: string[] }>('/baremos/import-csv', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['baremos'] }),
  });
}
