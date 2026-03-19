import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { sendFacturaEmail } from '../services/email-sender';
import { validate, validationError } from '../validation/schema';
import type { Env } from '../types';

export const facturasRoutes = new Hono<{ Bindings: Env }>();

// ─── Helper ────────────────────────────────────────────────────────────────
function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

function normalizeFacturaEstado(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const aliases: Record<string, string> = {
    borrador: 'borrador',
    emitida: 'emitida',
    enviada: 'enviada',
    cobrada: 'cobrada',
    anulada: 'anulada',
  };
  return aliases[normalized] ?? normalized;
}

function normalizeEstadoCobro(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const aliases: Record<string, string> = {
    pendiente: 'pendiente',
    vencida: 'vencida',
    reclamada: 'reclamada',
    cobrada: 'cobrada',
    incobrable: 'incobrable',
  };
  return aliases[normalized] ?? normalized;
}

function getEmpresaFacturadoraId(c: any) {
  return c.req.query('empresa_facturadora_id') ?? c.req.query('empresa_id');
}

function getSerieId(c: any) {
  return c.req.query('serie_id') ?? c.req.query('serie');
}

function mapFacturaListadoRow(row: Record<string, any>) {
  return {
    ...row,
    serie_nombre: row.serie_nombre ?? row.serie_codigo ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Static routes FIRST (before /:id)
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. GET /facturas/pendientes ────────────────────────────────────────────
facturasRoutes.get('/pendientes', async (c) => {
  const supabase = c.get('supabase');
  const compania_id = c.req.query('compania_id');
  const empresa_facturadora_id = getEmpresaFacturadoraId(c);
  const tipo_siniestro = c.req.query('tipo_siniestro');

  let query = supabase.from('v_pendientes_facturar').select('*');
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (empresa_facturadora_id) query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (tipo_siniestro) query = query.eq('tipo_siniestro', tipo_siniestro);

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── 2. GET /facturas/caducadas ─────────────────────────────────────────────
facturasRoutes.get('/caducadas', async (c) => {
  const supabase = c.get('supabase');
  const compania_id = c.req.query('compania_id');
  const empresa_facturadora_id = getEmpresaFacturadoraId(c);
  const serie_id = getSerieId(c);
  const dias_min = c.req.query('dias_min');

  let query = supabase.from('v_facturas_caducadas').select('*');
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (empresa_facturadora_id) query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (serie_id) query = query.eq('serie_id', serie_id);
  if (dias_min) query = query.gte('dias_vencida', Number(dias_min));

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── 10. GET /facturas/export ───────────────────────────────────────────────
facturasRoutes.get('/export', async (c) => {
  const supabase = c.get('supabase');
  const empresa_facturadora_id = getEmpresaFacturadoraId(c);
  const compania_id = c.req.query('compania_id');
  const serie_id = getSerieId(c);
  const estado = normalizeFacturaEstado(c.req.query('estado'));
  const estado_cobro = normalizeEstadoCobro(c.req.query('estado_cobro'));
  const fecha_desde = c.req.query('fecha_desde');
  const fecha_hasta = c.req.query('fecha_hasta');

  let query = supabase
    .from('facturas')
    .select('*, expedientes(numero_expediente), empresas_facturadoras(cif, nombre), companias(nombre), series_facturacion(codigo)')
    .order('fecha_emision', { ascending: false });

  if (empresa_facturadora_id) query = query.eq('empresa_facturadora_id', empresa_facturadora_id);
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (serie_id) query = query.eq('serie_id', serie_id);
  if (estado) query = query.eq('estado', estado);
  if (estado_cobro) query = query.eq('estado_cobro', estado_cobro);
  if (fecha_desde) query = query.gte('fecha_emision', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha_emision', fecha_hasta);

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  const headers = [
    'serie', 'numero_factura', 'fecha_emision', 'fecha_vencimiento',
    'empresa_cif', 'empresa_nombre', 'compania_nombre',
    'base_imponible', 'iva_porcentaje', 'iva_importe', 'total',
    'estado', 'estado_cobro', 'fecha_cobro', 'expediente_numero',
  ];

  const escCsv = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = (data ?? []).map((f: Record<string, any>) =>
    [
      f.series_facturacion?.codigo ?? '',
      f.numero_factura,
      f.fecha_emision,
      f.fecha_vencimiento,
      f.empresas_facturadoras?.cif ?? '',
      f.empresas_facturadoras?.nombre ?? '',
      f.companias?.nombre ?? '',
      f.base_imponible,
      f.iva_porcentaje,
      f.iva_importe,
      f.total,
      f.estado,
      f.estado_cobro,
      f.cobrada_at ?? '',
      f.expedientes?.numero_expediente ?? '',
    ].map(escCsv).join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="facturas_export.csv"',
    },
  });
});

// ─── 11. GET /facturas/series ───────────────────────────────────────────────
facturasRoutes.get('/series', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');

  let query = supabase.from('series_facturacion').select('*').order('codigo');
  if (activa !== undefined) query = query.eq('activa', activa === 'true');

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ─── 12. POST /facturas/series ──────────────────────────────────────────────
facturasRoutes.post('/series', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    codigo: string;
    nombre: string;
    prefijo: string;
    empresa_facturadora_id: string;
    tipo?: string;
  }>();

  if (!body.codigo || !body.nombre || !body.prefijo || !body.empresa_facturadora_id) {
    return c.json(err('VALIDATION', 'codigo, nombre, prefijo y empresa_facturadora_id requeridos'), 422);
  }

  const { data, error } = await supabase
    .from('series_facturacion')
    .insert({
      codigo: body.codigo,
      nombre: body.nombre,
      prefijo: body.prefijo,
      empresa_facturadora_id: body.empresa_facturadora_id,
      tipo: body.tipo ?? null,
      activa: true,
      contador_actual: 0,
    })
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'series_facturacion',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { codigo: body.codigo, nombre: body.nombre, prefijo: body.prefijo },
  });

  return c.json({ data, error: null }, 201);
});

// ─── 5. POST /facturas/emitir ───────────────────────────────────────────────
facturasRoutes.post('/emitir', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    expediente_id: string;
    serie_id: string;
    presupuesto_id?: string;
    forma_pago?: string;
    cuenta_bancaria?: string;
    notas?: string;
    iva_porcentaje?: number;
  }>();

  const fCheck = validate(body, {
    expediente_id:  { required: true, isUuid: true },
    serie_id:       { required: true, isUuid: true },
    presupuesto_id: { isUuid: true },
    forma_pago:     { maxLength: 60 },
    iva_porcentaje: { isNumber: true, isPositive: true },
    notas:          { maxLength: 1000 },
  });
  if (!fCheck.ok) return validationError(c, fCheck.errors);

  // V1: Expediente must be FINALIZADO
  const { data: expediente } = await supabase
    .from('expedientes')
    .select('id, estado, compania_id, empresa_facturadora_id')
    .eq('id', body.expediente_id)
    .single();

  if (!expediente) return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
  if (expediente.estado !== 'FINALIZADO') {
    return c.json(err('EXP_NO_FINALIZADO', 'El expediente debe estar en estado FINALIZADO'), 422);
  }

  // V2: Find approved presupuesto
  let presupuestoQuery = supabase
    .from('presupuestos')
    .select('id, importe_total, expediente_id')
    .eq('expediente_id', body.expediente_id)
    .eq('aprobado', true);

  if (body.presupuesto_id) {
    presupuestoQuery = presupuestoQuery.eq('id', body.presupuesto_id);
  }

  const { data: presupuesto } = await presupuestoQuery.order('created_at', { ascending: true }).limit(1).single();
  if (!presupuesto) {
    return c.json(err('SIN_PRESUPUESTO_APROBADO', 'No existe presupuesto aprobado para este expediente'), 422);
  }

  // V3: Presupuesto must have at least 1 linea
  const { count: lineasCount } = await supabase
    .from('lineas_presupuesto')
    .select('id', { count: 'exact', head: true })
    .eq('presupuesto_id', presupuesto.id);

  if (!lineasCount || lineasCount === 0) {
    return c.json(err('SIN_LINEAS', 'El presupuesto no tiene líneas'), 422);
  }

  // V4: Empresa facturadora must have CIF
  const { data: empresa } = await supabase
    .from('empresas_facturadoras')
    .select('id, nombre, cif')
    .eq('id', expediente.empresa_facturadora_id)
    .single();

  if (!empresa || !empresa.cif) {
    return c.json(err('EMPRESA_SIN_CIF', 'La empresa facturadora no tiene CIF configurado'), 422);
  }

  // V5: Serie must exist and be activa
  const { data: serie } = await supabase
    .from('series_facturacion')
    .select('id, prefijo, contador_actual, activa')
    .eq('id', body.serie_id)
    .single();

  if (!serie) return c.json(err('SERIE_NO_ENCONTRADA', 'Serie de facturación no encontrada'), 422);
  if (!serie.activa) return c.json(err('SERIE_INACTIVA', 'La serie de facturación no está activa'), 422);

  // V6: No existing non-anulada factura for expediente+serie
  const { count: existingCount } = await supabase
    .from('facturas')
    .select('id', { count: 'exact', head: true })
    .eq('expediente_id', body.expediente_id)
    .eq('serie_id', body.serie_id)
    .neq('estado', 'anulada');

  if (existingCount && existingCount > 0) {
    return c.json(err('FACTURA_DUPLICADA', 'Ya existe una factura no anulada para este expediente y serie'), 422);
  }

  // 1. Increment serie.contador_actual atomically
  const nuevoContador = (serie.contador_actual ?? 0) + 1;
  const { error: serieErr } = await supabase
    .from('series_facturacion')
    .update({ contador_actual: nuevoContador })
    .eq('id', serie.id)
    .eq('contador_actual', serie.contador_actual); // optimistic lock

  if (serieErr) return c.json(err('DB_ERROR', serieErr.message), 500);

  // 2. Generate numero_factura
  const year = new Date().getFullYear();
  const numero_factura = `${serie.prefijo}${year}-${String(nuevoContador).padStart(5, '0')}`;

  // 3. Calculate amounts
  const iva_porcentaje = body.iva_porcentaje ?? 21;
  const base_imponible = presupuesto.importe_total ?? 0;
  const iva_importe = Math.round(base_imponible * iva_porcentaje) / 100;
  const total = Math.round((base_imponible + iva_importe) * 100) / 100;

  // 4. Determine fecha_vencimiento
  const { data: compania } = await supabase
    .from('companias')
    .select('id, nombre, config')
    .eq('id', expediente.compania_id)
    .single();

  const diasVencimiento =
    (compania?.config as any)?.facturacion?.dias_vencimiento ?? 30;

  const now = new Date();
  const fechaVencimiento = new Date(now);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencimiento);

  // 5. Insert factura
  const { data: factura, error: facturaErr } = await supabase
    .from('facturas')
    .insert({
      expediente_id: body.expediente_id,
      presupuesto_id: presupuesto.id,
      serie_id: body.serie_id,
      empresa_facturadora_id: expediente.empresa_facturadora_id,
      compania_id: expediente.compania_id,
      numero_factura,
      fecha_emision: now.toISOString().slice(0, 10),
      fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10),
      base_imponible,
      iva_porcentaje,
      iva_importe,
      total,
      estado: 'emitida',
      estado_cobro: 'pendiente',
      forma_pago: body.forma_pago ?? null,
      cuenta_bancaria: body.cuenta_bancaria ?? null,
      notas: body.notas ?? null,
      emitida_por: user.id,
    })
    .select()
    .single();

  if (facturaErr) return c.json(err('DB_ERROR', facturaErr.message), 500);

  // 6. Copy lineas_presupuesto -> lineas_factura
  const { data: lineasPres } = await supabase
    .from('lineas_presupuesto')
    .select('*')
    .eq('presupuesto_id', presupuesto.id);

  if (lineasPres && lineasPres.length > 0) {
    const lineasFactura = lineasPres.map((l: Record<string, any>) => ({
      factura_id: factura.id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      descuento_porcentaje: l.descuento_porcentaje ?? 0,
      importe: l.importe,
      partida_baremo_id: l.partida_baremo_id ?? null,
    }));

    await supabase.from('lineas_factura').insert(lineasFactura);
  }

  // 7. Audit + domain event
  // 8. Timeline entry
  await Promise.all([
    insertAudit(supabase, {
      tabla: 'facturas',
      registro_id: factura.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: { numero_factura, total, expediente_id: body.expediente_id, serie_id: body.serie_id },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: factura.id,
      aggregate_type: 'factura',
      event_type: 'FacturaEmitida',
      payload: { numero_factura, total, expediente_id: body.expediente_id, presupuesto_id: presupuesto.id },
      actor_id: user.id,
    }),
    supabase.from('comunicaciones').insert({
      expediente_id: body.expediente_id,
      tipo: 'sistema',
      asunto: 'Factura emitida',
      contenido: `Factura ${numero_factura} emitida por ${total} EUR`,
      actor_id: user.id,
    }),
  ]);

  // 9. Return factura
  return c.json({ data: factura, error: null }, 201);
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── 3. GET /facturas (paginated list) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
facturasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const expediente_id = c.req.query('expediente_id');
  const compania_id = c.req.query('compania_id');
  const estado = normalizeFacturaEstado(c.req.query('estado'));
  const estado_cobro = normalizeEstadoCobro(c.req.query('estado_cobro'));
  const serie_id = getSerieId(c);

  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const per_page = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;

  let query = supabase
    .from('v_facturas_listado')
    .select('*', { count: 'exact' });

  if (expediente_id) query = query.eq('expediente_id', expediente_id);
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (estado) query = query.eq('estado', estado);
  if (estado_cobro) query = query.eq('estado_cobro', estado_cobro);
  if (serie_id) query = query.eq('serie_id', serie_id);

  const { data, error, count } = await query.range(from, to);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({
    data: (data ?? []).map((row: Record<string, any>) => mapFacturaListadoRow(row)),
    error: null,
    pagination: { page, per_page, total: count ?? 0 },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── 4. GET /facturas/:id ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
facturasRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('facturas')
    .select('*, lineas_factura(*), pagos(*), seguimiento_cobro(*), expedientes(numero_expediente), companias(nombre), empresas_facturadoras(nombre, cif), series_facturacion(codigo, nombre)')
    .eq('id', id)
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);
  return c.json({ data, error: null });
});

// ─── 6. POST /facturas/:id/enviar ───────────────────────────────────────────
facturasRoutes.post('/:id/enviar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ canal?: string }>();

  // 1. Fetch factura
  const { data: factura } = await supabase
    .from('facturas')
    .select('*, companias(nombre, config), empresas_facturadoras(nombre, email), expedientes(numero_expediente)')
    .eq('id', id)
    .single();

  if (!factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);
  if (factura.estado !== 'emitida' && factura.estado !== 'enviada') {
    return c.json(err('ESTADO_INVALIDO', 'La factura debe estar emitida o enviada para poder enviarla'), 422);
  }

  // 2. Determine canal
  const canal = body.canal
    ?? (factura.companias as any)?.config?.facturacion?.canal_envio
    ?? 'email';

  // 3-4. Set envio fields
  let envio_resultado = canal === 'email' ? 'ok' : 'pendiente_integracion';
  let envio_error: string | null = null;
  const now = new Date().toISOString();

  if (canal === 'email') {
    const companiaConfig = (factura.companias as any)?.config ?? {};
    const companiaEmail = companiaConfig?.facturacion?.email ?? companiaConfig?.email ?? null;

    if (!companiaEmail) {
      return c.json(err('COMPANIA_SIN_EMAIL', 'La compañía no tiene email de facturación configurado'), 422);
    }

    const result = await sendFacturaEmail(
      supabase,
      c.env.RESEND_API_KEY,
      {
        id: factura.id,
        numero_factura: factura.numero_factura,
        total: factura.total,
        compania_email: companiaEmail,
        compania_nombre: (factura.companias as any)?.nombre ?? 'Cliente',
        empresa_nombre: (factura.empresas_facturadoras as any)?.nombre ?? 'ERP Siniestros',
        expediente_numero: (factura.expedientes as any)?.numero_expediente ?? factura.expediente_id,
      },
      user.id,
    );

    envio_resultado = result.success ? (result.dryRun ? 'dry_run' : 'ok') : 'error';
    envio_error = result.error ?? null;
  }

  // 5-6. Update
  const updatePayload: Record<string, unknown> = {
    canal_envio: canal,
    enviada_at: now,
    enviada_por: user.id,
    envio_resultado,
    envio_error,
    envio_intentos: (factura.envio_intentos ?? 0) + 1,
  };
  if (factura.estado === 'emitida') {
    updatePayload.estado = 'enviada';
  }

  const { data: updated, error } = await supabase
    .from('facturas')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // 7. Audit
  await insertAudit(supabase, {
    tabla: 'facturas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: updatePayload,
  });

  return c.json({ data: updated, error: null });
});

// ─── 7. POST /facturas/:id/registrar-cobro ──────────────────────────────────
facturasRoutes.post('/:id/registrar-cobro', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    fecha_pago: string;
    importe: number;
    metodo: string;
    referencia?: string;
    notas?: string;
  }>();

  // Validations
  const { data: factura } = await supabase
    .from('facturas')
    .select('id, expediente_id, estado, estado_cobro, total, numero_factura')
    .eq('id', id)
    .single();

  if (!factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);
  if (factura.estado === 'anulada') return c.json(err('FACTURA_ANULADA', 'No se puede registrar cobro en factura anulada'), 422);
  if (!body.importe || body.importe <= 0) return c.json(err('IMPORTE_INVALIDO', 'El importe debe ser mayor que 0'), 422);

  // 1. Insert pago
  const { data: pago, error: pagoErr } = await supabase
    .from('pagos')
    .insert({
      factura_id: id,
      fecha_pago: body.fecha_pago,
      importe: body.importe,
      metodo: body.metodo,
      referencia: body.referencia ?? null,
      notas: body.notas ?? null,
      actor_id: user.id,
    })
    .select()
    .single();

  if (pagoErr) return c.json(err('DB_ERROR', pagoErr.message), 500);

  // 2. Calculate total_cobrado
  const { data: pagos } = await supabase
    .from('pagos')
    .select('importe')
    .eq('factura_id', id);

  const total_cobrado = (pagos ?? []).reduce((sum: number, p: any) => sum + (p.importe ?? 0), 0);

  // 3-4. Update estado if fully paid
  const facturaUpdate: Record<string, unknown> = {};
  if (total_cobrado >= factura.total) {
    facturaUpdate.estado_cobro = 'cobrada';
    facturaUpdate.cobrada_at = new Date().toISOString();
    facturaUpdate.estado = 'cobrada';
  }

  if (Object.keys(facturaUpdate).length > 0) {
    await supabase.from('facturas').update(facturaUpdate).eq('id', id);
  }

  // 5-6. Audit + domain event + timeline
  await Promise.all([
    insertAudit(supabase, {
      tabla: 'pagos',
      registro_id: pago.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: { factura_id: id, importe: body.importe, metodo: body.metodo, total_cobrado },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: id,
      aggregate_type: 'factura',
      event_type: 'PagoRegistrado',
      payload: { pago_id: pago.id, importe: body.importe, total_cobrado, cobrada: total_cobrado >= factura.total },
      actor_id: user.id,
    }),
    supabase.from('comunicaciones').insert({
      expediente_id: factura.expediente_id,
      tipo: 'sistema',
      asunto: 'Pago registrado',
      contenido: `Pago de ${body.importe} EUR registrado en factura ${factura.numero_factura}. Total cobrado: ${total_cobrado} EUR`,
      actor_id: user.id,
    }),
  ]);

  // 7. Return
  return c.json({
    data: {
      pago,
      factura_estado: total_cobrado >= factura.total ? 'cobrada' : factura.estado,
      factura_estado_cobro: total_cobrado >= factura.total ? 'cobrada' : factura.estado_cobro,
      total_cobrado,
    },
    error: null,
  }, 201);
});

// ─── 8. POST /facturas/:id/reclamar ────────────────────────────────────────
facturasRoutes.post('/:id/reclamar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ contenido: string; proximo_contacto?: string }>();

  if (!body.contenido) return c.json(err('VALIDATION', 'contenido es requerido'), 422);

  const { data: factura } = await supabase
    .from('facturas')
    .select('id, estado_cobro')
    .eq('id', id)
    .single();

  if (!factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);

  // 1. Insert seguimiento_cobro
  const { data: seguimiento, error: segErr } = await supabase
    .from('seguimiento_cobro')
    .insert({
      factura_id: id,
      contenido: body.contenido,
      proximo_contacto: body.proximo_contacto ?? null,
      actor_id: user.id,
    })
    .select()
    .single();

  if (segErr) return c.json(err('DB_ERROR', segErr.message), 500);

  // 2. Update estado_cobro if vencida or pendiente
  if (factura.estado_cobro === 'vencida' || factura.estado_cobro === 'pendiente') {
    await supabase.from('facturas').update({ estado_cobro: 'reclamada' }).eq('id', id);
  }

  // 3. Audit
  await insertAudit(supabase, {
    tabla: 'seguimiento_cobro',
    registro_id: seguimiento.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { factura_id: id, contenido: body.contenido },
  });

  return c.json({ data: seguimiento, error: null }, 201);
});

// ─── 9. POST /facturas/:id/anular ──────────────────────────────────────────
facturasRoutes.post('/:id/anular', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ motivo: string }>();

  if (!body.motivo) return c.json(err('VALIDATION', 'motivo es requerido'), 422);

  const { data: factura } = await supabase
    .from('facturas')
    .select('id, expediente_id, estado, estado_cobro, numero_factura')
    .eq('id', id)
    .single();

  if (!factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);
  if (factura.estado_cobro === 'cobrada') {
    return c.json(err('FACTURA_COBRADA', 'No se puede anular una factura cobrada'), 422);
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('facturas')
    .update({
      estado: 'anulada',
      anulada_at: now,
      anulada_por: user.id,
      anulada_motivo: body.motivo,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'facturas',
      registro_id: id,
      accion: 'UPDATE',
      actor_id: user.id,
      cambios: { estado: 'anulada', anulada_motivo: body.motivo },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: id,
      aggregate_type: 'factura',
      event_type: 'FacturaAnulada',
      payload: { motivo: body.motivo, numero_factura: factura.numero_factura },
      actor_id: user.id,
    }),
    supabase.from('comunicaciones').insert({
      expediente_id: factura.expediente_id,
      tipo: 'sistema',
      asunto: 'Factura anulada',
      contenido: `Factura ${factura.numero_factura} anulada. Motivo: ${body.motivo}`,
      actor_id: user.id,
    }),
  ]);

  return c.json({ data: updated, error: null });
});
