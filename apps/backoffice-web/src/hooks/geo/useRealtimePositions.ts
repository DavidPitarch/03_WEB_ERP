/**
 * Hook desacoplado para tracking en tiempo real de operarios.
 *
 * Solo se activa si la tabla operario_positions tiene datos
 * y el feature flag VITE_GEO_REALTIME_ENABLED está activo.
 * Si no, devuelve un mapa vacío sin efectos secundarios.
 */

import { useEffect, useState } from 'react';
import type { OperarioPosition } from '@erp/types';
import { supabase } from '@/lib/supabase';

type PositionMap = Record<string, OperarioPosition>;

export function useRealtimePositions(enabled = false): PositionMap {
  const [positions, setPositions] = useState<PositionMap>({});

  useEffect(() => {
    const realtimeEnabled =
      enabled && import.meta.env.VITE_GEO_REALTIME_ENABLED === 'true';

    if (!realtimeEnabled) return;

    const channel = supabase
      .channel('operario-positions-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'operario_positions',
        },
        (payload) => {
          const pos = payload.new as OperarioPosition;
          setPositions((prev) => ({
            ...prev,
            [pos.operario_id]: pos,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return positions;
}
