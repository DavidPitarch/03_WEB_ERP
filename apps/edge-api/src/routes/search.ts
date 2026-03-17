import { Hono } from 'hono';
import type { SearchResult } from '@erp/types';
import type { Env } from '../types';

export const searchRoutes = new Hono<{ Bindings: Env }>();

// GET /search?q=term — Búsqueda universal
searchRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const q = c.req.query('q')?.trim();

  if (!q || q.length < 2) {
    return c.json({ data: [], error: null });
  }

  const results: SearchResult[] = [];

  // Buscar en expedientes
  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, descripcion, estado, numero_poliza, numero_siniestro_cia')
    .or(`numero_expediente.ilike.%${q}%,descripcion.ilike.%${q}%,numero_poliza.ilike.%${q}%,numero_siniestro_cia.ilike.%${q}%,referencia_externa.ilike.%${q}%`)
    .limit(10);

  for (const exp of expedientes ?? []) {
    results.push({
      type: 'expediente',
      id: exp.id,
      title: exp.numero_expediente,
      subtitle: `${exp.estado} — ${exp.descripcion?.substring(0, 60)}`,
      expediente_id: exp.id,
    });
  }

  // Buscar en asegurados
  const { data: asegurados } = await supabase
    .from('asegurados')
    .select('id, nombre, apellidos, telefono, nif')
    .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%,telefono.ilike.%${q}%,nif.ilike.%${q}%`)
    .limit(10);

  for (const aseg of asegurados ?? []) {
    results.push({
      type: 'asegurado',
      id: aseg.id,
      title: `${aseg.nombre} ${aseg.apellidos}`,
      subtitle: `Tel: ${aseg.telefono}${aseg.nif ? ` — NIF: ${aseg.nif}` : ''}`,
    });
  }

  return c.json({ data: results, error: null });
});
