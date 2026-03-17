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

export function usePedidos(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['pedidos', filters],
    queryFn: () => api.get(`/pedidos${buildQs(filters)}`),
  });
}

export function usePedidoDetail(id: string) {
  return useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`),
    enabled: !!id,
  });
}

export function usePedidosRecoger(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['pedidos-recoger', filters],
    queryFn: () => api.get(`/pedidos/a-recoger${buildQs(filters)}`),
  });
}

export function usePedidosCaducados(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['pedidos-caducados', filters],
    queryFn: () => api.get(`/pedidos/caducados${buildQs(filters)}`),
  });
}

export function useCrearPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/pedidos', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      qc.invalidateQueries({ queryKey: ['pedidos-recoger'] });
      qc.invalidateQueries({ queryKey: ['pedidos-caducados'] });
    },
  });
}

export function useEnviarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pedidos/${id}/enviar`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}

export function useConfirmarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pedidos/${id}/confirmar`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}

export function useListoRecoger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pedidos/${id}/listo`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      qc.invalidateQueries({ queryKey: ['pedidos-recoger'] });
    },
  });
}

export function useRecogerPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pedidos/${id}/recoger`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      qc.invalidateQueries({ queryKey: ['pedidos-recoger'] });
    },
  });
}

export function useCancelarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      api.post(`/pedidos/${id}/cancelar`, { motivo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pedido', vars.id] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      qc.invalidateQueries({ queryKey: ['pedidos-caducados'] });
    },
  });
}
