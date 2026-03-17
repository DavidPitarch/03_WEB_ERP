import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { isValidEvidenceStoragePath } from '../security/storage-paths';
export const operatorRoutes = new Hono();
// ─── Helper: obtener operario_id del usuario autenticado ───
async function getOperarioId(supabase, userId) {
    const { data } = await supabase
        .from('operarios')
        .select('id')
        .eq('user_id', userId)
        .eq('activo', true)
        .single();
    return data?.id ?? null;
}
async function getAssignedExpediente(supabase, expedienteId, operarioId) {
    const { data } = await supabase
        .from('expedientes')
        .select('id, operario_id')
        .eq('id', expedienteId)
        .eq('operario_id', operarioId)
        .single();
    return data;
}
// ═══════════════════════════════════════
// GET /operator/me/agenda — Agenda del operario
// ═══════════════════════════════════════
operatorRoutes.get('/me/agenda', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    const fechaDesde = c.req.query('fecha_desde') ?? new Date().toISOString().split('T')[0];
    const fechaHasta = c.req.query('fecha_hasta');
    // Intentar usar la vista, fallback a query directa
    let query = supabase
        .from('citas')
        .select(`
      id, expediente_id, operario_id, fecha, franja_inicio, franja_fin, estado, notas,
      expedientes(id, numero_expediente, estado, tipo_siniestro, descripcion, direccion_siniestro, codigo_postal, localidad, provincia, prioridad,
        asegurados(nombre, apellidos, telefono, telefono2)
      )
    `)
        .eq('operario_id', operarioId)
        .gte('fecha', fechaDesde)
        .not('estado', 'eq', 'cancelada')
        .order('fecha', { ascending: true })
        .order('franja_inicio', { ascending: true });
    if (fechaHasta) {
        query = query.lte('fecha', fechaHasta);
    }
    const { data: citas, error } = await query;
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    // Obtener IDs de citas que ya tienen parte
    const citaIds = (citas ?? []).map((c) => c.id);
    const { data: partes } = await supabase
        .from('partes_operario')
        .select('cita_id')
        .in('cita_id', citaIds.length > 0 ? citaIds : ['none']);
    const parteCitaIds = new Set((partes ?? []).map((p) => p.cita_id));
    const agenda = (citas ?? []).map((c) => ({
        cita_id: c.id,
        expediente_id: c.expediente_id,
        operario_id: c.operario_id,
        fecha: c.fecha,
        franja_inicio: c.franja_inicio,
        franja_fin: c.franja_fin,
        cita_estado: c.estado,
        cita_notas: c.notas,
        numero_expediente: c.expedientes?.numero_expediente,
        expediente_estado: c.expedientes?.estado,
        tipo_siniestro: c.expedientes?.tipo_siniestro,
        descripcion: c.expedientes?.descripcion,
        direccion_siniestro: c.expedientes?.direccion_siniestro,
        codigo_postal: c.expedientes?.codigo_postal,
        localidad: c.expedientes?.localidad,
        provincia: c.expedientes?.provincia,
        prioridad: c.expedientes?.prioridad,
        asegurado_nombre: c.expedientes?.asegurados?.nombre,
        asegurado_apellidos: c.expedientes?.asegurados?.apellidos,
        asegurado_telefono: c.expedientes?.asegurados?.telefono,
        asegurado_telefono2: c.expedientes?.asegurados?.telefono2,
        tiene_parte: parteCitaIds.has(c.id),
    }));
    return c.json({ data: agenda, error: null });
});
// ═══════════════════════════════════════
// GET /operator/claims/:id — Detalle de expediente (vista operario)
// ═══════════════════════════════════════
operatorRoutes.get('/claims/:id', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    // Verificar que el expediente está asignado a este operario
    const { data: exp, error } = await supabase
        .from('expedientes')
        .select(`
      id, numero_expediente, estado, tipo_siniestro, descripcion,
      direccion_siniestro, codigo_postal, localidad, provincia, prioridad,
      asegurados(nombre, apellidos, telefono, telefono2)
    `)
        .eq('id', id)
        .eq('operario_id', operarioId)
        .single();
    if (error || !exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado o no asignado' } }, 404);
    }
    // Obtener citas y partes
    const [citasRes, partesRes] = await Promise.all([
        supabase.from('citas').select('*').eq('expediente_id', id).eq('operario_id', operarioId).order('fecha', { ascending: false }),
        supabase.from('partes_operario').select('*').eq('expediente_id', id).eq('operario_id', operarioId).order('created_at', { ascending: false }),
    ]);
    return c.json({
        data: {
            ...exp,
            asegurado: exp.asegurados,
            citas: citasRes.data ?? [],
            partes: partesRes.data ?? [],
        },
        error: null,
    });
});
// ═══════════════════════════════════════
// GET /operator/claims/:id/timeline — Timeline reducida
// ═══════════════════════════════════════
operatorRoutes.get('/claims/:id/timeline', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    // Verificar asignación
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id')
        .eq('id', id)
        .eq('operario_id', operarioId)
        .single();
    if (!exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'No encontrado' } }, 404);
    }
    // Timeline: solo comunicaciones de tipo nota_interna/sistema y citas
    const [commsRes, citasRes] = await Promise.all([
        supabase.from('comunicaciones').select('*').eq('expediente_id', id).in('tipo', ['nota_interna', 'sistema']).order('created_at', { ascending: false }).limit(20),
        supabase.from('citas').select('*').eq('expediente_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
    const timeline = [
        ...(commsRes.data ?? []).map((c) => ({ ...c, timeline_type: 'comunicacion' })),
        ...(citasRes.data ?? []).map((c) => ({ ...c, timeline_type: 'cita' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return c.json({ data: timeline, error: null });
});
// ═══════════════════════════════════════
// POST /operator/claims/:id/parts — Enviar parte
// ═══════════════════════════════════════
operatorRoutes.post('/claims/:id/parts', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const expId = c.req.param('id');
    const body = await c.req.json();
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    // Verificar expediente asignado
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id, estado')
        .eq('id', expId)
        .eq('operario_id', operarioId)
        .single();
    if (!exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado o no asignado' } }, 404);
    }
    // Validar cita pertenece al expediente
    const { data: cita } = await supabase
        .from('citas')
        .select('id, estado')
        .eq('id', body.cita_id)
        .eq('expediente_id', expId)
        .eq('operario_id', operarioId)
        .single();
    if (!cita) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Cita no encontrada' } }, 404);
    }
    // Validaciones de negocio
    const errors = [];
    if (!body.trabajos_realizados?.trim())
        errors.push('trabajos_realizados requerido');
    if (!body.resultado)
        errors.push('resultado requerido');
    if (body.resultado === 'ausente' && !body.motivo_resultado)
        errors.push('motivo requerido cuando resultado = ausente');
    if (body.resultado === 'requiere_material' && !body.motivo_resultado)
        errors.push('motivo requerido cuando resultado = requiere_material');
    if (errors.length > 0) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: errors.join(', ') } }, 422);
    }
    // Crear parte
    const parteData = {
        expediente_id: expId,
        operario_id: operarioId,
        cita_id: body.cita_id,
        trabajos_realizados: body.trabajos_realizados,
        trabajos_pendientes: body.trabajos_pendientes ?? null,
        materiales_utilizados: body.materiales_utilizados ?? null,
        observaciones: body.observaciones ?? null,
        resultado: body.resultado,
        motivo_resultado: body.motivo_resultado ?? null,
        requiere_nueva_visita: body.requiere_nueva_visita,
        firma_cliente_url: body.firma_storage_path ?? null,
        firma_storage_path: body.firma_storage_path ?? null,
    };
    const { data: parte, error: parteErr } = await supabase
        .from('partes_operario')
        .insert(parteData)
        .select()
        .single();
    if (parteErr) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: parteErr.message } }, 500);
    }
    // Vincular evidencias al parte si se proporcionan IDs
    if (body.evidencia_ids && body.evidencia_ids.length > 0) {
        await supabase
            .from('evidencias')
            .update({ parte_id: parte.id })
            .in('id', body.evidencia_ids)
            .eq('expediente_id', expId);
    }
    // Marcar cita como realizada
    await supabase
        .from('citas')
        .update({ estado: body.resultado === 'ausente' ? 'no_show' : 'realizada' })
        .eq('id', body.cita_id);
    // Registrar comunicación en timeline
    await supabase.from('comunicaciones').insert({
        expediente_id: expId,
        tipo: 'sistema',
        asunto: 'Parte recibido',
        contenido: `Parte enviado por operario. Resultado: ${body.resultado}. ${body.trabajos_realizados.substring(0, 200)}`,
        actor_id: user.id,
        actor_nombre: `Operario`,
    });
    // Auditoría + evento
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'partes_operario',
            registro_id: parte.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: parteData,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: expId,
            aggregate_type: 'expediente',
            event_type: 'ParteRecibido',
            payload: {
                parte_id: parte.id,
                cita_id: body.cita_id,
                resultado: body.resultado,
                requiere_nueva_visita: body.requiere_nueva_visita,
            },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: parte, error: null }, 201);
});
// ═══════════════════════════════════════
// POST /operator/uploads/init — Iniciar subida de evidencia
// ═══════════════════════════════════════
operatorRoutes.post('/uploads/init', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { expediente_id, filename, content_type } = await c.req.json();
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    // Verificar asignación
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id')
        .eq('id', expediente_id)
        .eq('operario_id', operarioId)
        .single();
    if (!exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no asignado' } }, 404);
    }
    const uploadId = crypto.randomUUID();
    const ext = filename.split('.').pop() || 'jpg';
    const storagePath = `evidencias/${expediente_id}/${uploadId}.${ext}`;
    // Crear signed URL para upload directo a storage
    const { data: signedUrl, error } = await supabase.storage
        .from('evidencias')
        .createSignedUploadUrl(storagePath);
    if (error) {
        return c.json({ data: null, error: { code: 'STORAGE_ERROR', message: error.message } }, 500);
    }
    return c.json({
        data: {
            upload_id: uploadId,
            signed_url: signedUrl.signedUrl,
            storage_path: storagePath,
        },
        error: null,
    });
});
// ═══════════════════════════════════════
// POST /operator/uploads/complete — Confirmar subida
// ═══════════════════════════════════════
operatorRoutes.post('/uploads/complete', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario activo' } }, 403);
    }
    const expediente = await getAssignedExpediente(supabase, body.expediente_id, operarioId);
    if (!expediente) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado o no asignado' } }, 404);
    }
    if (!isValidEvidenceStoragePath(body.expediente_id, body.storage_path)) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'storage_path no corresponde al expediente' } }, 422);
    }
    if (body.cita_id) {
        const { data: cita } = await supabase
            .from('citas')
            .select('id')
            .eq('id', body.cita_id)
            .eq('expediente_id', body.expediente_id)
            .eq('operario_id', operarioId)
            .single();
        if (!cita) {
            return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Cita no encontrada o no asignada' } }, 404);
        }
    }
    if (body.parte_id) {
        const { data: parte } = await supabase
            .from('partes_operario')
            .select('id')
            .eq('id', body.parte_id)
            .eq('expediente_id', body.expediente_id)
            .eq('operario_id', operarioId)
            .single();
        if (!parte) {
            return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Parte no encontrado o no asignado' } }, 404);
        }
    }
    const evidencia = {
        expediente_id: body.expediente_id,
        parte_id: body.parte_id ?? null,
        cita_id: body.cita_id ?? null,
        tipo: body.mime_type.startsWith('image/') ? 'foto' : body.mime_type.startsWith('video/') ? 'video' : 'documento',
        storage_path: body.storage_path,
        nombre_original: body.nombre_original,
        mime_type: body.mime_type,
        tamano_bytes: body.tamano_bytes,
        clasificacion: body.clasificacion,
        uploaded_by: user.id,
    };
    const { data, error } = await supabase
        .from('evidencias')
        .insert(evidencia)
        .select()
        .single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    await insertAudit(supabase, {
        tabla: 'evidencias',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { storage_path: body.storage_path, clasificacion: body.clasificacion },
    });
    return c.json({ data, error: null }, 201);
});
// ═══════════════════════════════════════
// GET /operator/claims/:id/evidencias — Listar evidencias
// ═══════════════════════════════════════
operatorRoutes.get('/claims/:id/evidencias', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const operarioId = await getOperarioId(supabase, user.id);
    if (!operarioId) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No es operario' } }, 403);
    }
    const expediente = await getAssignedExpediente(supabase, id, operarioId);
    if (!expediente) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado o no asignado' } }, 404);
    }
    const { data, error } = await supabase
        .from('evidencias')
        .select('*')
        .eq('expediente_id', id)
        .order('created_at', { ascending: false });
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
