/**
 * Capa de marcadores de operarios y sus zonas de cobertura (CP).
 *
 * Muestra un marcador cuadrado en la base del operario.
 * Al hacer clic abre el panel de detalle del operario.
 */

import { DivIcon } from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { GeoOperario, OperarioPosition } from '@erp/types';

interface OperarioMarkersProps {
  operarios: GeoOperario[];
  selectedId: string | null;
  realtimePositions: Record<string, OperarioPosition>;
  onSelect: (op: GeoOperario) => void;
}

function makeOperarioIcon(op: GeoOperario, isSelected: boolean): DivIcon {
  const bg = op.overloaded ? '#dc2626' : isSelected ? '#1d4ed8' : '#0d9488';
  return new DivIcon({
    html: `<div style="
      width:28px;height:28px;border-radius:6px;
      background:${bg};color:#fff;font-size:11px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);
      cursor:pointer;
    ">${op.nombre.charAt(0)}${op.apellidos.charAt(0)}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function makeRealtimeIcon(): DivIcon {
  return new DivIcon({
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#22c55e;border:3px solid #fff;
      box-shadow:0 0 0 2px #22c55e;
    "></div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function OperarioMarkers({
  operarios,
  selectedId,
  realtimePositions,
  onSelect,
}: OperarioMarkersProps) {
  return (
    <>
      {operarios
        .filter((op) => op.base_lat != null && op.base_lng != null)
        .map((op) => {
          const isSelected = selectedId === op.id;
          const _livePos = realtimePositions[op.id]; void _livePos;

          return (
            <Marker
              key={op.id}
              position={[op.base_lat!, op.base_lng!]}
              icon={makeOperarioIcon(op, isSelected)}
              eventHandlers={{ click: () => onSelect(op) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <strong>{op.nombre} {op.apellidos}</strong>
                  <br />
                  {op.citas_hoy} citas hoy · {op.carga_pct}% carga
                  {op.overloaded && (
                    <><br /><span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Sobrecargado</span></>
                  )}
                  {op.gremios?.length > 0 && (
                    <><br /><span style={{ color: '#64748b' }}>{op.gremios.join(' · ')}</span></>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

      {/* Posición en tiempo real (desacoplado) */}
      {Object.values(realtimePositions).map((pos) => (
        <Marker
          key={`live-${pos.operario_id}`}
          position={[pos.lat, pos.lng]}
          icon={makeRealtimeIcon()}
        >
          <Tooltip direction="top">En movimiento</Tooltip>
        </Marker>
      ))}
    </>
  );
}
