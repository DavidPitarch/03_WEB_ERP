import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BandejaContadores, InformeCaducado } from '@erp/types';

export function useBandejaContadores() {
  return useQuery({
    queryKey: ['bandeja-contadores'],
    queryFn: () => api.get<BandejaContadores>('/bandejas/contadores'),
    refetchInterval: 30_000,
  });
}

export function useInformesCaducados() {
  return useQuery({
    queryKey: ['informes-caducados'],
    queryFn: () => api.get<InformeCaducado[]>('/bandejas/informes-caducados'),
  });
}
