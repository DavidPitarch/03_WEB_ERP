import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface GeoFilters {
  estado: string[];
  compania_id: string;
  prioridad: string[];
  gremio: string;
  operario_id: string;
  fecha_ini: string;
  fecha_fin: string;
  showHeatmap: boolean;
  showZonas: boolean;
  showRutas: boolean;
}

const DEFAULT_FILTERS: GeoFilters = {
  estado: [],
  compania_id: '',
  prioridad: [],
  gremio: '',
  operario_id: '',
  fecha_ini: '',
  fecha_fin: '',
  showHeatmap: false,
  showZonas: true,
  showRutas: true,
};

export function useGeoFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<GeoFilters>(() => ({
    estado:       params.get('estado')?.split(',').filter(Boolean) ?? [],
    compania_id:  params.get('compania_id') ?? '',
    prioridad:    params.get('prioridad')?.split(',').filter(Boolean) ?? [],
    gremio:       params.get('gremio') ?? '',
    operario_id:  params.get('operario_id') ?? '',
    fecha_ini:    params.get('fecha_ini') ?? '',
    fecha_fin:    params.get('fecha_fin') ?? '',
    showHeatmap:  params.get('heatmap') === '1',
    showZonas:    params.get('zonas') !== '0',
    showRutas:    params.get('rutas') !== '0',
  }), [params]);

  const setFilters = useCallback((patch: Partial<GeoFilters>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const merged = { ...filters, ...patch };

      if (merged.estado.length)       next.set('estado',      merged.estado.join(','));
      else                            next.delete('estado');

      if (merged.compania_id)         next.set('compania_id', merged.compania_id);
      else                            next.delete('compania_id');

      if (merged.prioridad.length)    next.set('prioridad',   merged.prioridad.join(','));
      else                            next.delete('prioridad');

      if (merged.gremio)              next.set('gremio',      merged.gremio);
      else                            next.delete('gremio');

      if (merged.operario_id)         next.set('operario_id', merged.operario_id);
      else                            next.delete('operario_id');

      if (merged.fecha_ini)           next.set('fecha_ini',   merged.fecha_ini);
      else                            next.delete('fecha_ini');

      if (merged.fecha_fin)           next.set('fecha_fin',   merged.fecha_fin);
      else                            next.delete('fecha_fin');

      if (merged.showHeatmap)         next.set('heatmap', '1');
      else                            next.delete('heatmap');

      if (!merged.showZonas)          next.set('zonas', '0');
      else                            next.delete('zonas');

      if (!merged.showRutas)          next.set('rutas', '0');
      else                            next.delete('rutas');

      return next;
    }, { replace: true });
  }, [filters, setParams]);

  const resetFilters = useCallback(() => {
    setParams({}, { replace: true });
  }, [setParams]);

  const hasActiveFilters = useMemo(() =>
    filters.estado.length > 0 ||
    !!filters.compania_id ||
    filters.prioridad.length > 0 ||
    !!filters.gremio ||
    !!filters.operario_id,
  [filters]);

  return { filters, setFilters, resetFilters, hasActiveFilters, DEFAULT_FILTERS };
}
