import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const festivosRoutes = new Hono<{ Bindings: Env }>();

// GET /festivos?anio=2026 — Listar festivos del año
festivosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const anio = c.req.query('anio') ?? new Date().getFullYear().toString();
  const ambito = c.req.query('ambito');

  let query = supabase
    .from('cal_festivos')
    .select('*')
    .gte('fecha', `${anio}-01-01`)
    .lte('fecha', `${anio}-12-31`);

  if (ambito) query = query.eq('ambito', ambito);
  query = query.order('fecha');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /festivos — Crear festivo
festivosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    fecha: string;
    nombre: string;
    ambito?: string;
    comunidad_autonoma?: string;
    provincia?: string;
    municipio?: string;
  }>();

  if (!body.fecha || !body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'fecha y nombre son obligatorios' } }, 422);
  }

  const { data, error } = await supabase
    .from('cal_festivos')
    .insert({
      fecha: body.fecha,
      nombre: body.nombre.trim(),
      ambito: body.ambito ?? 'nacional',
      comunidad_autonoma: body.comunidad_autonoma ?? null,
      provincia: body.provincia ?? null,
      municipio: body.municipio ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe un festivo para esa fecha y ámbito' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'cal_festivos', accion: 'INSERT', registro_id: data.id ?? data.fecha, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// DELETE /festivos/:id
festivosRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('cal_festivos').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'cal_festivos', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { deleted: true }, error: null });
});

// DELETE /festivos/fecha/:fecha — Eliminar por fecha y ámbito
festivosRoutes.delete('/fecha/:fecha', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const fecha = c.req.param('fecha');
  const ambito = c.req.query('ambito') ?? 'nacional';

  const { error } = await supabase
    .from('cal_festivos')
    .delete()
    .eq('fecha', fecha)
    .eq('ambito', ambito);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'cal_festivos', accion: 'DELETE', registro_id: fecha, actor_id: user.id, cambios: { ambito } });
  return c.json({ data: { deleted: true }, error: null });
});
