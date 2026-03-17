import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const baremosRoutes = new Hono<{ Bindings: Env }>();

// GET /baremos — Listar baremos con filtros opcionales
baremosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const compania_id = c.req.query('compania_id');
  const tipo = c.req.query('tipo');
  const activo = c.req.query('activo');

  let query = supabase.from('baremos').select('*');

  if (compania_id) query = query.eq('compania_id', compania_id);
  if (tipo) query = query.eq('tipo', tipo);
  if (activo !== undefined && activo !== null && activo !== '') {
    query = query.eq('activo', activo === 'true');
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /baremos/import-csv — Importar baremo desde CSV
baremosRoutes.post('/import-csv', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const body = await c.req.json<{
    compania_id: string;
    nombre: string;
    tipo: 'compania' | 'operario';
    operario_id?: string;
    vigente_desde: string;
    csv_text: string;
  }>();

  if (!body.compania_id || !body.nombre || !body.tipo || !body.vigente_desde || !body.csv_text) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'Campos requeridos: compania_id, nombre, tipo, vigente_desde, csv_text' } }, 422);
  }

  // Create the baremo record
  const { data: baremo, error: baremoError } = await supabase
    .from('baremos')
    .insert({
      compania_id: body.compania_id,
      nombre: body.nombre,
      tipo: body.tipo,
      operario_id: body.operario_id ?? null,
      vigente_desde: body.vigente_desde,
      activo: true,
    })
    .select('id')
    .single();

  if (baremoError || !baremo) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: baremoError?.message ?? 'Error creando baremo' } }, 500);
  }

  // Parse CSV
  const lines = body.csv_text.split('\n');
  const partidas: Array<{
    baremo_id: string;
    especialidad: string;
    codigo: string;
    descripcion: string;
    precio_unitario: number | null;
    precio_operario: number | null;
  }> = [];
  const errors: string[] = [];
  let currentEspecialidad = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Section header: line that does NOT start with semicolon
    if (!raw.startsWith(';')) {
      currentEspecialidad = raw.replace(/;+$/, '').trim();
      continue;
    }

    // Partida line: starts with semicolon
    const parts = raw.split(';');
    // parts[0] is empty (before first semicolon)
    const codigo = (parts[1] ?? '').trim();
    const descripcion = (parts[2] ?? '').trim();

    if (!codigo && !descripcion) continue;

    if (!codigo || !descripcion) {
      errors.push(`Fila ${i + 1}: código o descripción vacíos`);
      continue;
    }

    const parseDecimal = (val: string | undefined): number | null => {
      if (!val || !val.trim()) return null;
      const normalized = val.trim().replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? null : num;
    };

    let precio_unitario: number | null = null;
    let precio_operario: number | null = null;

    if (body.tipo === 'compania') {
      // Format: ;codigo;descripcion;precio_unitario;;
      precio_unitario = parseDecimal(parts[3]);
      if (parts[3]?.trim() && precio_unitario === null) {
        errors.push(`Fila ${i + 1}: precio_unitario no válido '${parts[3]}'`);
        continue;
      }
    } else {
      // operario format: ;codigo;descripcion;;precio_operario;
      precio_operario = parseDecimal(parts[4]);
      if (parts[4]?.trim() && precio_operario === null) {
        errors.push(`Fila ${i + 1}: precio_operario no válido '${parts[4]}'`);
        continue;
      }
    }

    partidas.push({
      baremo_id: baremo.id,
      especialidad: currentEspecialidad,
      codigo,
      descripcion,
      precio_unitario,
      precio_operario,
    });
  }

  if (partidas.length === 0) {
    // Rollback baremo
    await supabase.from('baremos').delete().eq('id', baremo.id);
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'No se encontraron partidas válidas en el CSV' } }, 422);
  }

  // Bulk insert partidas in batches of 500
  let insertedCount = 0;
  for (let i = 0; i < partidas.length; i += 500) {
    const batch = partidas.slice(i, i + 500);
    const { error: insertError } = await supabase.from('partidas_baremo').insert(batch);
    if (insertError) {
      errors.push(`Error insertando lote ${Math.floor(i / 500) + 1}: ${insertError.message}`);
    } else {
      insertedCount += batch.length;
    }
  }

  await insertAudit(supabase, {
    tabla: 'baremos',
    registro_id: baremo.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { nombre: body.nombre, tipo: body.tipo, partidas_count: insertedCount, import: 'csv' },
  });

  return c.json({
    data: { baremo_id: baremo.id, partidas_count: insertedCount, errors },
    error: null,
  });
});

// GET /baremos/:id — Detalle de baremo con partidas
baremosRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('baremos')
    .select('*, partidas_baremo(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Baremo no encontrado' } }, 404);
  }

  return c.json({ data, error: null });
});

// POST /baremos — Crear baremo
baremosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  const { data, error } = await supabase
    .from('baremos')
    .insert({
      compania_id: body.compania_id,
      nombre: body.nombre,
      tipo: body.tipo,
      operario_id: body.operario_id ?? null,
      vigente_desde: body.vigente_desde,
      activo: body.activo ?? true,
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'baremos',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: body,
  });

  return c.json({ data, error: null }, 201);
});

// PUT /baremos/:id — Actualizar baremo
baremosRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { data, error } = await supabase
    .from('baremos')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'baremos',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: body,
  });

  return c.json({ data, error: null });
});

// GET /baremos/:id/partidas — Listar partidas con filtro opcional por especialidad
baremosRoutes.get('/:id/partidas', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const especialidad = c.req.query('especialidad');

  let query = supabase
    .from('partidas_baremo')
    .select('*')
    .eq('baremo_id', id)
    .order('especialidad')
    .order('codigo');

  if (especialidad) query = query.eq('especialidad', especialidad);

  const { data, error } = await query;

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});
