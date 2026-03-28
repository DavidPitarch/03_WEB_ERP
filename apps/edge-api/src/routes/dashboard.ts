import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import type { Env } from '../types';

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

// ─── Helpers ───────────────────────────────────────────────────────────────
function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

function getEmpresaFacturadoraId(c: any) {
  return c.req.query('empresa_facturadora_id') ?? c.req.query('empresa_id');
}

function getSerieId(c: any) {
  return c.req.query('serie_id') ?? c.req.query('serie');
}

// ─── Scope por rol ─────────────────────────────────────────────────────────
// admin / financiero → todo
// supervisor         → expedientes de sus companias_preferentes
// tramitador         → expedientes con tramitador_id = su registro

type UserScope =
  | { type: 'all' }
  | { type: 'companias'; companias: string[] }   // supervisor
  | { type: 'tramitador'; tramitador_id: string | null }; // tramitador

async function getUserScope(c: any): Promise<UserScope> {
  const user = c.get('user');
  const supabase = c.get('supabase');
  const roles: string[] = user.roles ?? [];

  if (roles.includes('admin') || roles.includes('financiero')) {
    return { type: 'all' };
  }

  const { data: tram } = await supabase
    .from('tramitadores')
    .select('id, companias_preferentes')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roles.includes('supervisor')) {
    // Si companias_preferentes está vacío → sin restricción de compañía
    const companias: string[] = tram?.companias_preferentes ?? [];
    return { type: 'companias', companias };
  }

  // tramitador u otro rol office
  return { type: 'tramitador', tramitador_id: tram?.id ?? null };
}

function mapDashboardKpis(data: Record<string, any>) {
  return {
    ...data,
    en_curso: data.en_curso ?? data.exp_en_curso ?? 0,
    pendientes: data.pendientes ?? data.exp_pendientes ?? 0,
    finalizados_sin_factura: data.finalizados_sin_factura ?? data.exp_finalizados_sin_factura ?? 0,
    pendiente_cobro: data.pendiente_cobro ?? data.total_pendiente_cobro ?? data.total_pendiente ?? 0,
    sin_presupuesto: data.sin_presupuesto ?? data.exp_sin_presupuesto ?? 0,
  };
}

function mapRentabilidadCompania(row: Record<string, any>) {
  return {
    ...row,
    margen_porcentaje: row.margen_porcentaje ?? row.margen_medio_pct ?? 0,
    deficitarios: row.deficitarios ?? row.expedientes_deficitarios ?? 0,
  };
}

function mapProductividad(row: Record<string, any>) {
  return {
    ...row,
    operario_nombre: row.operario_nombre ?? [row.nombre, row.apellidos].filter(Boolean).join(' ').trim(),
    citas: row.citas ?? row.total_citas ?? 0,
    partes: row.partes ?? row.partes_enviados ?? 0,
    caducados: row.caducados ?? row.informes_caducados ?? 0,
  };
}

function mapFacturacionRow(row: Record<string, any>) {
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
  const scope = await getUserScope(c);
  const fecha_desde = c.req.query('fecha_desde');
  const fecha_hasta = c.req.query('fecha_hasta');
  const empresa_facturadora_id = getEmpresaFacturadoraId(c);
  const compania_id = c.req.query('compania_id');

  const hasFilters = fecha_desde || fecha_hasta || empresa_facturadora_id || compania_id;

  // Vista global solo para admin/financiero sin filtros extra
  if (!hasFilters && scope.type === 'all') {
    const { data, error } = await supabase
      .from('v_dashboard_kpis')
      .select('*')
      .single();
    if (error) return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data: mapDashboardKpis(data as Record<string, any>), error: null });
  }

  // Tramitador sin registro → vacío
  if (scope.type === 'tramitador' && !scope.tramitador_id) {
    return c.json({ data: mapDashboardKpis({ total_expedientes: 0, en_curso: 0, pendientes: 0, finalizados_sin_factura: 0, total_facturado: 0, total_cobrado: 0, pendiente_cobro: 0, facturas_vencidas: 0, pedidos_caducados: 0, informes_caducados: 0, sin_presupuesto: 0 }), error: null });
  }

  // Cálculo inline con scope + filtros
  let expQuery = supabase.from('expedientes').select('id, estado, created_at, compania_id, empresa_facturadora_id, tramitador_id');
  if (fecha_desde) expQuery = expQuery.gte('created_at', fecha_desde);
  if (fecha_hasta) expQuery = expQuery.lte('created_at', fecha_hasta);
  if (empresa_facturadora_id) expQuery = expQuery.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (compania_id) expQuery = expQuery.eq('compania_id', compania_id);

  // Aplicar scope por rol
  if (scope.type === 'companias' && scope.companias.length > 0) {
    expQuery = expQuery.in('compania_id', scope.companias);
  }
  if (scope.type === 'tramitador' && scope.tramitador_id) {
    expQuery = expQuery.eq('tramitador_id', scope.tramitador_id);
  }

  const { data: expedientes, error: expErr } = await expQuery;
  if (expErr) return c.json(err('DB_ERROR', expErr.message), 500);

  const total_expedientes = expedientes?.length ?? 0;
  const en_curso = expedientes?.filter((e: any) => ['EN_CURSO', 'EN_PLANIFICACION'].includes(e.estado)).length ?? 0;
  const pendientes = expedientes?.filter((e: any) => String(e.estado).startsWith('PENDIENTE')).length ?? 0;

  // Get related facturas for filtered expedientes
  const expIds = (expedientes ?? []).map((e: any) => e.id);
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
      const expedientesFacturados = new Set<string>();
      for (const f of facturas as any[]) {
        if (f.expediente_id) expedientesFacturados.add(f.expediente_id);
        total_facturado += f.total ?? 0;
        if (f.estado_cobro === 'cobrada') total_cobrado += f.total ?? 0;
        else pendiente_cobro += f.total ?? 0;
        if (f.estado_cobro === 'vencida') facturas_vencidas += 1;
      }

      finalizados_sin_factura = (expedientes ?? []).filter((e: any) => e.estado === 'FINALIZADO' && !expedientesFacturados.has(e.id)).length;
    }

    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('expediente_id')
      .in('expediente_id', expIds);
    const expedienteIdsConPresupuesto = new Set((presupuestos ?? []).map((p: any) => p.expediente_id));
    sin_presupuesto = (expedientes ?? []).filter((e: any) => !['NUEVO', 'CANCELADO', 'CERRADO'].includes(e.estado) && !expedienteIdsConPresupuesto.has(e.id)).length;

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

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: (data ?? []).map((row: Record<string, any>) => mapRentabilidadCompania(row)), error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/rentabilidad/por-operario — Aggregated by operator
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/rentabilidad/por-operario', async (c) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase
    .from('v_rentabilidad_por_operario')
    .select('*');

  if (error) return c.json(err('DB_ERROR', error.message), 500);
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

  if (compania_id) query = query.eq('compania_id', compania_id);
  if (tipo_siniestro) query = query.eq('tipo_siniestro', tipo_siniestro);
  if (solo_deficitarios === 'true') query = query.lt('margen_previsto', 0);
  if (fecha_desde) query = query.gte('created_at', fecha_desde);
  if (fecha_hasta) query = query.lte('created_at', fecha_hasta);

  const { data, error, count } = await query
    .order('margen_previsto', { ascending: true })
    .range(from, to);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
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

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: (data ?? []).map((row: Record<string, any>) => mapProductividad(row)), error: null });
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
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (empresa_facturadora_id) query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (serie_id) query = query.eq('serie_id', serie_id);
  if (estado) query = query.eq('estado', estado);
  if (estado_cobro) query = query.eq('estado_cobro', estado_cobro);
  if (fecha_desde) query = query.gte('fecha_emision', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha_emision', fecha_hasta);

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);

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

  const escCsv = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csvRows = rows.map((r: Record<string, any>) =>
    headers.map((h) => escCsv(r[h])).join(','),
  );

  const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="facturacion_export.csv"',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /dashboard/companias/kpis-mes — KPIs por compañía del periodo
//
// Params opcionales:
//   fecha_desde / fecha_hasta — rango (defecto: mes en curso)
//
// Scope por rol:
//   admin/financiero → todas las compañías
//   supervisor       → solo companias_preferentes
//   tramitador       → solo compañías donde tiene expedientes asignados
//
// La columna "Facturado" usa la misma lógica que /kpis:
//   expedientes creados en el periodo → suma de sus facturas
//   (consistente con los KPI chips superiores)
// ═══════════════════════════════════════════════════════════════════════════
dashboardRoutes.get('/companias/kpis-mes', async (c) => {
  const supabase = c.get('supabase');
  const scope = await getUserScope(c);

  // ── Periodo: params o mes actual por defecto ─────────────────────────────
  const paramDesde = c.req.query('fecha_desde');
  const paramHasta = c.req.query('fecha_hasta');

  let periodoDesde: string;
  let periodoHasta: string;

  if (paramDesde && paramHasta) {
    periodoDesde = paramDesde;
    periodoHasta = paramHasta;
  } else {
    const now = new Date();
    periodoDesde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    periodoHasta = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  }

  // ── 1. Compañías según scope ─────────────────────────────────────────────
  let compQuery = supabase
    .from('companias')
    .select('id, nombre, codigo')
    .eq('activa', true)
    .order('nombre')
    .limit(500);

  if (scope.type === 'companias' && scope.companias.length > 0) {
    compQuery = compQuery.in('id', scope.companias);
  }

  const { data: companias, error: compErr } = await compQuery;
  if (compErr) return c.json(err('DB_ERROR', compErr.message), 500);
  if (!companias || companias.length === 0) return c.json({ data: [], error: null });

  const allCompaniaIds = (companias as any[]).map((c: any) => c.id);

  // ── 2. Para tramitador: descubrir sus compañías a partir de sus expedientes ─
  // (solo muestra las compañías donde tiene expedientes, no todas)
  let visibleCompaniaIds = allCompaniaIds;

  if (scope.type === 'tramitador') {
    if (!scope.tramitador_id) {
      // Sin registro → sin datos
      return c.json({ data: [], error: null });
    }
    const { data: tramExp } = await supabase
      .from('expedientes')
      .select('compania_id')
      .eq('tramitador_id', scope.tramitador_id)
      .limit(10000);

    const tramCompSet = new Set<string>(
      (tramExp ?? []).map((e: any) => e.compania_id).filter(Boolean),
    );
    visibleCompaniaIds = allCompaniaIds.filter((id: string) => tramCompSet.has(id));

    if (visibleCompaniaIds.length === 0) return c.json({ data: [], error: null });
  }

  // ── 3. Expedientes creados en el periodo (base para nuevos, facturado, coste) ─
  let expNuevosQ = supabase
    .from('expedientes')
    .select('id, compania_id, tramitador_id')
    .gte('created_at', periodoDesde)
    .lte('created_at', periodoHasta)
    .in('compania_id', visibleCompaniaIds)
    .limit(10000);

  if (scope.type === 'tramitador' && scope.tramitador_id) {
    expNuevosQ = expNuevosQ.eq('tramitador_id', scope.tramitador_id);
  }

  // ── 4. Expedientes cerrados en el periodo ────────────────────────────────
  let expCerradosQ = supabase
    .from('expedientes')
    .select('compania_id')
    .eq('estado', 'CERRADO')
    .gte('updated_at', periodoDesde)
    .lte('updated_at', periodoHasta)
    .in('compania_id', visibleCompaniaIds)
    .limit(10000);

  if (scope.type === 'tramitador' && scope.tramitador_id) {
    expCerradosQ = expCerradosQ.eq('tramitador_id', scope.tramitador_id);
  }

  // ── 5. Expedientes activos en este momento (sin filtro de fecha) ──────────
  const ESTADOS_ACTIVOS = ['NUEVO', 'NO_ASIGNADO', 'EN_PLANIFICACION', 'EN_CURSO', 'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE', 'FINALIZADO'];

  let expActivosQ = supabase
    .from('expedientes')
    .select('compania_id')
    .in('estado', ESTADOS_ACTIVOS)
    .in('compania_id', visibleCompaniaIds)
    .limit(10000);

  if (scope.type === 'tramitador' && scope.tramitador_id) {
    expActivosQ = expActivosQ.eq('tramitador_id', scope.tramitador_id);
  }

  // ── 6. Ejecutar en paralelo ───────────────────────────────────────────────
  const [
    { data: nuevosRows },
    { data: cerradosRows },
    { data: activosRows },
  ] = await Promise.all([expNuevosQ, expCerradosQ, expActivosQ]);

  // ── 7. Facturas de los expedientes creados en el periodo ──────────────────
  // Misma lógica que /kpis → totales deben coincidir
  const expNuevosIds = (nuevosRows ?? []).map((e: any) => e.id);
  const expIdToComp  = new Map<string, string>(
    (nuevosRows ?? []).map((e: any) => [e.id as string, e.compania_id as string]),
  );

  let facturaByComp = new Map<string, number>();
  let costeByComp   = new Map<string, number>();

  if (expNuevosIds.length > 0) {
    const [{ data: facturas }, { data: presupuestos }] = await Promise.all([
      supabase
        .from('facturas')
        .select('expediente_id, total')
        .in('expediente_id', expNuevosIds)
        .neq('estado', 'anulada')
        .limit(10000),
      supabase
        .from('presupuestos')
        .select('expediente_id, coste_estimado')
        .in('expediente_id', expNuevosIds)
        .limit(10000),
    ]);

    for (const f of (facturas ?? []) as any[]) {
      const cid = expIdToComp.get(f.expediente_id);
      if (cid) facturaByComp.set(cid, (facturaByComp.get(cid) ?? 0) + (f.total ?? 0));
    }
    for (const p of (presupuestos ?? []) as any[]) {
      const cid = expIdToComp.get(p.expediente_id);
      if (cid) costeByComp.set(cid, (costeByComp.get(cid) ?? 0) + (p.coste_estimado ?? 0));
    }
  }

  // ── 8. Agregar por compañía ───────────────────────────────────────────────
  const nuevosByComp   = ckpiGroupCount(nuevosRows   ?? [], 'compania_id');
  const cerradosByComp = ckpiGroupCount(cerradosRows ?? [], 'compania_id');
  const activosByComp  = ckpiGroupCount(activosRows  ?? [], 'compania_id');

  const data = (companias as any[])
    .filter((comp: any) => visibleCompaniaIds.includes(comp.id))
    .map((comp: any) => ({
      compania_id:        comp.id,
      compania_nombre:    comp.nombre,
      prefijo:            comp.codigo ?? '',
      nuevos_mes:         nuevosByComp.get(comp.id)    ?? 0,
      cerrados_mes:       cerradosByComp.get(comp.id)  ?? 0,
      en_curso:           activosByComp.get(comp.id)   ?? 0,
      facturado_mes:      r2(facturaByComp.get(comp.id)  ?? 0),
      coste_operario_mes: r2(costeByComp.get(comp.id)    ?? 0),
    }));

  return c.json({ data, error: null });
});

function r2(v: number) { return Math.round(v * 100) / 100; }
function ckpiGroupCount(rows: any[], key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) { const v = r[key]; if (v) m.set(v, (m.get(v) ?? 0) + 1); }
  return m;
}
function ckpiGroupSum(rows: any[], key: string, sum: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) { const k = r[key]; if (k) m.set(k, (m.get(k) ?? 0) + (r[sum] ?? 0)); }
  return m;
}

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

  if (compania_id) query = query.eq('compania_id', compania_id);
  if (empresa_facturadora_id) query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (serie_id) query = query.eq('serie_id', serie_id);
  if (estado) query = query.eq('estado', estado);
  if (estado_cobro) query = query.eq('estado_cobro', estado_cobro);
  if (fecha_desde) query = query.gte('fecha_emision', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha_emision', fecha_hasta);

  const { data, error, count } = await query.range(from, to);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Calculate totals from all matching rows (not just current page)
  let totalsQuery = supabase
    .from('v_facturacion_detallada')
    .select('base_imponible, total, total_cobrado_factura, pendiente_cobro');

  if (compania_id) totalsQuery = totalsQuery.eq('compania_id', compania_id);
  if (empresa_facturadora_id) totalsQuery = totalsQuery.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (serie_id) totalsQuery = totalsQuery.eq('serie_id', serie_id);
  if (estado) totalsQuery = totalsQuery.eq('estado', estado);
  if (estado_cobro) totalsQuery = totalsQuery.eq('estado_cobro', estado_cobro);
  if (fecha_desde) totalsQuery = totalsQuery.gte('fecha_emision', fecha_desde);
  if (fecha_hasta) totalsQuery = totalsQuery.lte('fecha_emision', fecha_hasta);

  const { data: allRows } = await totalsQuery;

  const totals = {
    base_imponible: 0,
    total: 0,
    cobrado: 0,
    pendiente: 0,
  };

  for (const r of (allRows ?? []) as any[]) {
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
    data: (data ?? []).map((row: Record<string, any>) => mapFacturacionRow(row)),
    error: null,
    totals: {
      ...totals,
      base: totals.base_imponible,
    },
    pagination: { page, per_page, total: count ?? 0 },
  });
});
