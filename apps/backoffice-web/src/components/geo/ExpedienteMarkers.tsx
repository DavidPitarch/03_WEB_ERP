/**
 * Capa de marcadores de expedientes sobre el mapa.
 *
 * Cada pin se colorea según prioridad/estado/SLA.
 * Al hacer clic se notifica al padre para abrir el panel lateral.
 */

import { useCallback } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import type { GeoExpediente } from '@erp/types';
import { pinColor, estadoLabel } from '@/lib/geo-utils';

interface ExpedienteMarkersProps {
  expedientes: GeoExpediente[];
  selectedId: string | null;
  onSelect: (exp: GeoExpediente) => void;
}

export function ExpedienteMarkers({ expedientes, selectedId, onSelect }: ExpedienteMarkersProps) {
  const handleClick = useCallback(
    (exp: GeoExpediente) => () => onSelect(exp),
    [onSelect]
  );

  return (
    <>
      {expedientes.map((exp) => {
        const color = pinColor(exp);
        const isSelected = selectedId === exp.id;

        return (
          <CircleMarker
            key={exp.id}
            center={[exp.lat, exp.lng]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: isSelected ? '#1d4ed8' : color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{ click: handleClick(exp) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <strong>{exp.numero_expediente}</strong>
                <br />
                {estadoLabel(exp.estado)} · {exp.prioridad}
                <br />
                {exp.localidad}
                {exp.operario_nombre && (
                  <>
                    <br />
                    <span style={{ color: '#64748b' }}>↪ {exp.operario_nombre}</span>
                  </>
                )}
                {exp.sla_status === 'vencido' && (
                  <><br /><span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ SLA vencido</span></>
                )}
                {exp.sla_status === 'urgente' && (
                  <><br /><span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ SLA urgente</span></>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
