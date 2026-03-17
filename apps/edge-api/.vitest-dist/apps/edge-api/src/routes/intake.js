import { Hono } from 'hono';
import { insertAudit, insertHistorialEstado, insertDomainEvent } from '../services/audit';
export const intakeRoutes = new Hono();
// POST /intake/claims — Ingesta estructurada de siniestros
intakeRoutes.post('/claims', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    // Validación de campos obligatorios
    const errors = [];
    if (!body.referencia_externa)
        errors.push('referencia_externa requerida');
    if (!body.compania_codigo)
        errors.push('compania_codigo requerido');
    if (!body.tipo_siniestro)
        errors.push('tipo_siniestro requerido');
    if (!body.descripcion)
        errors.push('descripcion requerida');
    if (!body.direccion_siniestro)
        errors.push('direccion_siniestro requerida');
    if (!body.codigo_postal)
        errors.push('codigo_postal requerido');
    if (!body.localidad)
        errors.push('localidad requerida');
    if (!body.provincia)
        errors.push('provincia requerida');
    if (!body.asegurado?.nombre)
        errors.push('asegurado.nombre requerido');
    if (!body.asegurado?.apellidos)
        errors.push('asegurado.apellidos requerido');
    if (!body.asegurado?.telefono)
        errors.push('asegurado.telefono requerido');
    if (!body.asegurado?.direccion)
        errors.push('asegurado.direccion requerida');
    if (!body.asegurado?.codigo_postal)
        errors.push('asegurado.codigo_postal requerido');
    if (!body.asegurado?.localidad)
        errors.push('asegurado.localidad requerida');
    if (!body.asegurado?.provincia)
        errors.push('asegurado.provincia requerida');
    if (errors.length > 0) {
        const resp = { status: 'validation_error', errors };
        return c.json({ data: resp, error: null }, 422);
    }
    // ─── Deduplicación ───
    // 1. Por referencia_externa
    const { data: dupRef } = await supabase
        .from('expedientes')
        .select('id, numero_expediente')
        .eq('referencia_externa', body.referencia_externa)
        .maybeSingle();
    if (dupRef) {
        const resp = {
            status: 'duplicate_detected',
            duplicate_of: dupRef.numero_expediente,
            expediente_id: dupRef.id,
        };
        return c.json({ data: resp, error: null }, 200);
    }
    // 2. Por número de siniestro de compañía
    if (body.numero_siniestro_cia) {
        const { data: dupSiniestro } = await supabase
            .from('expedientes')
            .select('id, numero_expediente')
            .eq('numero_siniestro_cia', body.numero_siniestro_cia)
            .maybeSingle();
        if (dupSiniestro) {
            const resp = {
                status: 'duplicate_detected',
                duplicate_of: dupSiniestro.numero_expediente,
                expediente_id: dupSiniestro.id,
            };
            return c.json({ data: resp, error: null }, 200);
        }
    }
    // 3. Por teléfono + dirección + póliza (match fuzzy)
    if (body.numero_poliza) {
        const { data: dupPoliza } = await supabase
            .from('expedientes')
            .select('id, numero_expediente, asegurados!inner(telefono)')
            .eq('numero_poliza', body.numero_poliza)
            .eq('asegurados.telefono', body.asegurado.telefono)
            .not('estado', 'in', '("CERRADO","CANCELADO")')
            .maybeSingle();
        if (dupPoliza) {
            const resp = {
                status: 'duplicate_detected',
                duplicate_of: dupPoliza.numero_expediente,
                expediente_id: dupPoliza.id,
            };
            return c.json({ data: resp, error: null }, 200);
        }
    }
    // ─── Resolver compañía ───
    const { data: compania } = await supabase
        .from('companias')
        .select('id')
        .eq('codigo', body.compania_codigo)
        .eq('activa', true)
        .single();
    if (!compania) {
        return c.json({
            data: { status: 'validation_error', errors: [`Compañía con código '${body.compania_codigo}' no encontrada`] },
            error: null,
        }, 422);
    }
    // ─── Resolver empresa facturadora (primera activa como default) ───
    const { data: empresa } = await supabase
        .from('empresas_facturadoras')
        .select('id')
        .eq('activa', true)
        .limit(1)
        .single();
    if (!empresa) {
        return c.json({
            data: { status: 'validation_error', errors: ['No hay empresa facturadora activa'] },
            error: null,
        }, 422);
    }
    // ─── Buscar o crear asegurado ───
    let aseguradoId;
    const { data: existingAsegurado } = await supabase
        .from('asegurados')
        .select('id')
        .eq('telefono', body.asegurado.telefono)
        .eq('nombre', body.asegurado.nombre)
        .eq('apellidos', body.asegurado.apellidos)
        .maybeSingle();
    if (existingAsegurado) {
        aseguradoId = existingAsegurado.id;
    }
    else {
        const { data: newAsegurado, error: asegErr } = await supabase
            .from('asegurados')
            .insert({
            nombre: body.asegurado.nombre,
            apellidos: body.asegurado.apellidos,
            telefono: body.asegurado.telefono,
            telefono2: body.asegurado.telefono2 ?? null,
            email: body.asegurado.email ?? null,
            nif: body.asegurado.nif ?? null,
            direccion: body.asegurado.direccion,
            codigo_postal: body.asegurado.codigo_postal,
            localidad: body.asegurado.localidad,
            provincia: body.asegurado.provincia,
        })
            .select('id')
            .single();
        if (asegErr || !newAsegurado) {
            return c.json({ data: null, error: { code: 'DB_ERROR', message: 'Error al crear asegurado' } }, 500);
        }
        aseguradoId = newAsegurado.id;
    }
    // ─── Crear expediente ───
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('expedientes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(5, '0');
    const numero = `EXP-${year}-${seq}`;
    const expedienteData = {
        numero_expediente: numero,
        estado: 'NUEVO',
        compania_id: compania.id,
        empresa_facturadora_id: empresa.id,
        asegurado_id: aseguradoId,
        tipo_siniestro: body.tipo_siniestro,
        descripcion: body.descripcion,
        direccion_siniestro: body.direccion_siniestro,
        codigo_postal: body.codigo_postal,
        localidad: body.localidad,
        provincia: body.provincia,
        numero_poliza: body.numero_poliza ?? null,
        numero_siniestro_cia: body.numero_siniestro_cia ?? null,
        prioridad: body.prioridad ?? 'media',
        fecha_limite_sla: body.fecha_limite_sla ?? null,
        origen: 'api',
        referencia_externa: body.referencia_externa,
        datos_origen: body.metadata ?? {},
    };
    const { data: exp, error: expErr } = await supabase
        .from('expedientes')
        .insert(expedienteData)
        .select()
        .single();
    if (expErr || !exp) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: expErr?.message ?? 'Error' } }, 500);
    }
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'expedientes',
            registro_id: exp.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { ...expedienteData, source: 'intake_api' },
        }),
        insertHistorialEstado(supabase, {
            expediente_id: exp.id,
            estado_anterior: null,
            estado_nuevo: 'NUEVO',
            actor_id: user.id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: exp.id,
            aggregate_type: 'expediente',
            event_type: 'ExpedienteCreado',
            payload: { numero_expediente: numero, origen: 'api', referencia_externa: body.referencia_externa },
            actor_id: user.id,
        }),
    ]);
    const resp = {
        status: 'created',
        expediente_id: exp.id,
        numero_expediente: numero,
    };
    return c.json({ data: resp, error: null }, 201);
});
