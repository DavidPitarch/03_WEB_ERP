import { Hono } from 'hono';
export const bandejasRoutes = new Hono();
// GET /bandejas/contadores — Contadores por estado
bandejasRoutes.get('/contadores', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase.from('v_expedientes_contadores').select('*');
    if (error) {
        // Fallback si la vista no existe: query directa
        const { data: exps, error: err2 } = await supabase
            .from('expedientes')
            .select('estado');
        if (err2)
            return c.json({ data: null, error: { code: 'DB_ERROR', message: err2.message } }, 500);
        const contadores = {};
        (exps ?? []).forEach((e) => {
            contadores[e.estado] = (contadores[e.estado] ?? 0) + 1;
        });
        return c.json({ data: contadores, error: null });
    }
    const contadores = {};
    (data ?? []).forEach((row) => {
        contadores[row.estado] = row.total;
    });
    return c.json({ data: contadores, error: null });
});
// GET /bandejas/informes-caducados — Citas sin parte
bandejasRoutes.get('/informes-caducados', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase.from('v_informes_caducados').select('*');
    if (error) {
        // Fallback query
        const { data: citas, error: err2 } = await supabase
            .from('citas')
            .select(`
        id, expediente_id, operario_id, fecha, franja_inicio, franja_fin,
        expedientes(numero_expediente, estado),
        operarios(nombre, apellidos)
      `)
            .in('estado', ['realizada', 'programada', 'confirmada'])
            .lt('fecha', new Date().toISOString().split('T')[0]);
        if (err2)
            return c.json({ data: null, error: { code: 'DB_ERROR', message: err2.message } }, 500);
        // Filtrar las que no tienen parte
        const citaIds = (citas ?? []).map((ci) => ci.id);
        const { data: partes } = await supabase
            .from('partes_operario')
            .select('cita_id')
            .in('cita_id', citaIds);
        const parteCitaIds = new Set((partes ?? []).map((p) => p.cita_id));
        const sinParte = (citas ?? []).filter((ci) => !parteCitaIds.has(ci.id) &&
            ci.expedientes &&
            !['CERRADO', 'CANCELADO', 'FINALIZADO', 'FACTURADO', 'COBRADO'].includes(ci.expedientes.estado));
        return c.json({ data: sinParte, error: null });
    }
    return c.json({ data, error: null });
});
// GET /bandejas/partes-pendientes — Contador de partes pendientes de validación
bandejasRoutes.get('/partes-pendientes', async (c) => {
    const supabase = c.get('supabase');
    const { count, error } = await supabase
        .from('partes_operario')
        .select('id', { count: 'exact', head: true })
        .eq('validacion_estado', 'pendiente');
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data: { count: count ?? 0 }, error: null });
});
