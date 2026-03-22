/**
 * Utilidades geoespaciales para el frontend
 */

import type { GeoExpediente, GeoOperario } from '@erp/types';

/** Distancia Haversine en km entre dos puntos */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Color del pin según prioridad del expediente */
export function pinColor(exp: GeoExpediente): string {
  if (exp.sla_status === 'vencido')  return '#dc2626'; // red-600
  if (exp.prioridad === 'urgente')   return '#f97316'; // orange-500
  if (exp.sla_status === 'urgente')  return '#f59e0b'; // amber-500
  if (exp.estado === 'NO_ASIGNADO' || exp.estado === 'NUEVO') return '#8b5cf6'; // purple-500
  if (exp.estado === 'EN_CURSO')     return '#3b82f6'; // blue-500
  if (exp.estado === 'EN_PLANIFICACION') return '#14b8a6'; // teal-500
  return '#64748b'; // slate-500
}

/** Etiqueta corta de estado para tooltip */
export function estadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    NUEVO:             'Nuevo',
    NO_ASIGNADO:       'Sin asignar',
    EN_PLANIFICACION:  'En planificación',
    EN_CURSO:          'En curso',
    PENDIENTE:         'Pendiente',
    PENDIENTE_MATERIAL:'Pend. material',
    PENDIENTE_PERITO:  'Pend. perito',
    PENDIENTE_CLIENTE: 'Pend. cliente',
    FINALIZADO:        'Finalizado',
    FACTURADO:         'Facturado',
    COBRADO:           'Cobrado',
    CERRADO:           'Cerrado',
    CANCELADO:         'Cancelado',
  };
  return labels[estado] ?? estado;
}

/** Color de carga del operario (0-100%) → clase CSS */
export function cargaClass(pct: number): string {
  if (pct >= 90) return 'carga--alta';
  if (pct >= 60) return 'carga--media';
  return 'carga--baja';
}

/** Ordena operarios por proximidad a un punto */
export function sortByDistance(
  operarios: GeoOperario[],
  lat: number,
  lng: number
): Array<GeoOperario & { distance_km: number }> {
  return operarios
    .filter((op) => op.base_lat != null && op.base_lng != null)
    .map((op) => ({
      ...op,
      distance_km: haversineKm(lat, lng, op.base_lat!, op.base_lng!),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

/** Bounding box de España peninsular (para zoom inicial) */
export const SPAIN_BOUNDS: [[number, number], [number, number]] = [
  [27.5, -18.5], // SW
  [43.9, 4.6],   // NE
];

/** Centro de España peninsular */
export const SPAIN_CENTER: [number, number] = [40.4, -3.7];

/** Zoom inicial del mapa */
export const DEFAULT_ZOOM = 6;

/** Zoom al que se activa el frustum culling (bbox filter) */
export const BBOX_ZOOM_THRESHOLD = 9;
