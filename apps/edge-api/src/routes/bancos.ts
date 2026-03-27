import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { validate, validationError } from '../validation/schema';
import type { Env } from '../types';

export const bancosRoutes = new Hono<{ Bindings: Env }>();

// ─── Helper ─────────────────────────────────────────────────────────────────
function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

// ─── Validación IBAN (mod-97, RFC 3166 country code) ────────────────────────
function validarIBAN(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged
    .split('')
    .map((c) => (isNaN(Number(c)) ? (c.charCodeAt(0) - 55).toString() : c))
    .join('');
  let remainder = 0n;
  for (const ch of numeric) {
    remainder = (remainder * 10n + BigInt(parseInt(ch))) % 97n;
  }
  return remainder === 1n;
}

// ─── Fecha de vencimiento con perfil de cobro ────────────────────────────────
function calcFechaVencimiento(
  emisionDate: Date,
  diasPago: number,
  diaFijoMes: number | null,
): Date {
  const base = new Date(emisionDate);
  base.setDate(base.getDate() + diasPago);
  if (!diaFijoMes) return base;
  // Siguiente ocurrencia del día fijo tras la fecha base
  const result = new Date(base);
  result.setDate(diaFijoMes);
  if (result <= base) result.setMonth(result.getMonth() + 1);
  return result;
}

// ─── Motor de conciliación ───────────────────────────────────────────────────
interface Sugerencia {
  movimiento_id: string;
  referencia_cobro_id: string;
  referencia: string;
  importe_movimiento: number;
  importe_referencia: number;
  score: number;
  tipo_match: string;
}

function calcularSugerencias(
  movimientos: any[],
  referencias: any[],
  toleranciaEur = 0,
): Sugerencia[] {
  const sugerencias: Sugerencia[] = [];

  for (const mov of movimientos) {
    if (mov.importe <= 0) continue; // solo ingresos

    for (const ref of referencias) {
      let score = 0;
      let tipo_match = '';
      const diff = Math.abs(mov.importe - ref.importe);
      const movMs = new Date(mov.fecha_operacion).getTime();
      const refMs = new Date(ref.fecha_vencimiento).getTime();
      const daysDiff = Math.abs((movMs - refMs) / 86_400_000);

      // Match 1: referencia exacta en el concepto bancario
      if (
        mov.concepto_banco.toUpperCase().includes(ref.referencia.toUpperCase())
      ) {
        score = 100;
        tipo_match = 'referencia_exacta';
      }
      // Match 2: importe exacto + proximidad de fecha
      else if (diff === 0) {
        score =
          daysDiff <= 3 ? 90 :
          daysDiff <= 7 ? 80 :
          daysDiff <= 14 ? 70 : 60;
        tipo_match = 'importe_exacto';
      }
      // Match 3: importe dentro de tolerancia
      else if (diff <= toleranciaEur && toleranciaEur > 0) {
        score = daysDiff <= 7 ? 65 : 50;
        tipo_match = 'importe_tolerancia';
      }

      if (score > 0) {
        sugerencias.push({
          movimiento_id: mov.id,
          referencia_cobro_id: ref.id,
          referencia: ref.referencia,
          importe_movimiento: mov.importe,
          importe_referencia: ref.importe,
          score,
          tipo_match,
        });
      }
    }
  }

  return sugerencias.sort((a, b) => b.score - a.score);
}

// ─── Parser CSV para extractos bancarios ─────────────────────────────────────
// Formato esperado (cabecera obligatoria):
// fecha_operacion,fecha_valor,concepto,importe,referencia_banco
function parseCSVExtracto(text: string): {
  rows: Record<string, string>[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    errors.push('El fichero debe tener al menos una línea de cabecera y un movimiento');
    return { rows: [], errors };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) =>
    h.replace(/^"|"$/g, '').toLowerCase().trim(),
  );

  const required = ['fecha_operacion', 'concepto', 'importe'];
  for (const req of required) {
    if (!headers.includes(req)) {
      errors.push(`Columna requerida ausente: ${req}`);
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').replace(/^"|"$/g, '').trim();
    });
    // Normalizar importe (coma → punto)
    row['importe'] = row['importe'].replace(',', '.');
    rows.push(row);
  }

  return { rows, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// CUENTAS BANCARIAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/cuentas
bancosRoutes.get('/cuentas', async (c) => {
  const supabase = c.get('supabase');
  const empresa_id = c.req.query('empresa_id');
  const activa = c.req.query('activa');

  let query = supabase
    .from('cuentas_bancarias')
    .select('*, empresas_facturadoras(nombre, cif)')
    .order('es_principal', { ascending: false })
    .order('created_at', { ascending: true });

  if (empresa_id) query = query.eq('empresa_id', empresa_id);
  if (activa !== undefined) query = query.eq('activa', activa === 'true');

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// POST /bancos/cuentas
bancosRoutes.post('/cuentas', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    empresa_id: string;
    alias: string;
    entidad: string;
    iban: string;
    bic_swift?: string;
    moneda?: string;
    es_principal?: boolean;
  }>();

  const check = validate(body, {
    empresa_id: { required: true, isUuid: true },
    alias:      { required: true, maxLength: 100 },
    entidad:    { required: true, maxLength: 100 },
    iban:       { required: true, maxLength: 34 },
    bic_swift:  { maxLength: 11 },
    moneda:     { maxLength: 3 },
  });
  if (!check.ok) return validationError(c, check.errors);

  const ibanClean = body.iban.replace(/\s+/g, '').toUpperCase();
  if (!validarIBAN(ibanClean)) {
    return c.json(err('IBAN_INVALIDO', 'El IBAN no supera la validación mod-97'), 422);
  }

  // Si se marca como principal, desmarcar las demás
  if (body.es_principal) {
    await supabase
      .from('cuentas_bancarias')
      .update({ es_principal: false })
      .eq('empresa_id', body.empresa_id)
      .eq('es_principal', true);
  }

  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .insert({
      empresa_id:   body.empresa_id,
      alias:        body.alias,
      entidad:      body.entidad,
      iban:         ibanClean,
      bic_swift:    body.bic_swift ?? null,
      moneda:       body.moneda ?? 'EUR',
      es_principal: body.es_principal ?? false,
      activa:       true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json(err('IBAN_DUPLICADO', 'Este IBAN ya está registrado para esta empresa'), 409);
    }
    return c.json(err('DB_ERROR', error.message), 500);
  }

  await insertAudit(supabase, {
    tabla: 'cuentas_bancarias',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { empresa_id: body.empresa_id, alias: body.alias, iban: ibanClean },
  });

  return c.json({ data, error: null }, 201);
});

// GET /bancos/cuentas/:id
bancosRoutes.get('/cuentas/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .select('*, empresas_facturadoras(nombre, cif)')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Cuenta bancaria no encontrada'), 404);
  return c.json({ data, error: null });
});

// PUT /bancos/cuentas/:id
bancosRoutes.put('/cuentas/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    alias?: string;
    entidad?: string;
    bic_swift?: string;
    activa?: boolean;
  }>();

  const check = validate(body, {
    alias:    { maxLength: 100 },
    entidad:  { maxLength: 100 },
    bic_swift:{ maxLength: 11 },
  });
  if (!check.ok) return validationError(c, check.errors);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.alias   !== undefined) update.alias    = body.alias;
  if (body.entidad !== undefined) update.entidad  = body.entidad;
  if (body.bic_swift !== undefined) update.bic_swift = body.bic_swift;
  if (body.activa  !== undefined) update.activa   = body.activa;

  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Cuenta bancaria no encontrada'), 404);

  await insertAudit(supabase, {
    tabla: 'cuentas_bancarias',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: update,
  });

  return c.json({ data, error: null });
});

// POST /bancos/cuentas/:id/principal — marcar como cuenta principal
bancosRoutes.post('/cuentas/:id/principal', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data: cuenta } = await supabase
    .from('cuentas_bancarias')
    .select('id, empresa_id, activa')
    .eq('id', id)
    .single();

  if (!cuenta) return c.json(err('NOT_FOUND', 'Cuenta bancaria no encontrada'), 404);
  if (!cuenta.activa) return c.json(err('CUENTA_INACTIVA', 'No se puede marcar como principal una cuenta inactiva'), 422);

  await supabase
    .from('cuentas_bancarias')
    .update({ es_principal: false, updated_at: new Date().toISOString() })
    .eq('empresa_id', cuenta.empresa_id);

  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .update({ es_principal: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'cuentas_bancarias',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { es_principal: true },
  });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// PERFILES DE COBRO
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/perfiles
bancosRoutes.get('/perfiles', async (c) => {
  const supabase = c.get('supabase');
  const empresa_id  = c.req.query('empresa_id');
  const compania_id = c.req.query('compania_id');
  const activo      = c.req.query('activo');

  let query = supabase
    .from('perfiles_cobro')
    .select('*, companias(nombre), empresas_facturadoras(nombre), cuentas_bancarias(alias,iban,entidad)')
    .order('created_at', { ascending: false });

  if (empresa_id)  query = query.eq('empresa_id', empresa_id);
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (activo !== undefined) query = query.eq('activo', activo === 'true');

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// POST /bancos/perfiles
bancosRoutes.post('/perfiles', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    compania_id: string;
    empresa_id: string;
    cuenta_bancaria_id?: string;
    forma_pago?: string;
    dias_pago?: number;
    dia_fijo_mes?: number;
    descuento_pp_pct?: number;
    recargo_mora_pct?: number;
    referencia_mandato?: string;
  }>();

  const check = validate(body, {
    compania_id:       { required: true, isUuid: true },
    empresa_id:        { required: true, isUuid: true },
    cuenta_bancaria_id:{ isUuid: true },
    forma_pago:        { isEnum: ['transferencia','domiciliacion','cheque','confirming','otro'] },
    dias_pago:         { isNumber: true },
    referencia_mandato:{ maxLength: 35 },
  });
  if (!check.ok) return validationError(c, check.errors);

  const { data, error } = await supabase
    .from('perfiles_cobro')
    .upsert(
      {
        compania_id:        body.compania_id,
        empresa_id:         body.empresa_id,
        cuenta_bancaria_id: body.cuenta_bancaria_id ?? null,
        forma_pago:         body.forma_pago ?? 'transferencia',
        dias_pago:          body.dias_pago ?? 30,
        dia_fijo_mes:       body.dia_fijo_mes ?? null,
        descuento_pp_pct:   body.descuento_pp_pct ?? 0,
        recargo_mora_pct:   body.recargo_mora_pct ?? 0,
        referencia_mandato: body.referencia_mandato ?? null,
        activo:             true,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'compania_id,empresa_id' },
    )
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'perfiles_cobro',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { compania_id: body.compania_id, empresa_id: body.empresa_id, forma_pago: body.forma_pago },
  });

  return c.json({ data, error: null }, 201);
});

// PUT /bancos/perfiles/:id
bancosRoutes.put('/perfiles/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    cuenta_bancaria_id?: string;
    forma_pago?: string;
    dias_pago?: number;
    dia_fijo_mes?: number;
    descuento_pp_pct?: number;
    recargo_mora_pct?: number;
    referencia_mandato?: string;
    activo?: boolean;
  }>();

  const check = validate(body, {
    cuenta_bancaria_id: { isUuid: true },
    forma_pago: { isEnum: ['transferencia','domiciliacion','cheque','confirming','otro'] },
    referencia_mandato: { maxLength: 35 },
  });
  if (!check.ok) return validationError(c, check.errors);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: (keyof typeof body)[] = [
    'cuenta_bancaria_id','forma_pago','dias_pago','dia_fijo_mes',
    'descuento_pp_pct','recargo_mora_pct','referencia_mandato','activo',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  const { data, error } = await supabase
    .from('perfiles_cobro')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Perfil de cobro no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'perfiles_cobro',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: update,
  });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCIAS DE COBRO
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/referencias
bancosRoutes.get('/referencias', async (c) => {
  const supabase = c.get('supabase');
  const empresa_id  = c.req.query('empresa_id');
  const compania_id = c.req.query('compania_id');
  const estado      = c.req.query('estado');
  const factura_id  = c.req.query('factura_id');
  const desde       = c.req.query('vencimiento_desde');
  const hasta       = c.req.query('vencimiento_hasta');

  const page     = Math.max(1, Number(c.req.query('page')) || 1);
  const per_page = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 25));
  const from = (page - 1) * per_page;
  const to   = from + per_page - 1;

  let query = supabase
    .from('referencias_cobro')
    .select('*, facturas(numero_factura), companias(nombre), empresas_facturadoras(nombre)', { count: 'exact' })
    .order('fecha_vencimiento', { ascending: true });

  if (empresa_id)  query = query.eq('empresa_id', empresa_id);
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (factura_id)  query = query.eq('factura_id', factura_id);
  if (estado)      query = query.eq('estado', estado);
  if (desde)       query = query.gte('fecha_vencimiento', desde);
  if (hasta)       query = query.lte('fecha_vencimiento', hasta);

  const { data, error, count } = await query.range(from, to);
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null, pagination: { page, per_page, total: count ?? 0 } });
});

// GET /bancos/referencias/:id
bancosRoutes.get('/referencias/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('referencias_cobro')
    .select('*, facturas(numero_factura, total, estado, estado_cobro), companias(nombre), empresas_facturadoras(nombre), links_pago(*)')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Referencia de cobro no encontrada'), 404);
  return c.json({ data, error: null });
});

// POST /bancos/referencias/generar — generar referencia manualmente para una factura
bancosRoutes.post('/referencias/generar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    factura_id: string;
    concepto?: string;
    canal_cobro?: string;
  }>();

  const check = validate(body, {
    factura_id: { required: true, isUuid: true },
    canal_cobro: { maxLength: 30 },
    concepto:    { maxLength: 500 },
  });
  if (!check.ok) return validationError(c, check.errors);

  // Factura debe existir y no estar anulada
  const { data: factura } = await supabase
    .from('facturas')
    .select('id, numero_factura, total, estado, empresa_facturadora_id, compania_id, fecha_vencimiento, referencia_cobro_id, empresas_facturadoras(nombre)')
    .eq('id', body.factura_id)
    .single();

  if (!factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);
  if (factura.estado === 'anulada') return c.json(err('FACTURA_ANULADA', 'No se puede generar referencia para una factura anulada'), 422);
  if (factura.referencia_cobro_id) return c.json(err('REF_EXISTENTE', 'La factura ya tiene una referencia de cobro asignada'), 409);

  // Llamada atómica a la función PostgreSQL
  const { data: refData, error: rpcErr } = await supabase
    .rpc('fn_next_referencia_cobro', { p_empresa_id: factura.empresa_facturadora_id });

  if (rpcErr || !refData?.[0]) {
    return c.json(err('DB_ERROR', rpcErr?.message ?? 'Error generando referencia'), 500);
  }

  const { referencia } = refData[0];
  const empresaNombre = (factura.empresas_facturadoras as any)?.nombre ?? '';
  const concepto = body.concepto ?? `Factura ${factura.numero_factura} - ${empresaNombre}`;

  const { data: refCobro, error: refErr } = await supabase
    .from('referencias_cobro')
    .insert({
      factura_id:       body.factura_id,
      empresa_id:       factura.empresa_facturadora_id,
      compania_id:      factura.compania_id,
      referencia,
      concepto,
      importe:          factura.total,
      moneda:           'EUR',
      fecha_vencimiento: factura.fecha_vencimiento,
      canal_cobro:      body.canal_cobro ?? null,
      estado:           'pendiente',
    })
    .select()
    .single();

  if (refErr) return c.json(err('DB_ERROR', refErr.message), 500);

  // Vincular a la factura
  await supabase
    .from('facturas')
    .update({ referencia_cobro_id: refCobro.id })
    .eq('id', body.factura_id);

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'referencias_cobro',
      registro_id: refCobro.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: { referencia, factura_id: body.factura_id, importe: factura.total },
    }),
    insertDomainEvent(supabase, {
      aggregate_id:   body.factura_id,
      aggregate_type: 'factura',
      event_type:     'ReferenciaCobro Generada',
      payload:        { referencia, referencia_cobro_id: refCobro.id },
      actor_id:       user.id,
    }),
  ]);

  return c.json({ data: refCobro, error: null }, 201);
});

// POST /bancos/referencias/:id/anular
bancosRoutes.post('/referencias/:id/anular', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ motivo: string }>();

  if (!body.motivo) return c.json(err('VALIDATION', 'motivo es requerido'), 422);

  const { data: ref } = await supabase
    .from('referencias_cobro')
    .select('id, estado, referencia')
    .eq('id', id)
    .single();

  if (!ref) return c.json(err('NOT_FOUND', 'Referencia no encontrada'), 404);
  if (ref.estado === 'cobrada') return c.json(err('REF_COBRADA', 'No se puede anular una referencia cobrada'), 422);
  if (ref.estado === 'anulada') return c.json(err('REF_ANULADA', 'La referencia ya está anulada'), 409);

  const { data, error } = await supabase
    .from('referencias_cobro')
    .update({ estado: 'anulada' })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'referencias_cobro',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'anulada', motivo: body.motivo },
  });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOVIMIENTOS BANCARIOS
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/movimientos
bancosRoutes.get('/movimientos', async (c) => {
  const supabase = c.get('supabase');
  const cuenta_id    = c.req.query('cuenta_id');
  const estado_concil= c.req.query('estado_concil');
  const desde        = c.req.query('desde');
  const hasta        = c.req.query('hasta');

  const page     = Math.max(1, Number(c.req.query('page')) || 1);
  const per_page = Math.min(200, Math.max(1, Number(c.req.query('per_page')) || 50));
  const from = (page - 1) * per_page;
  const to   = from + per_page - 1;

  let query = supabase
    .from('movimientos_bancarios')
    .select('*, cuentas_bancarias(alias, entidad, empresa_id)', { count: 'exact' })
    .order('fecha_operacion', { ascending: false });

  if (cuenta_id)     query = query.eq('cuenta_id', cuenta_id);
  if (estado_concil) query = query.eq('estado_concil', estado_concil);
  if (desde)         query = query.gte('fecha_operacion', desde);
  if (hasta)         query = query.lte('fecha_operacion', hasta);

  const { data, error, count } = await query.range(from, to);
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null, pagination: { page, per_page, total: count ?? 0 } });
});

// GET /bancos/movimientos/sin-conciliar
bancosRoutes.get('/movimientos/sin-conciliar', async (c) => {
  const supabase = c.get('supabase');
  const empresa_id = c.req.query('empresa_id');
  const cuenta_id  = c.req.query('cuenta_id');

  let query = supabase.from('v_movimientos_sin_conciliar').select('*');
  if (empresa_id) query = query.eq('empresa_id', empresa_id);
  if (cuenta_id)  query = query.eq('cuenta_id', cuenta_id);

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// POST /bancos/movimientos — alta manual de un movimiento
bancosRoutes.post('/movimientos', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    cuenta_id: string;
    fecha_accion: string;
    fecha_valor: string;
    concepto_banco: string;
    importe: number;
    saldo?: number;
    referencia_banco?: string;
  }>();

  const check = validate(body, {
    cuenta_id:       { required: true, isUuid: true },
    fecha_accion: { required: true },
    fecha_valor:     { required: true },
    concepto_banco:  { required: true, maxLength: 500 },
    importe:         { required: true, isNumber: true },
  });
  if (!check.ok) return validationError(c, check.errors);

  const { data, error } = await supabase
    .from('movimientos_bancarios')
    .insert({
      cuenta_id:       body.cuenta_id,
      fecha_accion: body.fecha_accion,
      fecha_valor:     body.fecha_valor,
      concepto_banco:  body.concepto_banco,
      importe:         body.importe,
      saldo:           body.saldo ?? null,
      referencia_banco: body.referencia_banco ?? null,
      importado_via:   'manual',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return c.json(err('DUPLICADO', 'Movimiento duplicado (misma cuenta, fecha, importe y referencia)'), 409);
    return c.json(err('DB_ERROR', error.message), 500);
  }

  await insertAudit(supabase, {
    tabla: 'movimientos_bancarios',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { cuenta_id: body.cuenta_id, fecha_accion: body.fecha_accion, importe: body.importe },
  });

  return c.json({ data, error: null }, 201);
});

// POST /bancos/movimientos/importar — importar extracto CSV
bancosRoutes.post('/movimientos/importar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(err('VALIDATION', 'Se esperaba multipart/form-data con campos cuenta_id y fichero'), 422);
  }

  const cuentaId  = formData.get('cuenta_id') as string | null;
  const fichero   = formData.get('fichero') as File | null;

  if (!cuentaId) return c.json(err('VALIDATION', 'cuenta_id es requerido'), 422);
  if (!fichero)  return c.json(err('VALIDATION', 'fichero es requerido'), 422);

  // Verificar que la cuenta existe
  const { data: cuenta } = await supabase
    .from('cuentas_bancarias')
    .select('id, alias, empresa_id')
    .eq('id', cuentaId)
    .single();

  if (!cuenta) return c.json(err('NOT_FOUND', 'Cuenta bancaria no encontrada'), 404);

  const text = await fichero.text();
  const { rows, errors: parseErrors } = parseCSVExtracto(text);

  if (parseErrors.length > 0) {
    return c.json(err('CSV_INVALIDO', parseErrors.join('; ')), 422);
  }

  if (rows.length === 0) {
    return c.json(err('CSV_VACIO', 'El fichero no contiene movimientos'), 422);
  }

  let insertados = 0;
  let duplicados = 0;
  const errores: string[] = [];

  for (const row of rows) {
    const importe = parseFloat(row['importe']);
    if (isNaN(importe)) {
      errores.push(`Importe inválido en línea: ${JSON.stringify(row)}`);
      continue;
    }

    const { error: insErr } = await supabase
      .from('movimientos_bancarios')
      .insert({
        cuenta_id:       cuentaId,
        fecha_accion: row['fecha_operacion'],
        fecha_valor:     row['fecha_valor'] || row['fecha_operacion'],
        concepto_banco:  row['concepto'],
        importe,
        referencia_banco: row['referencia_banco'] || null,
        importado_via:   'csv',
        origen_raw:      row,
      });

    if (insErr) {
      if (insErr.code === '23505') {
        duplicados++;
      } else {
        errores.push(insErr.message);
      }
    } else {
      insertados++;
    }
  }

  // Ejecutar motor de conciliación sobre los movimientos recién importados
  // para la cuenta dada (solo los pendientes + referencias pendientes de la empresa)
  let sugerencias: Sugerencia[] = [];
  try {
    const [{ data: pendMovs }, { data: pendRefs }] = await Promise.all([
      supabase
        .from('movimientos_bancarios')
        .select('id, concepto_banco, importe, fecha_operacion')
        .eq('cuenta_id', cuentaId)
        .eq('estado_concil', 'pendiente'),
      supabase
        .from('referencias_cobro')
        .select('id, referencia, importe, fecha_vencimiento')
        .eq('empresa_id', cuenta.empresa_id)
        .in('estado', ['pendiente', 'enviada']),
    ]);

    // Tolerancia de las reglas de la empresa
    const { data: reglas } = await supabase
      .from('reglas_conciliacion')
      .select('tolerancia_eur, accion')
      .eq('empresa_id', cuenta.empresa_id)
      .eq('activa', true)
      .order('prioridad', { ascending: true });

    const tolerancia = (reglas ?? []).reduce((max: number, r: any) => Math.max(max, r.tolerancia_eur ?? 0), 0);
    sugerencias = calcularSugerencias(pendMovs ?? [], pendRefs ?? [], tolerancia);

    // Aplicar automáticamente las que tienen score 100 y regla = aplicar_automatico
    const autoRule = (reglas ?? []).find((r: any) => r.accion === 'aplicar_automatico');
    if (autoRule) {
      const autoApply = sugerencias.filter((s) => s.score === 100 && s.tipo_match === 'referencia_exacta');
      for (const s of autoApply) {
        await aplicarConciliacion(supabase, s, user.id, 'automatico');
      }
    }
  } catch (_e) {
    // El motor de conciliación falla silenciosamente; los movimientos ya están insertados
  }

  await insertAudit(supabase, {
    tabla: 'movimientos_bancarios',
    registro_id: cuentaId,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { cuenta_id: cuentaId, insertados, duplicados, total_csv: rows.length },
  });

  return c.json({
    data: {
      insertados,
      duplicados,
      errores: errores.length > 0 ? errores : undefined,
      sugerencias_generadas: sugerencias.length,
    },
    error: null,
  }, 201);
});

// ═══════════════════════════════════════════════════════════════════════════
// CONCILIACIÓN
// ═══════════════════════════════════════════════════════════════════════════

// Función interna reutilizable por importar y por el endpoint manual
async function aplicarConciliacion(
  supabase: any,
  s: { movimiento_id: string; referencia_cobro_id: string; importe_movimiento: number; importe_referencia: number },
  actor_id: string,
  tipo: 'automatico' | 'manual' | 'sugerido_aceptado',
) {
  const importe = Math.min(s.importe_movimiento, s.importe_referencia);

  // 1. Crear apunte de conciliación
  const { data: apunte, error: apErr } = await supabase
    .from('apuntes_conciliacion')
    .insert({
      movimiento_id:       s.movimiento_id,
      referencia_cobro_id: s.referencia_cobro_id,
      importe_aplicado:    importe,
      tipo,
      conciliado_by:       actor_id,
    })
    .select()
    .single();

  if (apErr) return { ok: false, error: apErr.message };

  // 2. Actualizar estado del movimiento
  await supabase
    .from('movimientos_bancarios')
    .update({ estado_concil: 'conciliado' })
    .eq('id', s.movimiento_id);

  // 3. Actualizar referencia_cobro → cobrada
  const { data: ref } = await supabase
    .from('referencias_cobro')
    .select('factura_id, importe')
    .eq('id', s.referencia_cobro_id)
    .single();

  await supabase
    .from('referencias_cobro')
    .update({ estado: 'cobrada', pagada_at: new Date().toISOString() })
    .eq('id', s.referencia_cobro_id);

  // 4. Si tiene factura vinculada, crear pago y actualizar factura
  if (ref?.factura_id) {
    const { data: pago } = await supabase
      .from('pagos')
      .insert({
        factura_id:           ref.factura_id,
        fecha_pago:           new Date().toISOString().slice(0, 10),
        importe,
        metodo:               'transferencia',
        referencia:           s.referencia_cobro_id,
        actor_id,
        movimiento_bancario_id: s.movimiento_id,
        tipo:                 'cobro',
      })
      .select()
      .single();

    // ¿Total cobrado >= total factura?
    const { data: pagos } = await supabase
      .from('pagos')
      .select('importe')
      .eq('factura_id', ref.factura_id);

    const totalCobrado = (pagos ?? []).reduce((sum: number, p: any) => sum + (p.importe ?? 0), 0);

    const { data: factura } = await supabase
      .from('facturas')
      .select('total, expediente_id, numero_factura')
      .eq('id', ref.factura_id)
      .single();

    if (factura && totalCobrado >= factura.total) {
      await supabase
        .from('facturas')
        .update({ estado: 'cobrada', estado_cobro: 'cobrada', cobrada_at: new Date().toISOString() })
        .eq('id', ref.factura_id);

      await insertDomainEvent(supabase, {
        aggregate_id:   ref.factura_id,
        aggregate_type: 'factura',
        event_type:     'PagoConciliado',
        payload:        { pago_id: pago?.id, apunte_id: apunte.id, importe, tipo, total_cobrado: totalCobrado },
        actor_id,
      });

      if (factura.expediente_id) {
        await supabase
          .from('expedientes')
          .update({ estado: 'COBRADO' })
          .eq('id', factura.expediente_id)
          .eq('estado', 'FACTURADO');
      }
    }
  }

  return { ok: true, apunte };
}

// GET /bancos/conciliacion/sugerencias
bancosRoutes.get('/conciliacion/sugerencias', async (c) => {
  const supabase = c.get('supabase');
  const cuenta_id  = c.req.query('cuenta_id');
  const empresa_id = c.req.query('empresa_id');

  if (!cuenta_id && !empresa_id) {
    return c.json(err('VALIDATION', 'Se requiere cuenta_id o empresa_id'), 422);
  }

  // Movimientos pendientes
  let movQuery = supabase
    .from('movimientos_bancarios')
    .select('id, concepto_banco, importe, fecha_operacion, cuentas_bancarias(empresa_id)')
    .eq('estado_concil', 'pendiente');
  if (cuenta_id) movQuery = movQuery.eq('cuenta_id', cuenta_id);

  const { data: movimientos } = await movQuery;

  if (!movimientos || movimientos.length === 0) {
    return c.json({ data: [], error: null });
  }

  // Determinar empresa_id desde la cuenta si no se pasó
  const empId = empresa_id ?? (movimientos[0].cuentas_bancarias as any)?.empresa_id;

  // Referencias pendientes
  const { data: referencias } = await supabase
    .from('referencias_cobro')
    .select('id, referencia, importe, fecha_vencimiento, compania_id')
    .eq('empresa_id', empId)
    .in('estado', ['pendiente', 'enviada']);

  // Tolerancia de las reglas
  const { data: reglas } = await supabase
    .from('reglas_conciliacion')
    .select('tolerancia_eur')
    .eq('empresa_id', empId)
    .eq('activa', true)
    .order('prioridad', { ascending: true });

  const tolerancia = (reglas ?? []).reduce((max: number, r: any) => Math.max(max, r.tolerancia_eur ?? 0), 0);
  const sugerencias = calcularSugerencias(movimientos ?? [], referencias ?? [], tolerancia);

  return c.json({ data: sugerencias, error: null });
});

// POST /bancos/conciliacion/aplicar — conciliar un movimiento con una referencia
bancosRoutes.post('/conciliacion/aplicar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    movimiento_id: string;
    referencia_cobro_id: string;
    importe_aplicado?: number;
    tipo?: 'manual' | 'sugerido_aceptado';
    notas?: string;
  }>();

  const check = validate(body, {
    movimiento_id:       { required: true, isUuid: true },
    referencia_cobro_id: { required: true, isUuid: true },
  });
  if (!check.ok) return validationError(c, check.errors);

  // Verificar estados
  const [{ data: mov }, { data: ref }] = await Promise.all([
    supabase.from('movimientos_bancarios').select('id, importe, estado_concil').eq('id', body.movimiento_id).single(),
    supabase.from('referencias_cobro').select('id, importe, estado').eq('id', body.referencia_cobro_id).single(),
  ]);

  if (!mov) return c.json(err('NOT_FOUND', 'Movimiento bancario no encontrado'), 404);
  if (!ref) return c.json(err('NOT_FOUND', 'Referencia de cobro no encontrada'), 404);
  if (mov.estado_concil === 'conciliado') return c.json(err('YA_CONCILIADO', 'El movimiento ya está conciliado'), 409);
  if (ref.estado === 'cobrada') return c.json(err('REF_COBRADA', 'La referencia ya está cobrada'), 409);
  if (ref.estado === 'anulada') return c.json(err('REF_ANULADA', 'La referencia está anulada'), 422);

  const result = await aplicarConciliacion(
    supabase,
    {
      movimiento_id:       body.movimiento_id,
      referencia_cobro_id: body.referencia_cobro_id,
      importe_movimiento:  mov.importe,
      importe_referencia:  ref.importe,
    },
    user.id,
    body.tipo ?? 'manual',
  );

  if (!result.ok) return c.json(err('DB_ERROR', result.error ?? 'Error al conciliar'), 500);

  return c.json({ data: result.apunte, error: null }, 201);
});

// POST /bancos/conciliacion/ignorar — ignorar un movimiento (no se concilia)
bancosRoutes.post('/conciliacion/ignorar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ movimiento_id: string; notas?: string }>();

  const check = validate(body, { movimiento_id: { required: true, isUuid: true } });
  if (!check.ok) return validationError(c, check.errors);

  const { data, error } = await supabase
    .from('movimientos_bancarios')
    .update({ estado_concil: 'ignorado' })
    .eq('id', body.movimiento_id)
    .neq('estado_concil', 'conciliado')
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Movimiento no encontrado o ya conciliado'), 404);

  await insertAudit(supabase, {
    tabla: 'movimientos_bancarios',
    registro_id: body.movimiento_id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado_concil: 'ignorado', notas: body.notas },
  });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRAZABILIDAD DE COBRO POR FACTURA
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/facturas/:factura_id/cobro
bancosRoutes.get('/facturas/:factura_id/cobro', async (c) => {
  const supabase = c.get('supabase');
  const factura_id = c.req.param('factura_id');

  // Factura + perfil + cuenta + referencia
  const { data: factura, error: fErr } = await supabase
    .from('facturas')
    .select(`
      id, numero_factura, total, estado, estado_cobro, cobrada_at,
      fecha_vencimiento, forma_pago, cuenta_bancaria,
      perfil_cobro_id, cuenta_cobro_id, referencia_cobro_id,
      perfiles_cobro(forma_pago, dias_pago, dia_fijo_mes),
      cuentas_bancarias:cuenta_cobro_id(alias, iban, entidad)
    `)
    .eq('id', factura_id)
    .single();

  if (fErr || !factura) return c.json(err('NOT_FOUND', 'Factura no encontrada'), 404);

  // Referencia de cobro
  let referencia = null;
  if ((factura as any).referencia_cobro_id) {
    const { data } = await supabase
      .from('referencias_cobro')
      .select('*')
      .eq('id', (factura as any).referencia_cobro_id)
      .single();
    referencia = data;
  }

  // Pagos registrados
  const { data: pagos } = await supabase
    .from('pagos')
    .select('*, movimientos_bancarios(fecha_operacion, concepto_banco, importe)')
    .eq('factura_id', factura_id)
    .order('fecha_pago', { ascending: true });

  // Apuntes de conciliación (si existe referencia)
  let apuntes = null;
  if (referencia) {
    const { data } = await supabase
      .from('apuntes_conciliacion')
      .select('*, movimientos_bancarios(fecha_operacion, concepto_banco, importe, cuenta_id, cuentas_bancarias(alias, entidad))')
      .eq('referencia_cobro_id', referencia.id)
      .order('created_at', { ascending: true });
    apuntes = data;
  }

  const totalCobrado = (pagos ?? []).reduce((sum: number, p: any) => sum + (p.importe ?? 0), 0);

  return c.json({
    data: {
      factura: {
        id: factura.id,
        numero_factura: (factura as any).numero_factura,
        total: (factura as any).total,
        estado: (factura as any).estado,
        estado_cobro: (factura as any).estado_cobro,
        cobrada_at: (factura as any).cobrada_at,
        fecha_vencimiento: (factura as any).fecha_vencimiento,
      },
      perfil_cobro: (factura as any).perfiles_cobro ?? null,
      cuenta_cobro: (factura as any).cuentas_bancarias ?? null,
      referencia,
      pagos: pagos ?? [],
      apuntes: apuntes ?? [],
      total_cobrado: totalCobrado,
      pendiente: Math.max(0, ((factura as any).total ?? 0) - totalCobrado),
    },
    error: null,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AGING REPORT
// ═══════════════════════════════════════════════════════════════════════════

// GET /bancos/aging
bancosRoutes.get('/aging', async (c) => {
  const supabase = c.get('supabase');
  const empresa_id  = c.req.query('empresa_id');
  const compania_id = c.req.query('compania_id');

  let query = supabase.from('v_cobros_pendientes').select('*');
  if (empresa_id)  query = query.eq('empresa_id', empresa_id);
  if (compania_id) query = query.eq('compania_id', compania_id);

  const { data, error } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Totales por bucket
  const buckets: Record<string, { count: number; importe: number }> = {
    vigente: { count: 0, importe: 0 },
    '1-30':  { count: 0, importe: 0 },
    '31-60': { count: 0, importe: 0 },
    '61-90': { count: 0, importe: 0 },
    '+90':   { count: 0, importe: 0 },
  };
  let totalPendiente = 0;

  for (const row of data ?? []) {
    const bucket = row.bucket_aging as string;
    if (buckets[bucket]) {
      buckets[bucket].count++;
      buckets[bucket].importe += Number(row.importe ?? 0);
    }
    totalPendiente += Number(row.importe ?? 0);
  }

  return c.json({
    data: {
      referencias: data,
      resumen: { buckets, total_pendiente: totalPendiente },
    },
    error: null,
  });
});
