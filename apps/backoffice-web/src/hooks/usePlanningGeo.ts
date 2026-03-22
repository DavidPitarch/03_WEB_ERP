import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GeoFilters } from './useGeoFilters';

export interface GeoExpediente {
  id: string;
  numero_expediente: string;
  estado: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  compania_id: string;
  compania_nombre: string | null;
  operario_id: string | null;
  operario_nombre: string | null;
  tipo_siniestro: string;
  direccion_siniestro: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  lat: number;
  lng: number;
  sla_status: 'ok' | 'urgente' | 'vencido' | 'sin_sla';
  citas_hoy: number;
  fecha_encargo: string;
  fecha_limite_sla: string | null;
}

export interface GeoOperario {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  gremios: string[];
  zonas_cp: string[];
  activo: boolean;
  base_lat: number | null;
  base_lng: number | null;
  citas_hoy: number;
  citas_semana: number;
  overloaded: boolean;
  carga_pct: number;
}

export interface GeoHeatmapPoint {
  cp: string;
  lat: number;
  lng: number;
  count: number;
  urgentes: number;
  intensity: number;
}

export interface GeoExpedientesMeta {
  total: number;
  unassigned_count: number;
  alert_count: number;
}

function buildExpedientesQS(filters: GeoFilters): string {
  const p = new URLSearchParams();
  if (filters.estado.length)    p.set('estado',      filters.estado.join(','));
  if (filters.compania_id)      p.set('compania_id', filters.compania_id);
  if (filters.prioridad.length) p.set('prioridad',   filters.prioridad.join(','));
  if (filters.gremio)           p.set('gremio',      filters.gremio);
  if (filters.operario_id)      p.set('operario_id', filters.operario_id);
  if (filters.fecha_ini)        p.set('fecha_ini',   filters.fecha_ini);
  if (filters.fecha_fin)        p.set('fecha_fin',   filters.fecha_fin);
  const qs = p.toString();
  return `/planning/geo/expedientes${qs ? `?${qs}` : ''}`;
}

export function useGeoExpedientes(filters: GeoFilters) {
  return useQuery({
    queryKey: ['geo-expedientes', filters],
    queryFn: () =>
      api.get<{ items?: GeoExpediente[]; [k: string]: unknown }>(buildExpedientesQS(filters)).then((r) => r as any),
    staleTime: 60_000,
    refetchInterval: 120_000,
    select: (res: any) => ({
      items: (res.data ?? []) as GeoExpediente[],
      meta: (res.meta ?? { total: 0, unassigned_count: 0, alert_count: 0 }) as GeoExpedientesMeta,
    }),
  });
}

export function useGeoOperarios(filters: Pick<GeoFilters, 'gremio'>) {
  const p = new URLSearchParams();
  if (filters.gremio) p.set('gremio', filters.gremio);
  const qs = p.toString();
  return useQuery({
    queryKey: ['geo-operarios', filters.gremio],
    queryFn: () => api.get<GeoOperario[]>(`/planning/geo/operarios${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
    select: (res: any) => (res.data ?? []) as GeoOperario[],
  });
}

export function useGeoHeatmap(enabled: boolean) {
  return useQuery({
    queryKey: ['geo-heatmap'],
    queryFn: () => api.get<GeoHeatmapPoint[]>('/planning/geo/heatmap'),
    enabled,
    staleTime: 300_000,
    select: (res: any) => (res.data ?? []) as GeoHeatmapPoint[],
  });
}
