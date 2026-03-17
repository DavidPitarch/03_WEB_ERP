import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { enqueuePartePdf } from '../services/pdf-pipeline';
import type { Env } from '../types';

export const partesRoutes = new Hono<{ Bindings: Env }>();

// GET /partes/pendientes — Partes pendientes de validación
partesRoutes.get('/pendientes', async (c) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase
    .from('v_partes_pendientes_validacion')
    .select('*');

  if (error) {
    // Fallback
    const { data: partes, error: err2 } = await supabase
      .from('partes_operario')
      .select('*, operarios(nombre, apellidos), expedientes(numero_expediente, tipo_siniestro, direccion_siniestro, localidad)')
      .eq('validacion_estado', 'pendiente')
      .order('created_at', { ascending: true });

    if (err2) return c.json({ data: null, error: { code: 'DB_ERROR', message: err2.message } }, 500);
    return c.json({ data: partes, error: null });
  }

  return c.json({ data, error: null });
});

// GET /partes/:id — Detalle de un parte
partesRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('partes_operario')
    .select('*, operarios(nombre, apellidos, telefono), evidencias:evidencias(id, tipo, clasificacion, nombre_original, storage_path, mime_type)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Parte no encontrado' } }, 404);
  }

  return c.json({ data, error: null });
});

// POST /partes/:id/validar — Validar un parte
partesRoutes.post('/:id/validar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data: parte } = await supabase
    .from('partes_operario')
    .select('id, expediente_id, validacion_estado, expedientes(numero_expediente)')
    .eq('id', id)
    .single();

  if (!parte) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Parte no encontrado' } }, 404);
  }

  if (parte.validacion_estado === 'validado') {
    return c.json({ data: null, error: { code: 'INVALID_STATE', message: 'Parte ya validado' } }, 422);
  }

  const { error } = await supabase
    .from('partes_operario')
    .update({
      validado: true,
      validacion_estado: 'validado',
      validado_por: user.id,
      validado_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  // Enqueue PDF generation
  const numeroExpediente = (parte as any).expedientes?.numero_expediente ?? 'SIN-NUM';
  const pdfResult = await enqueuePartePdf(supabase, {
    expediente_id: parte.expediente_id,
    parte_id: id,
    actor_id: user.id,
    numero_expediente: numeroExpediente,
  });

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'partes_operario',
      registro_id: id,
      accion: 'UPDATE',
      actor_id: user.id,
      cambios: { validacion_estado: 'validado' },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: parte.expediente_id,
      aggregate_type: 'expediente',
      event_type: 'ParteValidado',
      payload: { parte_id: id, accion: 'validado', documento_id: pdfResult.documento_id },
      actor_id: user.id,
    }),
    // Timeline entry
    supabase.from('comunicaciones').insert({
      expediente_id: parte.expediente_id,
      tipo: 'sistema',
      asunto: 'Parte validado',
      contenido: `Parte de operario validado por supervisor. PDF encolado para generación.`,
      actor_id: user.id,
      actor_nombre: 'Sistema',
    }),
  ]);

  return c.json({ data: { id, validacion_estado: 'validado', documento_id: pdfResult.documento_id }, error: null });
});

// POST /partes/:id/rechazar — Rechazar un parte
partesRoutes.post('/:id/rechazar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const { motivo } = await c.req.json<{ motivo: string }>();

  if (!motivo?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'Motivo de rechazo requerido' } }, 422);
  }

  const { data: parte } = await supabase
    .from('partes_operario')
    .select('id, expediente_id, validacion_estado')
    .eq('id', id)
    .single();

  if (!parte) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Parte no encontrado' } }, 404);
  }

  const { error } = await supabase
    .from('partes_operario')
    .update({
      validado: false,
      validacion_estado: 'rechazado',
      validacion_comentario: motivo,
      validado_por: user.id,
      validado_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'partes_operario',
      registro_id: id,
      accion: 'UPDATE',
      actor_id: user.id,
      cambios: { validacion_estado: 'rechazado', motivo },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: parte.expediente_id,
      aggregate_type: 'expediente',
      event_type: 'ParteRechazado',
      payload: { parte_id: id, motivo },
      actor_id: user.id,
    }),
    supabase.from('comunicaciones').insert({
      expediente_id: parte.expediente_id,
      tipo: 'sistema',
      asunto: 'Parte rechazado',
      contenido: `Parte rechazado. Motivo: ${motivo}`,
      actor_id: user.id,
      actor_nombre: 'Sistema',
    }),
  ]);

  return c.json({ data: { id, validacion_estado: 'rechazado' }, error: null });
});
