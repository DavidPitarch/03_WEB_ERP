import { Hono } from 'hono';
export const dashboardRoutes = new Hono();
// ─── Helper ────────────────────────────────────────────────────────────────
function err(code, message) {
    return { data: null, error: { code, message } };
}
function getEmpresaFacturadoraId(c) {
    return c.req.query('empresa_facturadora_id') ?? c.req.query('empresa_id');
}
function getSerieId(c) {
    return c.req.query('serie_id') ?? c.req.query('serie');
}
function mapDashboardKpis(data) {
    return {
        ...data,
        en_curso: data.en_curso ?? data.exp_en_curso ?? 0,
        pendientes: data.pendientes ?? data.exp_pendientes ?? 0,
        finalizados_sin_factura: data.finalizados_sin_factura ?? data.exp_finalizados_sin_factura ?? 0,
        pendiente_cobro: data.pendiente_cobro ?? data.total_pendiente_cobro ?? data.total_pendiente ?? 0,
        sin_presupuesto: data.sin_presupuesto ?? data.exp_sin_presupuesto ?? 0,
    };
}
function mapRentabilidadCompania(row) {
    return {
        ...row,
        margen_porcentaje: row.margen_porcentaje ?? row.margen_medio_pct ?? 0,
        deficitarios: row.deficitarios ?? row.expedientes_deficitarios ?? 0,
    };
}
function mapProductividad(row) {
    return {
        ...row,
        operario_nombre: row.operario_nombre ?? [row.nombre, row.apellidos].filter(Boolean).join(' ').trim(),
        citas: row.citas ?? row.total_citas ?? 0,
        partes: row.partes ?? row.partes_enviados ?? 0,
        caducados: row.caducados ?? row.informes_caducados ?? 0,
    };
}
function mapFacturacionRow(row) {
    return {
        ...row,
        numero_expediente: row.numero_expediente ?? row.expediente_numero ?? null,
        base: row.base ?? row.base_imponible ?? 0,
        iva: row.iva ?? row.iva_importe ?? 0,
        cobrado: row.cobrado ?? row.total_cobrado_factura ?? 0,
        pendiente: row.pendiente ?? row.pendiente_cobro ?? 0,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/kpis — Dashboard KPIs
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/kpis', async (c) => {
    const supabase = c.get('supabase');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    const empresa_facturadora_id = getEmpresaFacturadoraId(c);
    const compania_id = c.req.query('compania_id');
    const hasFilters = fecha_desde || fecha_hasta || empresa_facturadora_id || compania_id;
    if (!hasFilters) {
        // Use materialized/plain view for unfiltered KPIs
        const { data, error } = await supabase
            .from('v_dashboard_kpis')
            .select('*')
            .single();
        if (error)
            return c.json(err('DB_ERROR', error.message), 500);
        return c.json({ data: mapDashboardKpis(data), error: null });
    }
    // Filtered: calculate KPIs inline from expedientes
    let expQuery = supabase.from('expedientes').select('id, estado, created_at, compania_id, empresa_facturadora_id');
    if (fecha_desde)
        expQuery = expQuery.gte('created_at', fecha_desde);
    if (fecha_hasta)
        expQuery = expQuery.lte('created_at', fecha_hasta);
    if (empresa_facturadora_id)
        expQuery = expQuery.eq('empresa_facturadora_id', empresa_facturadora_id);
    if (compania_id)
        expQuery = expQuery.eq('compania_id', compania_id);
    const { data: expedientes, error: expErr } = await expQuery;
    if (expErr)
        return c.json(err('DB_ERROR', expErr.message), 500);
    const total_expedientes = expedientes?.length ?? 0;
    const en_curso = expedientes?.filter((e) => ['EN_CURSO', 'EN_PLANIFICACION'].includes(e.estado)).length ?? 0;
    const pendientes = expedientes?.filter((e) => String(e.estado).startsWith('PENDIENTE')).length ?? 0;
    // Get related facturas for filtered expedientes
    const expIds = (expedientes ?? []).map((e) => e.id);
    let total_facturado = 0;
    let total_cobrado = 0;
    let pendiente_cobro = 0;
    let finalizados_sin_factura = 0;
    let sin_presupuesto = 0;
    let facturas_vencidas = 0;
    let pedidos_caducados = 0;
    let informes_caducados = 0;
    if (expIds.length > 0) {
        const { data: facturas } = await supabase
            .from('facturas')
            .select('expediente_id, total, estado_cobro')
            .in('expediente_id', expIds)
            .neq('estado', 'anulada');
        if (facturas) {
            const expedientesFacturados = new Set();
            for (const f of facturas) {
                if (f.expediente_id)
                    expedientesFacturados.add(f.expediente_id);
                total_facturado += f.total ?? 0;
                if (f.estado_cobro === 'cobrada')
                    total_cobrado += f.total ?? 0;
                else
                    pendiente_cobro += f.total ?? 0;
                if (f.estado_cobro === 'vencida')
                    facturas_vencidas += 1;
            }
            finalizados_sin_factura = (expedientes ?? []).filter((e) => e.estado === 'FINALIZADO' && !expedientesFacturados.has(e.id)).length;
        }
        const { data: presupuestos } = await supabase
            .from('presupuestos')
            .select('expediente_id')
            .in('expediente_id', expIds);
        const expedienteIdsConPresupuesto = new Set((presupuestos ?? []).map((p) => p.expediente_id));
        sin_presupuesto = (expedientes ?? []).filter((e) => !['NUEVO', 'CANCELADO', 'CERRADO'].includes(e.estado) && !expedienteIdsConPresupuesto.has(e.id)).length;
        const { count: pedidosCadCount } = await supabase
            .from('pedidos_material')
            .select('id', { count: 'exact', head: true })
            .in('expediente_id', expIds)
            .eq('estado', 'caducado');
        pedidos_caducados = pedidosCadCount ?? 0;
        const { count: informesCadCount } = await supabase
            .from('v_informes_caducados')
            .select('id', { count: 'exact', head: true })
            .in('expediente_id', expIds);
        informes_caducados = informesCadCount ?? 0;
    }
    return c.json({
        data: mapDashboardKpis({
            total_expedientes,
            en_curso,
            pendientes,
            finalizados_sin_factura,
            total_facturado: Math.round(total_facturado * 100) / 100,
            total_cobrado: Math.round(total_cobrado * 100) / 100,
            pendiente_cobro: Math.round(pendiente_cobro * 100) / 100,
            facturas_vencidas,
            pedidos_caducados,
            informes_caducados,
            sin_presupuesto,
        }),
        error: null,
    });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/rentabilidad/por-compania — Aggregated by company
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/rentabilidad/por-compania', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('v_rentabilidad_por_compania')
        .select('*');
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data: (data ?? []).map((row) => mapRentabilidadCompania(row)), error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/rentabilidad/por-operario — Aggregated by operator
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/rentabilidad/por-operario', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('v_rentabilidad_por_operario')
        .select('*');
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/rentabilidad — Rentabilidad por expediente
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/rentabilidad', async (c) => {
    const supabase = c.get('supabase');
    const compania_id = c.req.query('compania_id');
    const tipo_siniestro = c.req.query('tipo_siniestro');
    const solo_deficitarios = c.req.query('solo_deficitarios');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const per_page = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 50));
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    let query = supabase
        .from('v_expedientes_rentabilidad')
        .select('*', { count: 'exact' });
    if (compania_id)
        query = query.eq('compania_id', compania_id);
    if (tipo_siniestro)
        query = query.eq('tipo_siniestro', tipo_siniestro);
    if (solo_deficitarios === 'true')
        query = query.lt('margen_previsto', 0);
    if (fecha_desde)
        query = query.gte('created_at', fecha_desde);
    if (fecha_hasta)
        query = query.lte('created_at', fecha_hasta);
    const { data, error, count } = await query
        .order('margen_previsto', { ascending: true })
        .range(from, to);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null, pagination: { page, per_page, total: count ?? 0 } });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/productividad — Operator productivity
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/productividad', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('v_productividad_operarios')
        .select('*');
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data: (data ?? []).map((row) => mapProductividad(row)), error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/facturacion/export — CSV export
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/facturacion/export', async (c) => {
    const supabase = c.get('supabase');
    const compania_id = c.req.query('compania_id');
    const empresa_facturadora_id = getEmpresaFacturadoraId(c);
    const serie_id = getSerieId(c);
    const estado = c.req.query('estado');
    const estado_cobro = c.req.query('estado_cobro');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    let query = supabase.from('v_facturacion_detallada').select('*');
    if (compania_id)
        query = query.eq('compania_id', compania_id);
    if (empresa_facturadora_id)
        query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
    if (serie_id)
        query = query.eq('serie_id', serie_id);
    if (estado)
        query = query.eq('estado', estado);
    if (estado_cobro)
        query = query.eq('estado_cobro', estado_cobro);
    if (fecha_desde)
        query = query.gte('fecha_emision', fecha_desde);
    if (fecha_hasta)
        query = query.lte('fecha_emision', fecha_hasta);
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    const rows = data ?? [];
    if (rows.length === 0) {
        return new Response('\uFEFF', {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="facturacion_export.csv"',
            },
        });
    }
    const headers = Object.keys(rows[0]);
    const escCsv = (v) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csvRows = rows.map((r) => headers.map((h) => escCsv(r[h])).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="facturacion_export.csv"',
        },
    });
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/facturacion — Extended invoice reporting
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/facturacion', async (c) => {
    const supabase = c.get('supabase');
    const compania_id = c.req.query('compania_id');
    const empresa_facturadora_id = getEmpresaFacturadoraId(c);
    const serie_id = getSerieId(c);
    const estado = c.req.query('estado');
    const estado_cobro = c.req.query('estado_cobro');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const per_page = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 50));
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    let query = supabase
        .from('v_facturacion_detallada')
        .select('*', { count: 'exact' });
    if (compania_id)
        query = query.eq('compania_id', compania_id);
    if (empresa_facturadora_id)
        query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
    if (serie_id)
        query = query.eq('serie_id', serie_id);
    if (estado)
        query = query.eq('estado', estado);
    if (estado_cobro)
        query = query.eq('estado_cobro', estado_cobro);
    if (fecha_desde)
        query = query.gte('fecha_emision', fecha_desde);
    if (fecha_hasta)
        query = query.lte('fecha_emision', fecha_hasta);
    const { data, error, count } = await query.range(from, to);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    // Calculate totals from all matching rows (not just current page)
    let totalsQuery = supabase
        .from('v_facturacion_detallada')
        .select('base_imponible, total, total_cobrado_factura, pendiente_cobro');
    if (compania_id)
        totalsQuery = totalsQuery.eq('compania_id', compania_id);
    if (empresa_facturadora_id)
        totalsQuery = totalsQuery.eq('empresa_facturadora_id', empresa_facturadora_id);
    if (serie_id)
        totalsQuery = totalsQuery.eq('serie_id', serie_id);
    if (estado)
        totalsQuery = totalsQuery.eq('estado', estado);
    if (estado_cobro)
        totalsQuery = totalsQuery.eq('estado_cobro', estado_cobro);
    if (fecha_desde)
        totalsQuery = totalsQuery.gte('fecha_emision', fecha_desde);
    if (fecha_hasta)
        totalsQuery = totalsQuery.lte('fecha_emision', fecha_hasta);
    const { data: allRows } = await totalsQuery;
    const totals = {
        base_imponible: 0,
        total: 0,
        cobrado: 0,
        pendiente: 0,
    };
    for (const r of (allRows ?? [])) {
        totals.base_imponible += r.base_imponible ?? 0;
        totals.total += r.total ?? 0;
        totals.cobrado += r.total_cobrado_factura ?? 0;
        totals.pendiente += r.pendiente_cobro ?? 0;
    }
    totals.base_imponible = Math.round(totals.base_imponible * 100) / 100;
    totals.total = Math.round(totals.total * 100) / 100;
    totals.cobrado = Math.round(totals.cobrado * 100) / 100;
    totals.pendiente = Math.round(totals.pendiente * 100) / 100;
    return c.json({
        data: (data ?? []).map((row) => mapFacturacionRow(row)),
        error: null,
        totals: {
            ...totals,
            base: totals.base_imponible,
        },
        pagination: { page, per_page, total: count ?? 0 },
    });
});
