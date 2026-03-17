import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const alertasRoutes = new Hono<{ Bindings: Env }>();

type PrioridadAlerta = 'baja' | 'media' | 'alta' | 'urgente';

function normalizePrioridad(prioridad?: PrioridadAlerta | number | null): PrioridadAlerta {
  if (typeof prioridad === 'number') {
    if (prioridad >= 9) return 'urgente';
    if (prioridad >= 7) return 'alta';
    if (prioridad >= 4) return 'media';
    return 'baja';
  }

  if (prioridad === 'baja' || prioridad === 'media' || prioridad === 'alta' || prioridad === 'urgente') {
    return prioridad;
  }

  return 'media';
}

// ─── helpers ────────────────────────────────────────────────────────
function activeAlertFilter(query: any, userId: string) {
  // (destinatario_id = user.id OR destinatario_id IS NULL)
  // AND (estado = 'activa' OR (estado = 'pospuesta' AND pospuesta_hasta <= now()))
  return query
    .or(`destinatario_id.eq.${userId},destinatario_id.is.null`)
    .or(`estado.eq.activa,and(estado.eq.pospuesta,pospuesta_hasta.lte.${new Date().toISOString()})`);
}

// ─── GET /alertas ───────────────────────────────────────────────────
alertasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const tipo = c.req.query('tipo');
  const prioridad = c.req.query('prioridad');

  let query = supabase
    .from('alertas')
    .select('*')
    .or(`destinatario_id.eq.${user.id},destinatario_id.is.null`)
    .or(`estado.eq.activa,and(estado.eq.pospuesta,pospuesta_hasta.lte.${new Date().toISOString()})`)
    .order('prioridad', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200);

  if (tipo) query = query.eq('tipo', tipo);
  if (prioridad) query = query.eq('prioridad', prioridad);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// ─── GET /alertas/count ─────────────────────────────────────────────
alertasRoutes.get('/count', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const { count, error } = await supabase
    .from('alertas')
    .select('*', { count: 'exact', head: true })
    .or(`destinatario_id.eq.${user.id},destinatario_id.is.null`)
    .or(`estado.eq.activa,and(estado.eq.pospuesta,pospuesta_hasta.lte.${new Date().toISOString()})`);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: { count: count ?? 0 }, error: null });
});

// ─── POST /alertas ──────────────────────────────────────────────────
alertasRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    tipo: string;
    titulo: string;
    mensaje?: string;
    expediente_id?: string;
    tarea_id?: string;
    prioridad?: PrioridadAlerta | number;
    destinatario_id?: string;
  }>();

  if (!body.tipo?.trim() || !body.titulo?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'tipo y titulo requeridos' } }, 422);
  }

  const { data, error } = await supabase
    .from('alertas')
    .insert({
      tipo: body.tipo,
      titulo: body.titulo,
      mensaje: body.mensaje ?? null,
      expediente_id: body.expediente_id ?? null,
      tarea_id: body.tarea_id ?? null,
      prioridad: normalizePrioridad(body.prioridad),
      destinatario_id: body.destinatario_id ?? null,
      estado: 'activa',
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'alertas',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: body,
  });

  return c.json({ data, error: null }, 201);
});

// ─── POST /alertas/:id/posponer ─────────────────────────────────────
alertasRoutes.post('/:id/posponer', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const { hasta } = await c.req.json<{ hasta: string }>();

  if (!hasta) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'hasta (ISO date) requerido' } }, 422);
  }

  const { data, error } = await supabase
    .from('alertas')
    .update({ estado: 'pospuesta', pospuesta_hasta: hasta })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'alertas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'pospuesta', pospuesta_hasta: hasta },
  });

  return c.json({ data, error: null });
});

// ─── POST /alertas/:id/resolver ─────────────────────────────────────
alertasRoutes.post('/:id/resolver', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('alertas')
    .update({ estado: 'resuelta', resuelta_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'alertas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'resuelta' },
  });

  return c.json({ data, error: null });
});

// ─── POST /alertas/:id/descartar ────────────────────────────────────
alertasRoutes.post('/:id/descartar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('alertas')
    .update({ estado: 'descartada' })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'alertas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'descartada' },
  });

  return c.json({ data, error: null });
});

// ─── POST /alertas/generate ─────────────────────────────────────────
alertasRoutes.post('/generate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  // Helper: check if active alert already exists for tipo + reference
  async function alertExists(
    tipo: string,
    ref: { expediente_id?: string; tarea_id?: string },
  ): Promise<boolean> {
    let query = supabase
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', tipo)
      .in('estado', ['activa', 'pospuesta']);

    if (ref.expediente_id) query = query.eq('expediente_id', ref.expediente_id);
    if (ref.tarea_id) query = query.eq('tarea_id', ref.tarea_id);

    const { count } = await query;
    return (count ?? 0) > 0;
  }

  // Helper: insert alert
  async function createAlert(params: {
    tipo: string;
    titulo: string;
    mensaje?: string;
    expediente_id?: string;
    tarea_id?: string;
    prioridad: PrioridadAlerta | number;
    destinatario_id?: string;
  }) {
    const { data, error } = await supabase
      .from('alertas')
      .insert({
        ...params,
        prioridad: normalizePrioridad(params.prioridad),
        estado: 'activa',
        mensaje: params.mensaje ?? null,
        expediente_id: params.expediente_id ?? null,
        tarea_id: params.tarea_id ?? null,
        destinatario_id: params.destinatario_id ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      await insertAudit(supabase, {
        tabla: 'alertas',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { tipo: params.tipo, auto_generated: true },
      });
    }
    return { data, error };
  }

  // ── a) Tareas vencidas ────────────────────────────────────────────
  {
    const { data: tareas } = await supabase
      .from('tareas_internas')
      .select('id, titulo, expediente_id, asignado_a')
      .lt('fecha_limite', now)
      .not('estado', 'in', '("resuelta","cancelada")')
      .limit(500);

    for (const t of tareas ?? []) {
      if (await alertExists('tarea_vencida', { tarea_id: t.id })) {
        skipped++;
        continue;
      }
      const { error } = await createAlert({
        tipo: 'tarea_vencida',
        titulo: `Tarea vencida: ${t.titulo}`,
        tarea_id: t.id,
        expediente_id: t.expediente_id ?? undefined,
        prioridad: 8,
        destinatario_id: t.asignado_a ?? undefined,
      });
      if (!error) created++;
      else skipped++;
    }
  }

  // ── b) SLA próximo a vencer (< 48h) ──────────────────────────────
  {
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const terminalStates = ['CERRADO', 'CANCELADO'];

    const { data: expedientes } = await supabase
      .from('expedientes')
      .select('id, numero_expediente, fecha_limite_sla, estado')
      .not('fecha_limite_sla', 'is', null)
      .gt('fecha_limite_sla', now)
      .lt('fecha_limite_sla', in48h)
      .not('estado', 'in', `("${terminalStates.join('","')}")`)
      .limit(500);

    for (const exp of expedientes ?? []) {
      if (await alertExists('sla_proximo', { expediente_id: exp.id })) {
        skipped++;
        continue;
      }
      const { error } = await createAlert({
        tipo: 'sla_proximo',
        titulo: `SLA próximo a vencer: ${exp.numero_expediente}`,
        expediente_id: exp.id,
        prioridad: 'urgente',
      });
      if (!error) created++;
      else skipped++;
    }
  }

  // ── c) Partes pendientes antiguos (> 3 días) ─────────────────────
  {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: partes } = await supabase
      .from('partes_operario')
      .select('id, operario_id, expediente_id')
      .eq('validacion_estado', 'pendiente')
      .lt('created_at', threeDaysAgo)
      .limit(500);

    for (const p of partes ?? []) {
      if (await alertExists('parte_pendiente_antiguo', { expediente_id: p.expediente_id })) {
        skipped++;
        continue;
      }
      const { error } = await createAlert({
        tipo: 'parte_pendiente_antiguo',
        titulo: `Parte pendiente de validación > 3 días`,
        expediente_id: p.expediente_id ?? undefined,
        prioridad: 'media',
        destinatario_id: p.operario_id ?? undefined,
      });
      if (!error) created++;
      else skipped++;
    }
  }

  // ── d) Pendientes sin revisión ────────────────────────────────────
  {
    const { data: expedientes } = await supabase
      .from('expedientes')
      .select('id, numero_expediente, fecha_revision_pendiente')
      .like('estado', 'PENDIENTE%')
      .or(`fecha_revision_pendiente.is.null,fecha_revision_pendiente.lt.${now}`)
      .limit(500);

    for (const exp of expedientes ?? []) {
      if (await alertExists('pendiente_sin_revision', { expediente_id: exp.id })) {
        skipped++;
        continue;
      }
      const { error } = await createAlert({
        tipo: 'pendiente_sin_revision',
        titulo: `Expediente pendiente sin revisión: ${exp.numero_expediente}`,
        expediente_id: exp.id,
        prioridad: 'alta',
      });
      if (!error) created++;
      else skipped++;
    }
  }

  await insertAudit(supabase, {
    tabla: 'alertas',
    registro_id: 'batch',
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { action: 'generate', created, skipped },
  });

  return c.json({ data: { created, skipped }, error: null });
});
