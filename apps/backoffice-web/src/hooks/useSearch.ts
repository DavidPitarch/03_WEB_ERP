import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SearchResult } from '@erp/types';

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 5_000,
  });
}
