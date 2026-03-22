import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NavBadges } from '@/navigation/types';

/**
 * Agrega todos los contadores del sidebar en un único objeto reactivo.
 * Refresca cada 30 segundos para mantener los badges actualizados.
 *
 * Combina múltiples fuentes:
 *  - /bandejas/contadores         → estados de expediente (asignaciones, pendientes…)
 *  - /bandejas/partes-pendientes  → trabajos no revisados
 *  - /bandejas/informes-caducados → informes sin parte presentado
 *  - /alertas/count               → solicitudes/avisos activos
 */
export function useNavBadges(): NavBadges {
  // ── Contadores de expedientes por estado ──────────────────────────────────
  const { data: contadores } = useQuery({
    queryKey: ['nav-badges-contadores'],
    queryFn: () => api.get<Record<string, number>>('/bandejas/contadores'),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // ── Partes pendientes de validación ───────────────────────────────────────
  const { data: partes } = useQuery({
    queryKey: ['nav-badges-partes'],
    queryFn: () => api.get<{ count: number }>('/bandejas/partes-pendientes'),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // ── Informes caducados ────────────────────────────────────────────────────
  const { data: informes } = useQuery({
    queryKey: ['nav-badges-informes'],
    queryFn: () => api.get<unknown[]>('/bandejas/informes-caducados'),
    refetchInterval: 60_000,
    staleTime: 50_000,
  });

  // ── Alertas / solicitudes ─────────────────────────────────────────────────
  const { data: alertas } = useQuery({
    queryKey: ['nav-badges-alertas'],
    queryFn: () => api.get<{ count: number }>('/alertas/count'),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // ── Extraer valores de las respuestas (manejo defensivo) ──────────────────
  const estados: Record<string, number> =
    contadores && 'data' in contadores && contadores.data
      ? (contadores.data as Record<string, number>)
      : {};

  const partesPendientes =
    partes && 'data' in partes && partes.data
      ? ((partes.data as { count: number }).count ?? 0)
      : 0;

  const informesCaducados =
    informes && 'data' in informes && Array.isArray(informes.data)
      ? informes.data.length
      : 0;

  const solicitudesCount =
    alertas && 'data' in alertas && alertas.data
      ? ((alertas.data as { count: number }).count ?? 0)
      : 0;

  // ── Asignaciones = expedientes sin asignar + en planificación ─────────────
  const asignacionesCount =
    (estados['NO_ASIGNADO'] ?? 0) + (estados['EN_PLANIFICACION'] ?? 0);

  // ── Facturas pendientes = FINALIZADO (listo para facturar) ────────────────
  const facturasPendientes = estados['FINALIZADO'] ?? 0;

  return {
    asignaciones:       asignacionesCount,
    solicitudes:        solicitudesCount,
    comunicaciones:     0,                  // endpoint pendiente
    partes_pendientes:  partesPendientes,
    informes_caducados: informesCaducados,
    facturas_caducadas: 0,                  // endpoint pendiente
    facturas_pendientes: facturasPendientes,
    tareas:             0,                  // endpoint pendiente
  };
}
