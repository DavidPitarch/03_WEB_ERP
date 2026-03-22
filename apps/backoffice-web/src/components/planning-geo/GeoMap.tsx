import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoExpediente, GeoOperario, GeoHeatmapPoint } from '@/hooks/usePlanningGeo';

// Colores por SLA
const SLA_COLOR: Record<string, string> = {
  vencido:  '#ef4444',
  urgente:  '#f59e0b',
  ok:       '#22c55e',
  sin_sla:  '#94a3b8',
};


interface GeoMapProps {
  expedientes: GeoExpediente[];
  operarios: GeoOperario[];
  heatmapPoints: GeoHeatmapPoint[];
  showHeatmap: boolean;
  showZonas: boolean;
  selectedExpedienteId: string | null;
  onExpedienteClick: (exp: GeoExpediente) => void;
  onOperarioClick: (op: GeoOperario) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
}

export function GeoMap({
  expedientes,
  operarios,
  heatmapPoints,
  showHeatmap,
  showZonas,
  selectedExpedienteId,
  onExpedienteClick,
  onOperarioClick,
  onMapClick,
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const loadedRef    = useRef(false);
  const popupRef     = useRef<maplibregl.Popup | null>(null);

  // Serialize data to refs so callbacks don't go stale
  const expedientesRef = useRef(expedientes);
  expedientesRef.current = expedientes;
  const operariosRef = useRef(operarios);
  operariosRef.current = operarios;

  // ── Map init (once) ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
      },
      center: [-3.7, 40.2],
      zoom: 5.8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      // ── Sources ──────────────────────────────────────────────
      map.addSource('expedientes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 45,
      });

      map.addSource('operarios', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('heatmap-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // ── Heatmap layer ────────────────────────────────────────
      map.addLayer({
        id: 'exp-heatmap',
        type: 'heatmap',
        source: 'heatmap-src',
        maxzoom: 14,
        paint: {
          'heatmap-weight': ['get', 'intensity'],
          'heatmap-intensity': 1.2,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.2, 'rgba(34,197,94,0.6)',
            0.5, 'rgba(245,158,11,0.7)',
            0.8, 'rgba(239,68,68,0.8)',
            1,   'rgba(185,28,28,0.9)',
          ],
          'heatmap-radius': 35,
          'heatmap-opacity': 0.75,
        },
        layout: { visibility: 'none' },
      });

      // ── Cluster circles ──────────────────────────────────────
      map.addLayer({
        id: 'exp-clusters',
        type: 'circle',
        source: 'expedientes',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#3b82f6', 5, '#f59e0b', 20, '#ef4444',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 20, 32],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.88,
        },
      });

      map.addLayer({
        id: 'exp-cluster-count',
        type: 'symbol',
        source: 'expedientes',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 11,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // ── Individual expediente circles ────────────────────────
      map.addLayer({
        id: 'exp-circles',
        type: 'circle',
        source: 'expedientes',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], true], 12, 8],
          'circle-color': [
            'match', ['get', 'sla_status'],
            'vencido', SLA_COLOR.vencido,
            'urgente', SLA_COLOR.urgente,
            'ok',      SLA_COLOR.ok,
            SLA_COLOR.sin_sla,
          ],
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 3, 1.5],
          'circle-stroke-color': '#ffffff',
        },
      });

      // ── Operario base markers ────────────────────────────────
      map.addLayer({
        id: 'op-circles',
        type: 'circle',
        source: 'operarios',
        paint: {
          'circle-radius': 11,
          'circle-color': ['case', ['get', 'overloaded'], '#ef4444', '#8b5cf6'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'op-labels',
        type: 'symbol',
        source: 'operarios',
        layout: {
          'text-field': ['get', 'initials'],
          'text-size': 10,
          'text-offset': [0, 0],
        },
        paint: { 'text-color': '#ffffff' },
      });

      // ── Click handlers ───────────────────────────────────────
      map.on('click', 'exp-circles', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const exp = expedientesRef.current.find((x) => x.id === props.id);
        if (exp) onExpedienteClick(exp);
      });

      map.on('click', 'exp-clusters', (e) => {
        const src = map.getSource('expedientes') as maplibregl.GeoJSONSource;
        const cluster = e.features?.[0];
        if (!cluster) return;
        src.getClusterExpansionZoom(cluster.properties!.cluster_id).then((zoom) => {
          if (zoom === null) return;
          map.easeTo({
            center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom + 0.5,
          });
        }).catch(() => undefined);
      });

      map.on('click', 'op-circles', (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const op = operariosRef.current.find((x) => x.id === props.id);
        if (op) onOperarioClick(op);
      });

      map.on('click', (e) => {
        // Only fire if no feature was clicked
        const features = map.queryRenderedFeatures(e.point, { layers: ['exp-circles', 'op-circles', 'exp-clusters'] });
        if (!features.length && onMapClick) {
          onMapClick(e.lngLat);
        }
      });

      // ── Cursor ───────────────────────────────────────────────
      ['exp-circles', 'op-circles', 'exp-clusters'].forEach((layer) => {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      });

      loadedRef.current = true;
      mapRef.current = map;

      // Force first data push now that map is loaded
      syncSources(map, expedientesRef.current, operariosRef.current, heatmapPoints, selectedExpedienteId);
    });

    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '260px' });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync expedientes ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    syncSources(map, expedientes, operarios, heatmapPoints, selectedExpedienteId);
  }, [expedientes, operarios, heatmapPoints, selectedExpedienteId]);

  // ── Toggle heatmap visibility ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (map.getLayer('exp-heatmap')) {
      map.setLayoutProperty('exp-heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
    }
    if (map.getLayer('exp-circles')) {
      map.setLayoutProperty('exp-circles', 'visibility', showHeatmap ? 'none' : 'visible');
    }
    if (map.getLayer('exp-clusters')) {
      map.setLayoutProperty('exp-clusters', 'visibility', showHeatmap ? 'none' : 'visible');
    }
    if (map.getLayer('exp-cluster-count')) {
      map.setLayoutProperty('exp-cluster-count', 'visibility', showHeatmap ? 'none' : 'visible');
    }
  }, [showHeatmap]);

  // ── Toggle operario zones ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (map.getLayer('op-circles')) {
      map.setLayoutProperty('op-circles', 'visibility', showZonas ? 'visible' : 'none');
    }
    if (map.getLayer('op-labels')) {
      map.setLayoutProperty('op-labels', 'visibility', showZonas ? 'visible' : 'none');
    }
  }, [showZonas]);

  return <div ref={containerRef} className="geo-map-canvas" />;
}

// ── Helpers ─────────────────────────────────────────────────────

function syncSources(
  map: maplibregl.Map,
  expedientes: GeoExpediente[],
  operarios: GeoOperario[],
  heatmapPoints: GeoHeatmapPoint[],
  selectedId: string | null,
) {
  const expSrc = map.getSource('expedientes') as maplibregl.GeoJSONSource | undefined;
  if (expSrc) {
    expSrc.setData({
      type: 'FeatureCollection',
      features: expedientes.map((e) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: {
          id: e.id,
          numero_expediente: e.numero_expediente,
          estado: e.estado,
          prioridad: e.prioridad,
          sla_status: e.sla_status,
          compania_nombre: e.compania_nombre ?? '',
          operario_nombre: e.operario_nombre ?? '',
          direccion_siniestro: e.direccion_siniestro,
          selected: e.id === selectedId,
        },
      })),
    });
  }

  const opSrc = map.getSource('operarios') as maplibregl.GeoJSONSource | undefined;
  if (opSrc) {
    opSrc.setData({
      type: 'FeatureCollection',
      features: operarios
        .filter((o) => o.base_lat !== null && o.base_lng !== null)
        .map((o) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [o.base_lng!, o.base_lat!] },
          properties: {
            id: o.id,
            nombre: o.nombre,
            apellidos: o.apellidos,
            citas_hoy: o.citas_hoy,
            carga_pct: o.carga_pct,
            overloaded: o.overloaded,
            initials: (o.nombre[0] ?? '') + (o.apellidos[0] ?? ''),
          },
        })),
    });
  }

  const hmSrc = map.getSource('heatmap-src') as maplibregl.GeoJSONSource | undefined;
  if (hmSrc) {
    hmSrc.setData({
      type: 'FeatureCollection',
      features: heatmapPoints.map((h) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
        properties: { intensity: h.intensity, count: h.count },
      })),
    });
  }
}
