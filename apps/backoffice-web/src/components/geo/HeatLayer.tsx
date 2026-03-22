/**
 * Capa de calor — renderiza círculos semi-transparentes sobre los CP
 * con mayor densidad de expedientes. No requiere plugin externo.
 *
 * Para v2 con mayor precisión se puede sustituir por leaflet.heat.
 */

import { CircleMarker, Tooltip } from 'react-leaflet';
import type { HeatPoint } from '@erp/types';

interface HeatLayerProps {
  points: HeatPoint[];
}

function heatColor(intensity: number): string {
  // Gradiente: azul (frío) → amarillo → rojo (caliente)
  if (intensity < 0.3) return '#3b82f6';
  if (intensity < 0.6) return '#f59e0b';
  return '#dc2626';
}

export function HeatLayer({ points }: HeatLayerProps) {
  return (
    <>
      {points.map((p) => (
        <CircleMarker
          key={p.cp}
          center={[p.lat, p.lng]}
          radius={20 + p.intensity * 30}
          pathOptions={{
            color: 'transparent',
            fillColor: heatColor(p.intensity),
            fillOpacity: 0.25 + p.intensity * 0.35,
          }}
        >
          <Tooltip direction="top" opacity={0.9}>
            <span style={{ fontSize: 12 }}>
              CP {p.cp} — {p.count} expedientes
              {p.urgentes > 0 && ` (${p.urgentes} urgentes)`}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
