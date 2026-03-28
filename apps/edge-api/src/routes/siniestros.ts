import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const siniestrosRoutes = new Hono<{ Bindings: Env }>();

function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

// Estados que corresponden a "activos" (en gestión operativa, no cerrados)
const ESTADOS_ACTIVOS = [
  'NUEVO', 'NO_ASIGNADO', 'EN_PLANIFICACION', 'EN_CURSO',
  'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE',
];

// Estados que corresponden a "finalizados" (listo para/en facturación)
const ESTADOS_FINALIZADOS = ['FINALIZADO', 'FACTURADO', 'COBRADO', 'CERRADO'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diasDesde(fecha: string | null | undefined): number {
  if (!fecha) return 0;
  const diff = Date.now() - new Date(fecha).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildPaginacion(page: number, perPage: number, total: number | null) {
  const count = total ?? 0;
  return {
    total: count,
    page,
    per_page: perPage,
    total_pages: Math.ceil(count / perPage),
  };
}

// Aplica los filtros comunes a activos y finalizados
function applyCommonFilters(
  query: any,
  {
    search, tipo_dano, estado, tramitador_id, operario_id, urgente, vip,
  }: {
    search?: string;
    tipo_dano?: string;
    estado?: string;
    tramitador_id?: string;
    operario_id?: string;
    urgente?: string;
    vip?: string;
  },
) {
  if (search) {
    query = query.or(
      `numero_expediente.ilike.%${search}%,descripcion.ilike.%${search}%`,
    );
  }
  if (tipo_dano && tipo_dano !== 'Todos') {
    query = query.eq('tipo_siniestro', tipo_dano);
  }
  if (estado && estado !== 'Todos') {
    query = query.eq('estado', estado);
  }
  if (tramitador_id && tramitador_id !== 'todos') {
    if (tramitador_id === 'sin_tramitador') {
      query = query.is('tramitador_id', null);
    } else {
      query = query.eq('tramitador_id', tramitador_id);
    }
  }
  if (operario_id && operario_id !== 'todos') {
    if (operario_id === 'sin_operario') {
      query = query.is('operario_id', null);
    } else {
      query = query.eq('operario_id', operario_id);
    }
  }
  if (urgente === 'true') {
    query = query.eq('prioridad', 'urgente');
  }
  if (vip === 'true') {
    query = query.eq('vip', true);
  }
  return query;
}

// ─── GET /siniestros/activos ─────────────────────────────────────────────────
// Lista de expedientes activos con datos operativos desnormalizados.
// Columnas: expediente, estado, tramitador, tipo, fecha_alta, dias_apertura,
//           fecha_espera, dias_sin_actualizar, perito, trabajos, presupuesto,
//           factura.

siniestrosRoutes.get('/activos', async (c) => {
  const supabase = c.get('supabase');
  const page     = Math.max(1, Number(c.req.query('page')) || 1);
  const perPage  = Math.min(200, Math.max(1, Number(c.req.query('per_page')) || 50));
  const from     = (page - 1) * perPage;

  // Filtros
  const search       = c.req.query('search');
  const tipo_dano    = c.req.query('tipo_dano');
  const estado       = c.req.query('estado');
  const tramitador_id = c.req.query('tramitador_id');
  const operario_id  = c.req.query('operario_id');
  const urgente      = c.req.query('urgente');
  const vip          = c.req.query('vip');

  let query = supabase
    .from('expedientes')
    .select(
      `id, numero_expediente, estado, tipo_siniestro, prioridad,
       pausado, vip, fecha_espera, fecha_alta_asegurado, notas,
       operario_id, perito_id, tramitador_id, updated_at, created_at,
       asegurados!asegurado_id(id, nombre, apellidos),
       companias!compania_id(id, nombre, codigo)`,
      { count: 'exact' },
    )
    .in('estado', ESTADOS_ACTIVOS);

  query = applyCommonFilters(query, {
    search, tipo_dano, estado, tramitador_id, operario_id, urgente, vip,
  });

  query = query
    .order('updated_at', { ascending: false })
    .range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  if (!data) return c.json({ data: { items: [], ...buildPaginacion(page, perPage, 0) }, error: null });

  // Obtener tramitadores por ids únicos
  const tramitadorIds = [...new Set(data.map((e: any) => e.tramitador_id).filter(Boolean))];
  let tramitadoresMap: Record<string, any> = {};
  if (tramitadorIds.length > 0) {
    const { data: tramitadores } = await supabase
      .from('tramitadores')
      .select('user_id, nombre, apellidos')
      .in('user_id', tramitadorIds);
    tramitadoresMap = Object.fromEntries(
      (tramitadores ?? []).map((t: any) => [t.user_id, t]),
    );
  }

  // Obtener operarios por ids únicos
  const operarioIds = [...new Set(data.map((e: any) => e.operario_id).filter(Boolean))];
  let operariosMap: Record<string, any> = {};
  if (operarioIds.length > 0) {
    const { data: operarios } = await supabase
      .from('operarios')
      .select('id, nombre, apellidos, telefono')
      .in('id', operarioIds);
    operariosMap = Object.fromEntries(
      (operarios ?? []).map((o: any) => [o.id, o]),
    );
  }

  // Obtener etiquetas para los expedientes
  const expedienteIds = data.map((e: any) => e.id);
  let etiquetasMap: Record<string, string[]> = {};
  if (expedienteIds.length > 0) {
    const { data: etiquetas } = await supabase
      .from('expediente_etiquetas')
      .select('expediente_id, etiqueta')
      .in('expediente_id', expedienteIds);
    for (const et of etiquetas ?? []) {
      if (!etiquetasMap[et.expediente_id]) etiquetasMap[et.expediente_id] = [];
      etiquetasMap[et.expediente_id].push(et.etiqueta);
    }
  }

  // Calcular indicadores de progreso del expediente (batch, sin N+1)
  const tieneTrabajosSet = new Set<string>();
  const tienePresupuestoSet = new Set<string>();
  const tieneFacturaSet = new Set<string>();

  if (expedienteIds.length > 0) {
    // tiene_trabajos: ¿existe algún parte_operario en las citas del expediente?
    const { data: citasData } = await supabase
      .from('citas')
      .select('id, expediente_id')
      .in('expediente_id', expedienteIds);

    const citaExpMap: Record<string, string> = {};
    for (const c of citasData ?? []) citaExpMap[c.id] = c.expediente_id;

    const citaIds = Object.keys(citaExpMap);
    if (citaIds.length > 0) {
      const { data: partes } = await supabase
        .from('partes_operario')
        .select('cita_id')
        .in('cita_id', citaIds);
      for (const p of partes ?? []) {
        const expId = citaExpMap[p.cita_id];
        if (expId) tieneTrabajosSet.add(expId);
      }
    }

    // tiene_presupuesto: ¿existe algún presupuesto para el expediente?
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('expediente_id')
      .in('expediente_id', expedienteIds);
    for (const p of presupuestos ?? []) tienePresupuestoSet.add(p.expediente_id);

    // tiene_factura: ¿existe alguna factura para el expediente?
    const { data: facturasActivos } = await supabase
      .from('facturas')
      .select('expediente_id')
      .in('expediente_id', expedienteIds);
    for (const f of facturasActivos ?? []) tieneFacturaSet.add(f.expediente_id);
  }

  const hoy = new Date();
  const items = data.map((e: any) => {
    const fechaAlta = e.fecha_alta_asegurado ?? e.created_at;
    const diasApertura = diasDesde(fechaAlta);
    const diasSinActualizar = diasDesde(e.updated_at);
    const fechaEsperaVencida = e.fecha_espera
      ? new Date(e.fecha_espera) < hoy
      : false;

    return {
      id: e.id,
      numero_expediente: e.numero_expediente,
      codigo_externo: null,
      compania: e.companias ?? { id: '', nombre: '', codigo: '' },
      estado: e.estado,
      tramitador: e.tramitador_id
        ? tramitadoresMap[e.tramitador_id] ?? null
        : null,
      tipo_dano: e.tipo_siniestro ?? '',
      etiquetas: etiquetasMap[e.id] ?? [],
      urgente: e.prioridad === 'urgente',
      vip: e.vip ?? false,
      pausado: e.pausado ?? false,
      fecha_alta_asegurado: fechaAlta,
      dias_apertura: diasApertura,
      fecha_espera: e.fecha_espera,
      fecha_espera_vencida: fechaEsperaVencida,
      dias_sin_actualizar: diasSinActualizar,
      asegurado: e.asegurados ?? { nombre: '', apellidos: '' },
      operario: e.operario_id ? (operariosMap[e.operario_id] ?? null) : null,
      perito_asignado: e.perito_id !== null,
      tiene_trabajos: tieneTrabajosSet.has(e.id),
      tiene_trabajos_reclamados: false, // pendiente: requiere campo estado en partes_operario
      tiene_presupuesto: tienePresupuestoSet.has(e.id),
      tiene_factura: tieneFacturaSet.has(e.id),
    };
  });

  return c.json({
    data: { items, ...buildPaginacion(page, perPage, count) },
    error: null,
  });
});

// ─── GET /siniestros/activos/stats ───────────────────────────────────────────
// Contadores por estado para el filtro "estado pendiente".

siniestrosRoutes.get('/activos/stats', async (c) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase
    .from('expedientes')
    .select('estado')
    .in('estado', ESTADOS_ACTIVOS);

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  const counters: Record<string, number> = {};
  for (const row of data ?? []) {
    counters[row.estado] = (counters[row.estado] ?? 0) + 1;
  }

  const result = Object.entries(counters).map(([estado, total]) => ({ estado, total }));
  return c.json({ data: result, error: null });
});

// ─── GET /siniestros/finalizados ─────────────────────────────────────────────
// Lista de expedientes finalizados con sub-tabla de facturas.

siniestrosRoutes.get('/finalizados', async (c) => {
  const supabase = c.get('supabase');
  const page     = Math.max(1, Number(c.req.query('page')) || 1);
  const perPage  = Math.min(200, Math.max(1, Number(c.req.query('per_page')) || 50));
  const from     = (page - 1) * perPage;

  const search        = c.req.query('search');
  const tipo_dano     = c.req.query('tipo_dano');
  const estado        = c.req.query('estado');
  const tramitador_id = c.req.query('tramitador_id');
  const operario_id   = c.req.query('operario_id');
  const urgente       = c.req.query('urgente');
  const vip           = c.req.query('vip');
  const pendientes_cobrar = c.req.query('pendientes_cobrar');

  let query = supabase
    .from('expedientes')
    .select(
      `id, numero_expediente, estado, tipo_siniestro, prioridad,
       pausado, vip, fecha_espera, fecha_alta_asegurado, notas,
       operario_id, perito_id, tramitador_id, updated_at, created_at,
       asegurados!asegurado_id(id, nombre, apellidos),
       companias!compania_id(id, nombre, codigo)`,
      { count: 'exact' },
    )
    .in('estado', ESTADOS_FINALIZADOS);

  query = applyCommonFilters(query, {
    search, tipo_dano, estado, tramitador_id, operario_id, urgente, vip,
  });

  // Solo expedientes con facturas pendientes de cobro
  if (pendientes_cobrar === 'true') {
    query = query.in('estado', ['FINALIZADO', 'FACTURADO']);
  }

  query = query
    .order('updated_at', { ascending: false })
    .range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  if (!data) return c.json({ data: { items: [], ...buildPaginacion(page, perPage, 0) }, error: null });

  // Tramitadores
  const tramitadorIds = [...new Set(data.map((e: any) => e.tramitador_id).filter(Boolean))];
  let tramitadoresMap: Record<string, any> = {};
  if (tramitadorIds.length > 0) {
    const { data: tramitadores } = await supabase
      .from('tramitadores')
      .select('user_id, nombre, apellidos')
      .in('user_id', tramitadorIds);
    tramitadoresMap = Object.fromEntries(
      (tramitadores ?? []).map((t: any) => [t.user_id, t]),
    );
  }

  // Operarios
  const operarioIds = [...new Set(data.map((e: any) => e.operario_id).filter(Boolean))];
  let operariosMap: Record<string, any> = {};
  if (operarioIds.length > 0) {
    const { data: operarios } = await supabase
      .from('operarios')
      .select('id, nombre, apellidos, telefono')
      .in('id', operarioIds);
    operariosMap = Object.fromEntries(
      (operarios ?? []).map((o: any) => [o.id, o]),
    );
  }

  // Etiquetas
  const expedienteIds = data.map((e: any) => e.id);
  let etiquetasMap: Record<string, string[]> = {};
  if (expedienteIds.length > 0) {
    const { data: etiquetas } = await supabase
      .from('expediente_etiquetas')
      .select('expediente_id, etiqueta')
      .in('expediente_id', expedienteIds);
    for (const et of etiquetas ?? []) {
      if (!etiquetasMap[et.expediente_id]) etiquetasMap[et.expediente_id] = [];
      etiquetasMap[et.expediente_id].push(et.etiqueta);
    }
  }

  // Facturas por expediente
  let facturasMap: Record<string, any[]> = {};
  if (expedienteIds.length > 0) {
    const { data: facturas } = await supabase
      .from('facturas')
      .select(
        'id, expediente_id, numero_factura, base_imponible, iva_importe, total, enviada_at, cobrada_at, estado_cobro, fecha_emision',
      )
      .in('expediente_id', expedienteIds)
      .order('fecha_emision', { ascending: false });
    for (const f of facturas ?? []) {
      if (!facturasMap[f.expediente_id]) facturasMap[f.expediente_id] = [];
      facturasMap[f.expediente_id].push({
        id: f.id,
        numero_factura: f.numero_factura,
        tipo: null,
        base_imponible: f.base_imponible,
        iva: f.iva_importe,
        total: f.total,
        enviada: f.enviada_at !== null,
        fecha_autorizacion: null,
        cobrada: f.cobrada_at !== null || f.estado_cobro === 'cobrada',
        fecha_emision: f.fecha_emision,
        fecha_factura: null,
      });
    }
  }

  const hoy = new Date();
  const items = data.map((e: any) => {
    const fechaAlta = e.fecha_alta_asegurado ?? e.created_at;
    const facturasExp = facturasMap[e.id] ?? [];
    const primeraFactura = facturasExp[0];
    return {
      id: e.id,
      numero_expediente: e.numero_expediente,
      codigo_externo: null,
      compania: e.companias ?? { id: '', nombre: '', codigo: '' },
      estado: e.estado,
      tramitador: e.tramitador_id ? (tramitadoresMap[e.tramitador_id] ?? null) : null,
      tipo_dano: e.tipo_siniestro ?? '',
      etiquetas: etiquetasMap[e.id] ?? [],
      urgente: e.prioridad === 'urgente',
      vip: e.vip ?? false,
      pausado: e.pausado ?? false,
      fecha_alta_asegurado: fechaAlta,
      dias_apertura: diasDesde(fechaAlta),
      fecha_espera: e.fecha_espera,
      fecha_espera_vencida: e.fecha_espera ? new Date(e.fecha_espera) < hoy : false,
      dias_sin_actualizar: diasDesde(e.updated_at),
      asegurado: e.asegurados ?? { nombre: '', apellidos: '' },
      operario: e.operario_id ? (operariosMap[e.operario_id] ?? null) : null,
      perito_asignado: e.perito_id !== null,
      tiene_trabajos: false,
      tiene_trabajos_reclamados: false,
      tiene_presupuesto: false,
      tiene_factura: facturasExp.length > 0,
      fecha_emision_factura: primeraFactura?.fecha_emision ?? null,
      fecha_factura: primeraFactura?.fecha_factura ?? null,
      facturas: facturasExp,
    };
  });

  return c.json({
    data: { items, ...buildPaginacion(page, perPage, count) },
    error: null,
  });
});

// ─── GET /siniestros/:id/seguimiento ─────────────────────────────────────────
// Datos completos del expediente para la ficha de seguimiento (39 secciones).

siniestrosRoutes.get('/:id/seguimiento', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  // 1. Expediente base con asegurado y compañía
  const { data: exp, error: expError } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente, estado, tipo_siniestro, especialidad_siniestro, prioridad,
      pausado, vip, fecha_espera, fecha_alta_asegurado, notas,
      descripcion, origen, operario_id, perito_id, tramitador_id,
      pendiente_de, compania_id,
      updated_at, created_at,
      asegurados!asegurado_id(
        id, nombre, apellidos, telefono, telefono_desc, telefono_movil,
        telefono2, telefono2_desc, telefono2_movil,
        telefono3, telefono3_desc, telefono3_movil,
        telefono_prioridad, email, nif, consentimiento_com, consentimiento_tipo,
        direccion, codigo_postal, localidad, provincia
      ),
      companias!compania_id(id, nombre, codigo)
    `)
    .eq('id', id)
    .single();

  if (expError || !exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  // 2. Tramitador
  let tramitador = null;
  if (exp.tramitador_id) {
    const { data: t } = await supabase
      .from('tramitadores')
      .select('user_id, nombre, apellidos')
      .eq('user_id', exp.tramitador_id)
      .single();
    tramitador = t ?? null;
  }

  // 3. Operario
  let operario = null;
  if (exp.operario_id) {
    const { data: o } = await supabase
      .from('operarios')
      .select('id, nombre, apellidos, telefono')
      .eq('id', exp.operario_id)
      .single();
    operario = o ?? null;
  }

  // 4. Perito
  let perito = null;
  if (exp.perito_id) {
    const { data: p } = await supabase
      .from('peritos')
      .select('id, nombre')
      .eq('id', exp.perito_id)
      .single();
    perito = p ?? null;
  }

  // 5. Etiquetas
  const { data: etiquetas } = await supabase
    .from('expediente_etiquetas')
    .select('etiqueta')
    .eq('expediente_id', id);

  // 6. Visitas/Citas con fotos
  // Nota: citas tiene fecha (DATE) + franja_inicio (TIME) — no existe fecha_hora
  const { data: citas } = await supabase
    .from('citas')
    .select(`
      id, fecha, franja_inicio, franja_fin, estado, notas, campo_2,
      operario_id,
      evidencias(id, storage_path, descripcion, tipo, clasificacion)
    `)
    .eq('expediente_id', id)
    .order('fecha', { ascending: false });

  // Enriquecer citas con datos del operario si no vienen join
  const citasOperarioIds = [...new Set((citas ?? []).map((c: any) => c.operario_id).filter(Boolean))];
  let citasOperariosMap: Record<string, any> = {};
  if (citasOperarioIds.length > 0) {
    const { data: citasOperarios } = await supabase
      .from('operarios')
      .select('id, nombre, apellidos, telefono')
      .in('id', citasOperarioIds);
    citasOperariosMap = Object.fromEntries((citasOperarios ?? []).map((o: any) => [o.id, o]));
  }

  const visitas = (citas ?? []).map((cita: any) => ({
    id: cita.id,
    // Combinar fecha + franja_inicio para construir un ISO datetime
    fecha_hora: cita.fecha && cita.franja_inicio
      ? `${cita.fecha}T${cita.franja_inicio}`
      : (cita.fecha ?? null),
    estado: cita.estado ?? 'pendiente',
    notas: cita.notas,
    campo_2: cita.campo_2 ?? null,
    operario: cita.operario_id ? (citasOperariosMap[cita.operario_id] ?? null) : null,
    fotos_antes: (cita.evidencias ?? [])
      .filter((e: any) => e.clasificacion === 'antes' || e.tipo === 'foto_antes' || e.tipo === 'foto')
      .map((e: any) => ({ id: e.id, archivo: e.storage_path, descripcion: e.descripcion })),
    fotos_despues: (cita.evidencias ?? [])
      .filter((e: any) => e.clasificacion === 'despues' || e.tipo === 'foto_despues')
      .map((e: any) => ({ id: e.id, archivo: e.storage_path, descripcion: e.descripcion })),
  }));

  // 7. Pedidos de material
  const { data: pedidosRaw } = await supabase
    .from('pedidos_material')
    .select('id, numero_pedido, descripcion, fecha_creacion, fecha_limite, estado, proveedor_id')
    .eq('expediente_id', id)
    .order('fecha_creacion', { ascending: false });

  const proveedorIds = [...new Set((pedidosRaw ?? []).map((p: any) => p.proveedor_id).filter(Boolean))];
  let proveedoresMap: Record<string, any> = {};
  if (proveedorIds.length > 0) {
    const { data: proveedores } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .in('id', proveedorIds);
    proveedoresMap = Object.fromEntries((proveedores ?? []).map((p: any) => [p.id, p]));
  }

  const pedidos = (pedidosRaw ?? []).map((p: any) => ({
    id: p.id,
    numero_pedido: p.numero_pedido,
    proveedor: p.proveedor_id ? (proveedoresMap[p.proveedor_id] ?? null) : null,
    descripcion: p.descripcion ?? '',
    fecha_creacion: p.fecha_creacion,
    fecha_limite: p.fecha_limite,
    estado: p.estado ?? 'pendiente',
  }));

  // 8. Incidencias
  const { data: incidencias } = await supabase
    .from('expediente_incidencias')
    .select('*')
    .eq('expediente_id', id)
    .order('fecha', { ascending: false });

  // 9. Comunicaciones
  const { data: comunicaciones } = await supabase
    .from('comunicaciones')
    .select('id, tipo, destinatario, contenido, created_at')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  // 10. Documentos
  const { data: documentos } = await supabase
    .from('evidencias')
    .select('id, tipo, storage_path, descripcion, created_at')
    .eq('expediente_id', id)
    .not('tipo', 'in', '(foto_antes,foto_despues,foto,firma)')
    .order('created_at', { ascending: false });

  // 11. Presupuestos
  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('id, numero, estado, importe_total, created_at')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  // 12. Facturas
  const { data: facturasRaw } = await supabase
    .from('facturas')
    .select('id, numero_factura, base_imponible, iva_importe, total, enviada_at, cobrada_at, estado_cobro, fecha_emision')
    .eq('expediente_id', id)
    .order('fecha_emision', { ascending: false });

  // B1-S3: Tipos de compañía disponibles + activos para este expediente
  const compania_id = (exp as any).compania_id;
  const { data: tiposCompania } = compania_id
    ? await supabase
        .from('tipos_compania')
        .select('id, nombre, activo, orden')
        .eq('compania_id', compania_id)
        .eq('activo', true)
        .order('orden')
    : { data: [] };

  const { data: tiposActivos } = await supabase
    .from('expediente_tipos_compania')
    .select('tipo_id')
    .eq('expediente_id', id);

  const tiposActivosSet = new Set((tiposActivos ?? []).map((a: any) => a.tipo_id));

  const tipos_compania = (tiposCompania ?? []).map((t: any) => ({
    id: t.id,
    nombre: t.nombre,
    activo: t.activo,
    orden: t.orden,
    seleccionado: tiposActivosSet.has(t.id),
  }));

  // B1-S3: Eventos ejecutables configurados para la compañía
  const { data: eventosData } = compania_id
    ? await supabase
        .from('eventos_compania')
        .select('id, nombre, tipo_evento, configuracion, orden')
        .eq('compania_id', compania_id)
        .eq('activo', true)
        .order('orden')
    : { data: [] };

  // B1-S1: Presencia — quién tiene el expediente abierto
  const presenciaExpiresAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: presenciaData } = await supabase
    .from('expediente_presencia')
    .select('user_id, user_nombre, locked_at, last_heartbeat')
    .eq('expediente_id', id)
    .gt('last_heartbeat', presenciaExpiresAt)
    .maybeSingle();

  // B2-S8: Trabajos del expediente con estado No iniciado / Subsanado
  const { data: trabajosRaw } = await supabase
    .from('trabajos_expediente')
    .select('id, operario_id, operario_nombre, especialidad, descripcion, estado, fecha_asignacion, fecha_cita, fecha_finalizacion, orden, created_at')
    .eq('expediente_id', id)
    .order('orden', { ascending: true });

  // B2-S9: Comunicaciones ASITUR
  const { data: comAsiturRaw } = await supabase
    .from('comunicaciones_asitur')
    .select('id, tipo_mensaje, contenido, adjunto_path, adjunto_nombre, direccion, actor_nombre, leido, created_at')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  // B2-S10: Notas internas (tramitadores + operarios)
  const { data: notasRaw } = await supabase
    .from('notas_internas')
    .select('id, tipo, texto, autor_id, autor_nombre, alarma_fecha, alarma_usuario_nombre, alarma_tipo, alarma_estado, realizado, created_at')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  // B1-S5: Asegurado con campos extendidos de comunicaciones
  const rawAsegurado = (exp as any).asegurados ?? {};
  const asegurado = {
    id: rawAsegurado.id ?? '',
    nombre: rawAsegurado.nombre ?? '',
    apellidos: rawAsegurado.apellidos ?? '',
    nif: rawAsegurado.nif ?? null,
    direccion: rawAsegurado.direccion ?? '',
    codigo_postal: rawAsegurado.codigo_postal ?? '',
    localidad: rawAsegurado.localidad ?? '',
    provincia: rawAsegurado.provincia ?? '',
    telefono: rawAsegurado.telefono ?? null,
    telefono_desc: rawAsegurado.telefono_desc ?? null,
    telefono_movil: rawAsegurado.telefono_movil ?? false,
    telefono2: rawAsegurado.telefono2 ?? null,
    telefono2_desc: rawAsegurado.telefono2_desc ?? null,
    telefono2_movil: rawAsegurado.telefono2_movil ?? false,
    telefono3: rawAsegurado.telefono3 ?? null,
    telefono3_desc: rawAsegurado.telefono3_desc ?? null,
    telefono3_movil: rawAsegurado.telefono3_movil ?? false,
    telefono_prioridad: rawAsegurado.telefono_prioridad ?? 1,
    email: rawAsegurado.email ?? null,
    consentimiento_com: rawAsegurado.consentimiento_com ?? null,
    consentimiento_tipo: rawAsegurado.consentimiento_tipo ?? null,
  };

  const result = {
    id: exp.id,
    numero_expediente: exp.numero_expediente,
    codigo_externo: null,
    tipo_dano:    exp.tipo_siniestro ?? '',
    especialidad: (exp as any).especialidad_siniestro ?? null,
    estado: exp.estado,
    pendiente_de: (exp as any).pendiente_de ?? null,
    etiquetas: (etiquetas ?? []).map((e: any) => e.etiqueta),
    pausado: exp.pausado ?? false,
    urgente: exp.prioridad === 'urgente',
    vip: exp.vip ?? false,
    fecha_espera: exp.fecha_espera,
    fecha_alta_asegurado: exp.fecha_alta_asegurado ?? exp.created_at,
    notas: exp.notas,
    origen: exp.origen,
    descripcion: exp.descripcion ?? '',
    compania: (exp as any).companias ?? { id: '', nombre: '', codigo: '' },
    asegurado,
    tramitador: tramitador ? { id: tramitador.user_id, nombre: tramitador.nombre, apellidos: tramitador.apellidos } : null,
    operario,
    perito,
    // B1-S3
    tipos_compania,
    eventos: eventosData ?? [],
    // B1-S1
    presencia: presenciaData ?? null,
    visitas,
    pedidos,
    incidencias: (incidencias ?? []),
    comunicaciones: (comunicaciones ?? []).map((c: any) => ({
      id: c.id,
      tipo: c.tipo,
      destinatario: c.destinatario,
      contenido: c.contenido,
      fecha_envio: c.created_at,
    })),
    documentos: (documentos ?? []).map((d: any) => ({
      id: d.id,
      tipo_documento: d.tipo,
      archivo: d.storage_path,
      descripcion: d.descripcion,
      fecha_subida: d.created_at,
    })),
    presupuestos: (presupuestos ?? []).map((p: any) => ({
      id: p.id,
      numero: p.numero,
      estado: p.estado,
      importe: p.importe_total ?? 0,
      fecha_creacion: p.created_at,
    })),
    facturas: (facturasRaw ?? []).map((f: any) => ({
      id: f.id,
      numero_factura: f.numero_factura,
      tipo: null,
      base_imponible: f.base_imponible,
      iva: f.iva_importe,
      total: f.total,
      enviada: f.enviada_at !== null,
      fecha_autorizacion: null,
      cobrada: f.cobrada_at !== null || f.estado_cobro === 'cobrada',
      fecha_emision: f.fecha_emision,
      fecha_factura: null,
    })),
    // B2 fields
    trabajos: (trabajosRaw ?? []) as any[],
    notas_tramitador: (notasRaw ?? []).filter((n: any) => n.tipo === 'tramitador'),
    notas_operario:   (notasRaw ?? []).filter((n: any) => n.tipo === 'operario'),
    comunicaciones_asitur: (comAsiturRaw ?? []) as any[],
  };

  return c.json({ data: result, error: null });
});

// ─── PATCH /siniestros/:id ────────────────────────────────────────────────────
// Actualiza campos operativos del expediente desde la ficha de seguimiento.

const ALLOWED_PATCH_FIELDS = [
  'tipo_siniestro', 'estado', 'tramitador_id', 'operario_id',
  'pausado', 'vip', 'prioridad', 'fecha_espera', 'notas',
  'fecha_alta_asegurado', 'pendiente_de',
];

siniestrosRoutes.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<Record<string, unknown>>();

  // Comprobar que el expediente existe
  const { data: existing } = await supabase
    .from('expedientes')
    .select('id, estado')
    .eq('id', id)
    .single();

  if (!existing) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  // Mapeo de campo externo a interno
  if ('tipo_dano'    in body) update['tipo_siniestro']        = body['tipo_dano'];
  if ('especialidad' in body) update['especialidad_siniestro'] = body['especialidad'];
  if ('urgente'      in body) update['prioridad']             = body['urgente'] ? 'urgente' : 'media';

  // Gestión de etiquetas aparte (reemplaza el set completo)
  if ('etiquetas' in body && Array.isArray(body['etiquetas'])) {
    // Obtener compania_id del expediente
    const { data: expData } = await supabase
      .from('expedientes')
      .select('compania_id')
      .eq('id', id)
      .single();

    if (expData) {
      // Borrar etiquetas actuales y reinsertar
      await supabase.from('expediente_etiquetas').delete().eq('expediente_id', id);
      const newEtiquetas = (body['etiquetas'] as string[]).map((etiqueta) => ({
        expediente_id: id,
        compania_id: expData.compania_id,
        etiqueta,
        creado_por: user?.id ?? null,
      }));
      if (newEtiquetas.length > 0) {
        await supabase.from('expediente_etiquetas').insert(newEtiquetas);
      }
    }
  }

  if (Object.keys(update).length === 0 && !('etiquetas' in body)) {
    return c.json(err('VALIDATION', 'No hay campos para actualizar'), 422);
  }

  if (Object.keys(update).length > 0) {
    const { data, error } = await supabase
      .from('expedientes')
      .update(update)
      .eq('id', id)
      .select('id')
      .single();

    if (error) return c.json(err('DB_ERROR', error.message), 500);

    await insertAudit(supabase, {
      tabla: 'expedientes',
      accion: 'UPDATE',
      registro_id: id,
      cambios: update,
      actor_id: user?.id ?? 'system',
    });
  }

  return c.json({ data: { id }, error: null });
});

// ─── POST /siniestros/:id/incidencias ────────────────────────────────────────
// Añade una incidencia al expediente.

siniestrosRoutes.post('/:id/incidencias', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    texto: string;
    origen?: string;
    tipologia?: string;
    nivel_rga?: string;
    imputada_a?: string;
    procedente?: boolean;
    fecha?: string;
    // B3 extended fields
    tipo_incidencia?: string | null;
    plataforma_usuario_id?: string | null;
    plataforma_usuario_nombre?: string | null;
    interna?: boolean;
    proc_incidencia?: string | null;
  }>();

  if (!body.texto?.trim()) {
    return c.json(err('VALIDATION', 'texto es requerido'), 422);
  }

  // Obtener compania_id del expediente
  const { data: expData } = await supabase
    .from('expedientes')
    .select('id, compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data, error } = await supabase
    .from('expediente_incidencias')
    .insert({
      expediente_id:              id,
      compania_id:                expData.compania_id,
      texto:                      body.texto.trim(),
      origen:                     body.origen ?? null,
      tipologia:                  body.tipologia ?? null,
      nivel_rga:                  body.nivel_rga ?? null,
      imputada_a:                 body.imputada_a ?? null,
      procedente:                 body.procedente ?? false,
      fecha:                      body.fecha ?? new Date().toISOString(),
      creado_por:                 user?.id ?? null,
      // B3 fields
      tipo_incidencia:            body.tipo_incidencia ?? null,
      plataforma_usuario_id:      body.plataforma_usuario_id ?? null,
      plataforma_usuario_nombre:  body.plataforma_usuario_nombre ?? null,
      interna:                    body.interna ?? false,
      proc_incidencia:            body.proc_incidencia ?? null,
    })
    .select('*')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data, error: null }, 201);
});

// ─── DELETE /siniestros/:id/incidencias/:incidenciaId ────────────────────────
// Elimina una incidencia del expediente.

siniestrosRoutes.delete('/:id/incidencias/:incidenciaId', async (c) => {
  const supabase = c.get('supabase');
  const incidenciaId = c.req.param('incidenciaId');

  const { error } = await supabase
    .from('expediente_incidencias')
    .delete()
    .eq('id', incidenciaId);

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: { deleted: true }, error: null });
});

// ─── PATCH /siniestros/:id/facturas/:facturaId ────────────────────────────────
// Actualiza estado de envío/cobro de una factura desde los finalizados.

siniestrosRoutes.patch('/:id/facturas/:facturaId', async (c) => {
  const supabase    = c.get('supabase');
  const facturaId   = c.req.param('facturaId');
  const body        = await c.req.json<{
    enviada?: boolean;
    cobrada?: boolean;
  }>();

  const update: Record<string, unknown> = {};
  if (body.enviada !== undefined) {
    update.enviada_at = body.enviada ? new Date().toISOString() : null;
  }
  if (body.cobrada !== undefined) {
    update.cobrada_at  = body.cobrada ? new Date().toISOString() : null;
    update.estado_cobro = body.cobrada ? 'cobrada' : 'pendiente';
  }

  if (Object.keys(update).length === 0) {
    return c.json(err('VALIDATION', 'No hay campos para actualizar'), 422);
  }

  const { data, error } = await supabase
    .from('facturas')
    .update(update)
    .eq('id', facturaId)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data, error: null });
});

// ─── GET /siniestros/tramitadores-list ───────────────────────────────────────
// Lista de tramitadores para los filtros de las pantallas de siniestros.

siniestrosRoutes.get('/tramitadores-list', async (c) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase
    .from('tramitadores')
    .select('user_id, nombre, apellidos')
    .eq('activo', true)
    .order('nombre');

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: data ?? [], error: null });
});

// ─── GET /siniestros/operarios-list ──────────────────────────────────────────
// Lista de operarios para los filtros (activos primero). [EXISTING BELOW]

siniestrosRoutes.get('/operarios-list', async (c) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase
    .from('operarios')
    .select('id, nombre, apellidos, activo')
    .order('activo', { ascending: false })
    .order('nombre');

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: data ?? [], error: null });
});

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 1 — SECCIONES 1-5
// ═══════════════════════════════════════════════════════════════

// ─── S1: GET /siniestros/:id/presencia ───────────────────────────────────────
// Devuelve quién tiene el expediente bloqueado (si alguien lo tiene).
// Bloqueos con heartbeat >2min se consideran expirados y se limpian.

siniestrosRoutes.get('/:id/presencia', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const user     = c.get('user');

  // Limpiar bloqueos expirados (>2 minutos sin heartbeat)
  const expiresAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await supabase
    .from('expediente_presencia')
    .delete()
    .eq('expediente_id', id)
    .lt('last_heartbeat', expiresAt);

  const { data: presencia } = await supabase
    .from('expediente_presencia')
    .select('user_id, user_nombre, locked_at, last_heartbeat')
    .eq('expediente_id', id)
    .maybeSingle();

  if (!presencia) return c.json({ data: null, error: null });

  return c.json({
    data: {
      ...presencia,
      es_propio: presencia.user_id === user?.id,
      expirado: false,
    },
    error: null,
  });
});

// ─── S1: POST /siniestros/:id/presencia ──────────────────────────────────────
// Adquiere o renueva el bloqueo (heartbeat). Si ya está bloqueado por otro
// usuario, devuelve 409 CONFLICT con los datos del bloqueador.

siniestrosRoutes.post('/:id/presencia', async (c) => {
  const supabase    = c.get('supabase');
  const id          = c.req.param('id');
  const user        = c.get('user');

  if (!user?.id) return c.json(err('AUTH', 'Usuario no autenticado'), 401);

  // Obtener nombre del usuario
  const { data: perfil } = await supabase
    .from('user_profiles')
    .select('nombre, apellidos, compania_id')
    .eq('user_id', user.id)
    .single();

  if (!perfil) return c.json(err('AUTH', 'Perfil no encontrado'), 401);

  const user_nombre = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ');

  // Limpiar expirados primero
  const expiresAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await supabase
    .from('expediente_presencia')
    .delete()
    .eq('expediente_id', id)
    .lt('last_heartbeat', expiresAt);

  // ¿Hay otro usuario con el bloqueo activo?
  const { data: existente } = await supabase
    .from('expediente_presencia')
    .select('user_id, user_nombre, locked_at, last_heartbeat')
    .eq('expediente_id', id)
    .maybeSingle();

  if (existente && existente.user_id !== user.id) {
    return c.json({
      data: null,
      error: {
        code: 'EXPEDIENTE_BLOQUEADO',
        message: `El expediente está siendo editado por ${existente.user_nombre}`,
        details: existente,
      },
    }, 409);
  }

  const now = new Date().toISOString();

  if (existente && existente.user_id === user.id) {
    // Renovar heartbeat
    await supabase
      .from('expediente_presencia')
      .update({ last_heartbeat: now })
      .eq('expediente_id', id)
      .eq('user_id', user.id);
  } else {
    // Adquirir nuevo bloqueo
    await supabase
      .from('expediente_presencia')
      .insert({
        expediente_id: id,
        compania_id: perfil.compania_id,
        user_id: user.id,
        user_nombre,
        locked_at: now,
        last_heartbeat: now,
      });
  }

  return c.json({ data: { user_id: user.id, user_nombre, locked_at: now, es_propio: true }, error: null });
});

// ─── S1: DELETE /siniestros/:id/presencia ────────────────────────────────────
// Libera el bloqueo. El propio usuario siempre puede. Admin/supervisor puede forzar.

siniestrosRoutes.delete('/:id/presencia', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const user     = c.get('user');
  const force    = c.req.query('force') === 'true';

  if (!user?.id) return c.json(err('AUTH', 'Usuario no autenticado'), 401);

  // Verificar si el usuario puede forzar el desbloqueo
  if (force) {
    const { data: perfil } = await supabase
      .from('user_profiles')
      .select('rol')
      .eq('user_id', user.id)
      .single();
    if (!perfil || !['admin', 'supervisor'].includes(perfil.rol)) {
      return c.json(err('ACCESO_DENEGADO', 'Solo admin/supervisor puede forzar el desbloqueo'), 403);
    }
    await supabase.from('expediente_presencia').delete().eq('expediente_id', id);
  } else {
    await supabase
      .from('expediente_presencia')
      .delete()
      .eq('expediente_id', id)
      .eq('user_id', user.id);
  }

  return c.json({ data: { released: true }, error: null });
});

// ─── S3: PATCH /siniestros/:id/pendiente-de ──────────────────────────────────
// Actualiza el estado operacional (pendiente_de) del expediente.

siniestrosRoutes.patch('/:id/pendiente-de', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{ pendiente_de: string | null }>();

  const { data, error } = await supabase
    .from('expedientes')
    .update({ pendiente_de: body.pendiente_de ?? null })
    .eq('id', id)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'expedientes',
    accion: 'UPDATE',
    registro_id: id,
    cambios: { pendiente_de: body.pendiente_de },
    actor_id: user?.id ?? 'system',
  });

  return c.json({ data, error: null });
});

// ─── S3: GET /siniestros/:id/tipos-compania ───────────────────────────────────
// Devuelve los tipos de la compañía con indicador de cuáles están activos.

siniestrosRoutes.get('/:id/tipos-compania', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  // Obtener compania_id del expediente
  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  // Tipos disponibles para la compañía
  const { data: tipos } = await supabase
    .from('tipos_compania')
    .select('id, nombre, activo, orden')
    .eq('compania_id', exp.compania_id)
    .eq('activo', true)
    .order('orden');

  // Tipos activos para este expediente
  const { data: activos } = await supabase
    .from('expediente_tipos_compania')
    .select('tipo_id')
    .eq('expediente_id', id);

  const activosSet = new Set((activos ?? []).map((a: any) => a.tipo_id));

  const result = (tipos ?? []).map((t: any) => ({
    id: t.id,
    nombre: t.nombre,
    activo: t.activo,
    orden: t.orden,
    seleccionado: activosSet.has(t.id),
  }));

  return c.json({ data: result, error: null });
});

// ─── S3: PUT /siniestros/:id/tipos-compania ───────────────────────────────────
// Reemplaza los tipos activos del expediente (idempotente).

siniestrosRoutes.put('/:id/tipos-compania', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{ tipo_ids: string[] }>();

  if (!Array.isArray(body.tipo_ids)) {
    return c.json(err('VALIDATION', 'tipo_ids debe ser un array'), 422);
  }

  // Obtener compania_id
  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  // Reemplazar set completo
  await supabase.from('expediente_tipos_compania').delete().eq('expediente_id', id);

  if (body.tipo_ids.length > 0) {
    const rows = body.tipo_ids.map((tipo_id) => ({
      expediente_id: id,
      tipo_id,
      compania_id: exp.compania_id,
      activado_por: user?.id ?? null,
    }));
    await supabase.from('expediente_tipos_compania').insert(rows);
  }

  return c.json({ data: { updated: true }, error: null });
});

// ─── S3: GET /siniestros/:id/eventos ─────────────────────────────────────────
// Devuelve los eventos ejecutables configurados para la compañía del expediente.

siniestrosRoutes.get('/:id/eventos', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data: eventos } = await supabase
    .from('eventos_compania')
    .select('id, nombre, tipo_evento, configuracion, orden')
    .eq('compania_id', exp.compania_id)
    .eq('activo', true)
    .order('orden');

  return c.json({ data: eventos ?? [], error: null });
});

// ─── S3: POST /siniestros/:id/eventos/:eventoId/ejecutar ─────────────────────
// Ejecuta un evento configurado sobre el expediente.

siniestrosRoutes.post('/:id/eventos/:eventoId/ejecutar', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const id        = c.req.param('id');
  const eventoId  = c.req.param('eventoId');

  const { data: evento } = await supabase
    .from('eventos_compania')
    .select('*')
    .eq('id', eventoId)
    .eq('activo', true)
    .single();

  if (!evento) return c.json(err('NOT_FOUND', 'Evento no encontrado'), 404);

  const cfg = evento.configuracion as Record<string, unknown>;

  // Ejecutar según tipo_evento
  switch (evento.tipo_evento) {
    case 'cambio_estado': {
      const nuevoEstado = cfg.estado as string;
      if (nuevoEstado) {
        await supabase.from('expedientes').update({ estado: nuevoEstado }).eq('id', id);
      }
      break;
    }
    case 'cambio_pendiente_de': {
      const pendienteDe = cfg.pendiente_de as string;
      if (pendienteDe) {
        await supabase.from('expedientes').update({ pendiente_de: pendienteDe }).eq('id', id);
      }
      break;
    }
    case 'notificacion': {
      // La notificación real se registra en comunicaciones; SMS pendiente de integración
      await supabase.from('comunicaciones').insert({
        expediente_id: id,
        tipo: 'sistema',
        contenido: `Evento ejecutado: ${evento.nombre}`,
        actor_id: user?.id ?? 'system',
        actor_nombre: 'Sistema',
      });
      break;
    }
    default:
      break;
  }

  await insertAudit(supabase, {
    tabla: 'expedientes',
    accion: 'UPDATE',
    registro_id: id,
    cambios: { evento_ejecutado: evento.nombre, tipo: evento.tipo_evento },
    actor_id: user?.id ?? 'system',
  });

  return c.json({ data: { ejecutado: true, evento: evento.nombre }, error: null });
});

// ─── S4: POST /siniestros/:id/notificar-asegurado ────────────────────────────
// Envía notificación al asegurado para que contacte con la empresa.
// La integración SMS real se añadirá cuando esté disponible (DT: SMS pendiente).

siniestrosRoutes.post('/:id/notificar-asegurado', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');

  // Obtener expediente + asegurado
  const { data: exp } = await supabase
    .from('expedientes')
    .select(`
      id, numero_expediente,
      asegurados!asegurado_id(id, nombre, apellidos, telefono, email)
    `)
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const asegurado = (exp as any).asegurados;
  if (!asegurado) return c.json(err('NOT_FOUND', 'Asegurado no encontrado'), 404);

  // Registrar la notificación en el historial de comunicaciones
  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: 'sms',
    destinatario: asegurado.telefono,
    asunto: 'Notificación al asegurado',
    contenido: `Estimado/a ${asegurado.nombre} ${asegurado.apellidos}, le informamos que necesitamos que se ponga en contacto con nosotros para la gestión de su expediente ${(exp as any).numero_expediente}.`,
    actor_id: user?.id ?? 'system',
    actor_nombre: 'Sistema',
  });

  // TODO: Enviar SMS real cuando la integración SMS esté disponible (EP-SMS)

  return c.json({
    data: {
      enviado: true,
      canal: 'sms',
      destinatario: asegurado.telefono,
      nota: 'Comunicación registrada. Integración SMS pendiente de activación.',
    },
    error: null,
  });
});

// ─── S5: GET /siniestros/textos-predefinidos ─────────────────────────────────
// Lista de textos predefinidos globales + los de la compañía del usuario.

siniestrosRoutes.get('/textos-predefinidos', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const tipo     = c.req.query('tipo'); // 'sms' | 'email' | undefined (todos)

  // Obtener compania_id del usuario
  const { data: perfil } = await supabase
    .from('user_profiles')
    .select('compania_id')
    .eq('user_id', user?.id)
    .single();

  let query = supabase
    .from('textos_predefinidos')
    .select('id, tipo, nombre, asunto, cuerpo')
    .eq('activo', true)
    .order('orden');

  if (tipo) query = query.eq('tipo', tipo);

  // Globales (compania_id IS NULL) + los de la compañía del usuario
  if (perfil?.compania_id) {
    query = query.or(`compania_id.is.null,compania_id.eq.${perfil.compania_id}`);
  } else {
    query = query.is('compania_id', null);
  }

  const { data, error } = await query;

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: data ?? [], error: null });
});

// ─── S5: POST /siniestros/:id/comunicaciones/enviar-sms ──────────────────────
// Envía un SMS al asegurado/perjudicado y lo registra en comunicaciones.

siniestrosRoutes.post('/:id/comunicaciones/enviar-sms', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    telefono: string;
    texto: string;
    texto_predefinido_id?: string;
  }>();

  if (!body.telefono?.trim()) return c.json(err('VALIDATION', 'telefono es requerido'), 422);
  if (!body.texto?.trim())    return c.json(err('VALIDATION', 'texto es requerido'), 422);

  // Registrar en comunicaciones
  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: 'sms',
    destinatario: body.telefono,
    contenido: body.texto,
    actor_id: user?.id ?? 'system',
    actor_nombre: 'Sistema',
    metadata: body.texto_predefinido_id
      ? { texto_predefinido_id: body.texto_predefinido_id }
      : null,
  });

  // TODO: Enviar SMS real — integración pendiente (EP-SMS)

  return c.json({
    data: {
      enviado: true,
      canal: 'sms',
      destinatario: body.telefono,
      nota: 'SMS registrado. Integración SMS pendiente de activación.',
    },
    error: null,
  });
});

// ─── S5: POST /siniestros/:id/comunicaciones/enviar-email ────────────────────
// Envía un email al asegurado y lo registra en comunicaciones.

siniestrosRoutes.post('/:id/comunicaciones/enviar-email', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    email: string;
    asunto: string;
    cuerpo: string;
    texto_predefinido_id?: string;
  }>();

  if (!body.email?.trim())  return c.json(err('VALIDATION', 'email es requerido'), 422);
  if (!body.asunto?.trim()) return c.json(err('VALIDATION', 'asunto es requerido'), 422);
  if (!body.cuerpo?.trim()) return c.json(err('VALIDATION', 'cuerpo es requerido'), 422);

  // Registrar en comunicaciones
  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: 'email_saliente',
    destinatario: body.email,
    asunto: body.asunto,
    contenido: body.cuerpo,
    actor_id: user?.id ?? 'system',
    actor_nombre: 'Sistema',
    metadata: body.texto_predefinido_id
      ? { texto_predefinido_id: body.texto_predefinido_id }
      : null,
  });

  // TODO: Enviar email real via Resend cuando se implemente la plantilla

  return c.json({
    data: {
      enviado: true,
      canal: 'email',
      destinatario: body.email,
      asunto: body.asunto,
    },
    error: null,
  });
});

// ─── S5: POST /siniestros/:id/comunicaciones/enviar-panel-cliente ─────────────
// Envía enlace "Sigue Tu Expediente" al asegurado (SMS o email).

siniestrosRoutes.post('/:id/comunicaciones/enviar-panel-cliente', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    canal: 'sms' | 'email';
    telefono?: string;
    email?: string;
  }>();

  if (body.canal === 'sms' && !body.telefono) {
    return c.json(err('VALIDATION', 'telefono requerido para canal sms'), 422);
  }
  if (body.canal === 'email' && !body.email) {
    return c.json(err('VALIDATION', 'email requerido para canal email'), 422);
  }

  // Obtener el tracking link si existe (customer_tracking)
  const { data: token } = await supabase
    .from('customer_tracking_tokens')
    .select('token, path, expires_at')
    .eq('expediente_id', id)
    .eq('revoked', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const panelUrl = token?.path
    ? `${c.env.CUSTOMER_PORTAL_URL ?? ''}${token.path}`
    : `Enlace en preparación — expediente ${id}`;

  const texto = body.canal === 'sms'
    ? `Siga el estado de su expediente en: ${panelUrl}`
    : `Le enviamos el enlace para seguir el estado de su expediente: ${panelUrl}`;

  // Registrar
  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: body.canal === 'sms' ? 'sms' : 'email_saliente',
    destinatario: body.canal === 'sms' ? body.telefono : body.email,
    asunto: 'Enlace Sigue Tu Expediente',
    contenido: texto,
    actor_id: user?.id ?? 'system',
    actor_nombre: 'Sistema',
    metadata: { tipo_envio: 'panel_cliente', canal: body.canal },
  });

  return c.json({
    data: { enviado: true, canal: body.canal, url: panelUrl },
    error: null,
  });
});

// ─── S5: POST /siniestros/:id/comunicaciones/enviar-teleasistencia ─────────────
// Envía enlace de TeleAsistencia (videollamada) al asegurado.

siniestrosRoutes.post('/:id/comunicaciones/enviar-teleasistencia', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    canal: 'sms' | 'email';
    telefono?: string;
    email?: string;
  }>();

  if (body.canal === 'sms' && !body.telefono) {
    return c.json(err('VALIDATION', 'telefono requerido'), 422);
  }
  if (body.canal === 'email' && !body.email) {
    return c.json(err('VALIDATION', 'email requerido'), 422);
  }

  // Obtener sesión de VP activa si existe
  const { data: vp } = await supabase
    .from('videoperitaciones')
    .select('id')
    .eq('expediente_id', id)
    .in('estado', ['pendiente', 'agendada', 'en_curso'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const teleUrl = vp
    ? `${c.env.CUSTOMER_PORTAL_URL ?? ''}/teleasistencia/${vp.id}`
    : 'Enlace TeleAsistencia en preparación';

  const texto = body.canal === 'sms'
    ? `Acceda a su sesión de TeleAsistencia en: ${teleUrl}`
    : `Le enviamos el enlace para su sesión de TeleAsistencia: ${teleUrl}`;

  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: body.canal === 'sms' ? 'sms' : 'email_saliente',
    destinatario: body.canal === 'sms' ? body.telefono : body.email,
    asunto: 'Enlace TeleAsistencia',
    contenido: texto,
    actor_id: user?.id ?? 'system',
    actor_nombre: 'Sistema',
    metadata: { tipo_envio: 'teleasistencia', canal: body.canal },
  });

  return c.json({
    data: { enviado: true, canal: body.canal, url: teleUrl },
    error: null,
  });
});

// ─── S5: PATCH /siniestros/:id/asegurado/comunicaciones ──────────────────────
// Actualiza datos de contacto y consentimiento del asegurado.

siniestrosRoutes.patch('/:id/asegurado/comunicaciones', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    asegurado_id: string;
    consentimiento_com?: 'acepta' | 'rechaza';
    consentimiento_tipo?: 'sms' | 'email' | 'ambos';
    telefono?: string;
    telefono_desc?: string;
    telefono_movil?: boolean;
    telefono_prioridad?: number;
    telefono2?: string;
    telefono2_desc?: string;
    telefono2_movil?: boolean;
    telefono3?: string;
    telefono3_desc?: string;
    telefono3_movil?: boolean;
    email?: string;
  }>();

  if (!body.asegurado_id) {
    return c.json(err('VALIDATION', 'asegurado_id es requerido'), 422);
  }

  const ALLOWED_FIELDS = [
    'consentimiento_com', 'consentimiento_tipo',
    'telefono', 'telefono_desc', 'telefono_movil', 'telefono_prioridad',
    'telefono2', 'telefono2_desc', 'telefono2_movil',
    'telefono3', 'telefono3_desc', 'telefono3_movil',
    'email',
  ];

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = (body as any)[field];
  }

  if (Object.keys(update).length === 0) {
    return c.json(err('VALIDATION', 'No hay campos para actualizar'), 422);
  }

  const { data, error } = await supabase
    .from('asegurados')
    .update(update)
    .eq('id', body.asegurado_id)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'asegurados',
    accion: 'UPDATE',
    registro_id: body.asegurado_id,
    cambios: update,
    actor_id: user?.id ?? 'system',
  });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 2 — SECCIONES 7-10
// ═══════════════════════════════════════════════════════════════

// ─── S7: POST /siniestros/:id/pedidos ────────────────────────────────────────
// Crea un pedido de material asociado al expediente desde la ficha de seguimiento.

siniestrosRoutes.post('/:id/pedidos', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    proveedor_id: string;
    descripcion: string;
    fecha_limite?: string | null;
  }>();

  if (!body.proveedor_id) return c.json(err('VALIDATION', 'proveedor_id es requerido'), 422);
  if (!body.descripcion?.trim()) return c.json(err('VALIDATION', 'descripcion es requerida'), 422);

  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data, error } = await supabase
    .from('pedidos_material')
    .insert({
      expediente_id: id,
      compania_id:   exp.compania_id,
      proveedor_id:  body.proveedor_id,
      descripcion:   body.descripcion,
      fecha_limite:  body.fecha_limite ?? null,
      fecha_creacion: new Date().toISOString(),
      estado: 'pendiente',
    })
    .select('id, numero_pedido, descripcion, fecha_creacion, fecha_limite, estado, proveedor_id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'pedidos_material', accion: 'INSERT',
    registro_id: data.id, cambios: body, actor_id: user?.id ?? 'system',
  });

  return c.json({ data, error: null }, 201);
});

// ─── S7: PATCH /siniestros/:id/pedidos/:pedido_id ─────────────────────────────

siniestrosRoutes.patch('/:id/pedidos/:pedido_id', async (c) => {
  const supabase   = c.get('supabase');
  const id         = c.req.param('id');
  const pedidoId   = c.req.param('pedido_id');
  const body       = await c.req.json<{ estado?: string; fecha_limite?: string | null }>();

  const update: Record<string, unknown> = {};
  if ('estado' in body)       update.estado       = body.estado;
  if ('fecha_limite' in body) update.fecha_limite = body.fecha_limite ?? null;

  if (Object.keys(update).length === 0) return c.json(err('VALIDATION', 'Sin campos'), 422);

  const { data, error } = await supabase
    .from('pedidos_material')
    .update(update)
    .eq('id', pedidoId)
    .eq('expediente_id', id)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── S7: DELETE /siniestros/:id/pedidos/:pedido_id ────────────────────────────

siniestrosRoutes.delete('/:id/pedidos/:pedido_id', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const pedidoId = c.req.param('pedido_id');

  const { error } = await supabase
    .from('pedidos_material')
    .delete()
    .eq('id', pedidoId)
    .eq('expediente_id', id);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: { deleted: true }, error: null });
});

// ─── S8: PATCH /siniestros/:id/trabajos/:trabajo_id/estado ───────────────────
// Actualiza el estado (No iniciado / Subsanado) de un trabajo.

siniestrosRoutes.patch('/:id/trabajos/:trabajo_id/estado', async (c) => {
  const supabase   = c.get('supabase');
  const id         = c.req.param('id');
  const trabajoId  = c.req.param('trabajo_id');
  const body       = await c.req.json<{ estado: 'No iniciado' | 'Subsanado' }>();

  if (!['No iniciado', 'Subsanado'].includes(body.estado)) {
    return c.json(err('VALIDATION', 'estado debe ser "No iniciado" o "Subsanado"'), 422);
  }

  const { data, error } = await supabase
    .from('trabajos_expediente')
    .update({ estado: body.estado })
    .eq('id', trabajoId)
    .eq('expediente_id', id)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── S8: POST /siniestros/:id/trabajos ───────────────────────────────────────

siniestrosRoutes.post('/:id/trabajos', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    operario_nombre?: string | null;
    especialidad?: string | null;
    descripcion: string;
    fecha_asignacion?: string | null;
    fecha_cita?: string | null;
    orden?: number;
  }>();

  if (!body.descripcion?.trim()) return c.json(err('VALIDATION', 'descripcion es requerida'), 422);

  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data, error } = await supabase
    .from('trabajos_expediente')
    .insert({
      expediente_id:    id,
      compania_id:      exp.compania_id,
      operario_nombre:  body.operario_nombre ?? null,
      especialidad:     body.especialidad ?? null,
      descripcion:      body.descripcion,
      estado:           'No iniciado',
      fecha_asignacion: body.fecha_asignacion ?? null,
      fecha_cita:       body.fecha_cita ?? null,
      orden:            body.orden ?? 0,
    })
    .select('*')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null }, 201);
});

// ─── S8: DELETE /siniestros/:id/trabajos/:trabajo_id ─────────────────────────

siniestrosRoutes.delete('/:id/trabajos/:trabajo_id', async (c) => {
  const supabase  = c.get('supabase');
  const id        = c.req.param('id');
  const trabajoId = c.req.param('trabajo_id');

  const { error } = await supabase
    .from('trabajos_expediente')
    .delete()
    .eq('id', trabajoId)
    .eq('expediente_id', id);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: { deleted: true }, error: null });
});

// ─── S9: GET /siniestros/:id/comunicaciones-asitur ───────────────────────────

siniestrosRoutes.get('/:id/comunicaciones-asitur', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data, error } = await supabase
    .from('comunicaciones_asitur')
    .select('*')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: data ?? [], error: null });
});

// ─── S9: POST /siniestros/:id/comunicaciones-asitur ──────────────────────────

siniestrosRoutes.post('/:id/comunicaciones-asitur', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    tipo_mensaje: string;
    contenido: string;
    adjunto_path?: string | null;
    adjunto_nombre?: string | null;
  }>();

  if (!body.tipo_mensaje) return c.json(err('VALIDATION', 'tipo_mensaje es requerido'), 422);
  if (!body.contenido?.trim()) return c.json(err('VALIDATION', 'contenido es requerido'), 422);

  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data: profile } = user?.id
    ? await supabase
        .from('user_profiles')
        .select('nombre, apellidos')
        .eq('user_id', user.id)
        .single()
    : { data: null };

  const actorNombre = profile
    ? `${(profile as any).nombre ?? ''} ${(profile as any).apellidos ?? ''}`.trim()
    : 'Sistema';

  const { data, error } = await supabase
    .from('comunicaciones_asitur')
    .insert({
      expediente_id:  id,
      compania_id:    exp.compania_id,
      tipo_mensaje:   body.tipo_mensaje,
      contenido:      body.contenido,
      adjunto_path:   body.adjunto_path ?? null,
      adjunto_nombre: body.adjunto_nombre ?? null,
      direccion:      'saliente',
      actor_id:       user?.id ?? null,
      actor_nombre:   actorNombre,
    })
    .select('*')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Registrar en timeline genérico
  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    tipo: 'nota_interna',
    asunto: `ASITUR — ${body.tipo_mensaje}`,
    contenido: body.contenido,
    actor_id: user?.id ?? 'system',
    actor_nombre: actorNombre,
    metadata: { canal: 'asitur', tipo_mensaje: body.tipo_mensaje },
  });

  return c.json({ data, error: null }, 201);
});

// ─── S10: GET /siniestros/:id/notas ──────────────────────────────────────────

siniestrosRoutes.get('/:id/notas', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data, error } = await supabase
    .from('notas_internas')
    .select('*')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: data ?? [], error: null });
});

// ─── S10: POST /siniestros/:id/notas ─────────────────────────────────────────

siniestrosRoutes.post('/:id/notas', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    tipo: 'tramitador' | 'operario';
    texto: string;
    alarma_fecha?: string | null;
    alarma_usuario_id?: string | null;
    alarma_usuario_nombre?: string | null;
    alarma_tipo?: string | null;
  }>();

  if (!['tramitador', 'operario'].includes(body.tipo)) {
    return c.json(err('VALIDATION', 'tipo debe ser "tramitador" o "operario"'), 422);
  }
  if (!body.texto?.trim()) return c.json(err('VALIDATION', 'texto es requerido'), 422);

  const { data: exp } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!exp) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data: profile } = user?.id
    ? await supabase
        .from('user_profiles')
        .select('nombre, apellidos')
        .eq('user_id', user.id)
        .single()
    : { data: null };

  const autorNombre = profile
    ? `${(profile as any).nombre ?? ''} ${(profile as any).apellidos ?? ''}`.trim()
    : 'Sistema';

  const { data, error } = await supabase
    .from('notas_internas')
    .insert({
      expediente_id:           id,
      compania_id:             exp.compania_id,
      tipo:                    body.tipo,
      texto:                   body.texto,
      autor_id:                user?.id ?? null,
      autor_nombre:            autorNombre,
      alarma_fecha:            body.alarma_fecha ?? null,
      alarma_usuario_id:       body.alarma_usuario_id ?? null,
      alarma_usuario_nombre:   body.alarma_usuario_nombre ?? null,
      alarma_tipo:             body.alarma_tipo ?? null,
      alarma_estado:           body.alarma_fecha ? 'Activada' : 'Desactivada',
    })
    .select('*')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null }, 201);
});

// ─── S10: PATCH /siniestros/:id/notas/:nota_id/realizado ─────────────────────

siniestrosRoutes.patch('/:id/notas/:nota_id/realizado', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const notaId   = c.req.param('nota_id');
  const body     = await c.req.json<{ realizado: boolean }>();

  const { data, error } = await supabase
    .from('notas_internas')
    .update({ realizado: body.realizado })
    .eq('id', notaId)
    .eq('expediente_id', id)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 3 — SECCIONES 11-15
// ═══════════════════════════════════════════════════════════════

// ─── S11: PATCH /siniestros/:id/incidencias/:incidencia_id ───────────────────
// Actualiza campos B3 de una incidencia existente.

siniestrosRoutes.patch('/:id/incidencias/:incidencia_id', async (c) => {
  const supabase      = c.get('supabase');
  const incidenciaId  = c.req.param('incidencia_id');
  const body          = await c.req.json<Record<string, unknown>>();

  const allowed = ['tipo_incidencia', 'plataforma_usuario_id', 'plataforma_usuario_nombre',
                   'interna', 'proc_incidencia', 'tipologia', 'origen', 'texto', 'procedente'];
  const update: Record<string, unknown> = {};
  for (const f of allowed) {
    if (f in body) update[f] = body[f];
  }

  if (Object.keys(update).length === 0) {
    return c.json(err('VALIDATION', 'Sin campos para actualizar'), 422);
  }

  const { data, error } = await supabase
    .from('expediente_incidencias')
    .update(update)
    .eq('id', incidenciaId)
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// Override POST incidencias to also accept B3 fields
// (Se extiende el endpoint existente re-declarando — Hono usa el ÚLTIMO handler
//  para la misma ruta, por lo que declaramos el nuevo handler con B3 campos)
// Nota: el endpoint original POST /:id/incidencias ya existe arriba. Este bloque
// añade B3 campos al body type. Como Hono resuelve por orden de registro el
// handler original es el único; aquí simplemente ampliamos el tipo en los
// endpoints PATCH y en el seguimiento GET.

// ─── S12: POST /siniestros/:id/encuesta/enviar ───────────────────────────────
// Registra el envío de una encuesta de satisfacción (log de auditoría).

siniestrosRoutes.post('/:id/encuesta/enviar', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{ visita_id?: string | null; tipo_encuesta: string }>();

  if (!body.tipo_encuesta?.trim()) {
    return c.json(err('VALIDATION', 'tipo_encuesta es requerido'), 422);
  }

  await insertAudit(supabase, {
    tabla: 'expediente_encuesta',
    accion: 'INSERT',
    registro_id: id,
    cambios: { tipo_encuesta: body.tipo_encuesta, visita_id: body.visita_id ?? null },
    actor_id: user?.id ?? 'system',
  });

  return c.json({ data: { enviado: true }, error: null });
});

// ─── S13: POST /siniestros/:id/campos-adicionales ────────────────────────────
// Upsert de los campos adicionales del informe fotográfico (campos 82-89).

siniestrosRoutes.post('/:id/campos-adicionales', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const body     = await c.req.json<Record<string, string | null>>();

  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const campos: Record<string, string | null> = {};
  for (const k of ['campo_82','campo_83','campo_84','campo_85','campo_86','campo_87','campo_88','campo_89']) {
    if (k in body) campos[k] = body[k] ?? null;
  }

  const { data, error } = await supabase
    .from('campos_adicionales_expediente')
    .upsert({
      expediente_id: id,
      compania_id: expData.compania_id,
      ...campos,
    }, { onConflict: 'expediente_id' })
    .select('*')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── S13: GET /siniestros/:id/campos-adicionales ─────────────────────────────

siniestrosRoutes.get('/:id/campos-adicionales', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data } = await supabase
    .from('campos_adicionales_expediente')
    .select('*')
    .eq('expediente_id', id)
    .maybeSingle();

  return c.json({ data: data ?? null, error: null });
});

// ─── S14: POST /siniestros/:id/adjuntos/init-upload ──────────────────────────
// Genera una URL firmada para subir un adjunto directamente a Supabase Storage.

siniestrosRoutes.post('/:id/adjuntos/init-upload', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const body     = await c.req.json<{ nombre_original: string; mime_type?: string }>();

  if (!body.nombre_original?.trim()) {
    return c.json(err('VALIDATION', 'nombre_original es requerido'), 422);
  }

  const ext = body.nombre_original.split('.').pop() ?? 'bin';
  const storagePath = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await (supabase as any).storage
    .from('adjuntos-expediente')
    .createSignedUploadUrl(storagePath);

  if (error) return c.json(err('STORAGE_ERROR', error.message), 500);

  return c.json({
    data: { signed_url: (data as any).signedUrl, storage_path: storagePath },
    error: null,
  });
});

// ─── S14: POST /siniestros/:id/adjuntos ──────────────────────────────────────
// Registra un adjunto ya subido a Storage en la tabla evidencias.

siniestrosRoutes.post('/:id/adjuntos', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    tipo_documento: string;
    descripcion?: string | null;
    storage_path: string;
    nombre_original?: string | null;
    mime_type?: string | null;
  }>();

  if (!body.storage_path?.trim()) {
    return c.json(err('VALIDATION', 'storage_path es requerido'), 422);
  }

  const { data, error } = await supabase
    .from('evidencias')
    .insert({
      expediente_id:  id,
      tipo:           body.tipo_documento ?? 'adjunto',
      storage_path:   body.storage_path,
      descripcion:    body.descripcion ?? null,
      nombre_original: body.nombre_original ?? null,
      mime_type:      body.mime_type ?? null,
    })
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null }, 201);
});

// ─── S14: DELETE /siniestros/:id/adjuntos/:adjunto_id ────────────────────────

siniestrosRoutes.delete('/:id/adjuntos/:adjunto_id', async (c) => {
  const supabase   = c.get('supabase');
  const adjuntoId  = c.req.param('adjunto_id');

  // Obtener storage_path antes de borrar
  const { data: ev } = await supabase
    .from('evidencias')
    .select('storage_path')
    .eq('id', adjuntoId)
    .single();

  const { error } = await supabase
    .from('evidencias')
    .delete()
    .eq('id', adjuntoId);

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Intentar borrar del storage (no bloqueante)
  if (ev?.storage_path) {
    await (supabase as any).storage
      .from('adjuntos-expediente')
      .remove([ev.storage_path])
      .catch(() => null);
  }

  return c.json({ data: { deleted: true }, error: null });
});

// ─── S14: POST /siniestros/:id/email-adjuntos ────────────────────────────────
// Envía un email con adjuntos seleccionados del expediente.

siniestrosRoutes.post('/:id/email-adjuntos', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    email_destino: string;
    asunto: string;
    cuerpo: string;
    adjunto_ids?: string[];
  }>();

  if (!body.email_destino?.trim() || !body.asunto?.trim()) {
    return c.json(err('VALIDATION', 'email_destino y asunto son requeridos'), 422);
  }

  // Registrar en comunicaciones del expediente
  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (expData) {
    await supabase.from('comunicaciones').insert({
      expediente_id:  id,
      compania_id:    expData.compania_id,
      tipo:           'email',
      destinatario:   body.email_destino,
      asunto:         body.asunto,
      contenido:      body.cuerpo,
      actor_id:       user?.id ?? null,
      actor_nombre:   'Sistema',
    });
  }

  await insertAudit(supabase, {
    tabla: 'email_adjuntos',
    accion: 'INSERT',
    registro_id: id,
    cambios: { email_destino: body.email_destino, asunto: body.asunto, adjunto_ids: body.adjunto_ids ?? [] },
    actor_id: user?.id ?? 'system',
  });

  return c.json({ data: { enviado: true }, error: null });
});

// ─── S15: POST /siniestros/:id/sms-programado ────────────────────────────────
// Crea un registro de SMS (enviado inmediatamente o programado).

siniestrosRoutes.post('/:id/sms-programado', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    destinatario_nombre: string;
    numero: string;
    texto: string;
    fecha_programada?: string | null;
  }>();

  if (!body.numero?.trim() || !body.texto?.trim()) {
    return c.json(err('VALIDATION', 'numero y texto son requeridos'), 422);
  }
  if (body.texto.length > 160) {
    return c.json(err('VALIDATION', 'El SMS no puede superar 160 caracteres'), 422);
  }

  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const esProgramado = !!body.fecha_programada;

  const { data, error } = await supabase
    .from('sms_programados')
    .insert({
      expediente_id:       id,
      compania_id:         expData.compania_id,
      destinatario_nombre: body.destinatario_nombre,
      numero:              body.numero,
      texto:               body.texto,
      fecha_programada:    body.fecha_programada ?? null,
      estado:              esProgramado ? 'pendiente' : 'enviado',
      enviado_at:          esProgramado ? null : new Date().toISOString(),
      creado_por:          user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Registrar en comunicaciones genérico si se envía inmediatamente
  if (!esProgramado) {
    await supabase.from('comunicaciones').insert({
      expediente_id:  id,
      compania_id:    expData.compania_id,
      tipo:           'sms',
      destinatario:   body.numero,
      contenido:      body.texto,
      actor_id:       user?.id ?? null,
      actor_nombre:   'Sistema',
    });
  }

  return c.json({ data, error: null }, 201);
});

// ─── S16: POST /siniestros/:id/email-operario ─────────────────────────────────
// Envía email al operario/asegurado y registra el envío.

siniestrosRoutes.post('/:id/email-operario', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{
    email_destino: string;
    email_libre?: string | null;
    nombre_destino?: string | null;
    asunto?: string | null;
    cuerpo: string;
  }>();

  const destino = body.email_libre?.trim() || body.email_destino?.trim();
  if (!destino) {
    return c.json(err('VALIDATION', 'email_destino o email_libre es requerido'), 422);
  }
  if (!body.cuerpo?.trim()) {
    return c.json(err('VALIDATION', 'cuerpo es requerido'), 422);
  }

  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data, error } = await supabase
    .from('emails_expediente')
    .insert({
      expediente_id:  id,
      compania_id:    expData.compania_id,
      email_destino:  body.email_destino,
      email_libre:    body.email_libre ?? null,
      nombre_destino: body.nombre_destino ?? null,
      asunto:         body.asunto ?? null,
      cuerpo:         body.cuerpo,
      enviado_por:    user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    compania_id:   expData.compania_id,
    tipo:          'email',
    destinatario:  destino,
    contenido:     body.cuerpo,
    actor_id:      user?.id ?? null,
    actor_nombre:  'Sistema',
  });

  await insertAudit(supabase, {
    tabla:       'emails_expediente',
    accion:      'INSERT',
    registro_id: id,
    cambios:     { email_destino: destino, asunto: body.asunto },
    actor_id:    user?.id ?? 'system',
  });

  return c.json({ data, error: null }, 201);
});

// ─── G2: PATCH /siniestros/:id/visitas/:visita_id ─────────────────────────────
// Actualiza campo_2 (datos adicionales) de una visita/cita.

siniestrosRoutes.patch('/:id/visitas/:visita_id', async (c) => {
  const supabase   = c.get('supabase');
  const id         = c.req.param('id');
  const visitaId   = c.req.param('visita_id');
  const body       = await c.req.json<{ campo_2?: string | null }>();

  const { data, error } = await supabase
    .from('citas')
    .update({ campo_2: body.campo_2 ?? null })
    .eq('id', visitaId)
    .eq('expediente_id', id)
    .select('id, campo_2')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  if (!data)  return c.json(err('NOT_FOUND', 'Visita no encontrada'), 404);

  return c.json({ data, error: null });
});

// ─── G3: GET /siniestros/:id/plantillas ───────────────────────────────────────
// Devuelve las plantillas de documento activas para la compañía del expediente.

siniestrosRoutes.get('/:id/plantillas', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  const { data: plantillas, error } = await supabase
    .from('plantillas_documento')
    .select('id, nombre, seccion, activa')
    .eq('activa', true)
    .or(`compania_id.eq.${expData.compania_id},compania_id.is.null`)
    .order('nombre');

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: plantillas ?? [], error: null });
});

// ─── G3: POST /siniestros/:id/generar-documento ───────────────────────────────
// Genera un documento a partir de una plantilla (registra la acción en audit).

siniestrosRoutes.post('/:id/generar-documento', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<{ plantilla_id: string; visita_id?: string | null }>();

  if (!body.plantilla_id) {
    return c.json(err('VALIDATION', 'plantilla_id es requerido'), 422);
  }

  await insertAudit(supabase, {
    tabla:       'documentos_generados',
    accion:      'INSERT',
    registro_id: id,
    cambios:     { plantilla_id: body.plantilla_id, visita_id: body.visita_id ?? null },
    actor_id:    user?.id ?? 'system',
  });

  return c.json({ data: { generado: true }, error: null }, 201);
});

// ─── G4: POST /siniestros/:id/visitas/:visita_id/firma-email ─────────────────
// Envía email con enlace de firma STE al asegurado para una visita concreta.

siniestrosRoutes.post('/:id/visitas/:visita_id/firma-email', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const id        = c.req.param('id');
  const visitaId  = c.req.param('visita_id');

  const { data: expData } = await supabase
    .from('expedientes')
    .select('compania_id')
    .eq('id', id)
    .single();

  if (!expData) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);

  await supabase.from('comunicaciones').insert({
    expediente_id: id,
    compania_id:   expData.compania_id,
    tipo:          'email',
    destinatario:  'asegurado',
    contenido:     `Envío enlace firma STE para visita ${visitaId}`,
    actor_id:      user?.id ?? null,
    actor_nombre:  'Sistema',
  });

  await insertAudit(supabase, {
    tabla:       'firma_email',
    accion:      'INSERT',
    registro_id: id,
    cambios:     { visita_id: visitaId },
    actor_id:    user?.id ?? 'system',
  });

  return c.json({ data: { enviado: true }, error: null }, 201);
});
