/**
 * GeoMap — Wrapper sobre react-leaflet.
 *
 * Renderiza el mapa base con tiles OSM y expone un slot de children
 * para capas adicionales (pines, zonas, heat, rutas).
 *
 * El import de los CSS de Leaflet se hace aquí para encapsular la dependencia.
 */

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import type { Map as LeafletMap, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SPAIN_CENTER, DEFAULT_ZOOM } from '@/lib/geo-utils';

interface GeoMapProps {
  children?: React.ReactNode;
  onBoundsChange?: (bbox: string) => void;
  onMapReady?: (map: LeafletMap) => void;
  className?: string;
}

/** Listener de eventos de mapa (zoom/move) para frustum culling */
function BoundsWatcher({ onBoundsChange }: { onBoundsChange?: (bbox: string) => void }) {
  useMapEvents({
    moveend: (e) => {
      if (!onBoundsChange) return;
      const b: LatLngBounds = e.target.getBounds();
      const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
      onBoundsChange(bbox);
    },
    zoomend: (e) => {
      if (!onBoundsChange) return;
      const b: LatLngBounds = e.target.getBounds();
      const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
      onBoundsChange(bbox);
    },
  });
  return null;
}

function MapReadyEmitter({ onMapReady }: { onMapReady?: (map: LeafletMap) => void }) {
  const map = useMap();
  const called = useRef(false);
  useEffect(() => {
    if (!called.current && onMapReady) {
      called.current = true;
      onMapReady(map);
    }
  }, [map, onMapReady]);
  return null;
}

export function GeoMap({ children, onBoundsChange, onMapReady, className }: GeoMapProps) {
  return (
    <MapContainer
      center={SPAIN_CENTER}
      zoom={DEFAULT_ZOOM}
      className={`geo-map ${className ?? ''}`}
      style={{ width: '100%', height: '100%' }}
      // Evita que el scroll del mapa se lleve el scroll de la página
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <MapReadyEmitter onMapReady={onMapReady} />
      {children}
    </MapContainer>
  );
}
