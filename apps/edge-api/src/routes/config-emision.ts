import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import { validate, validationError } from '../validation/schema';
import type { Env } from '../types';

export const configEmisionRoutes = new Hono<{ Bindings: Env }>();

// ─── Helper ────────────────────────────────────────────────────────────────
function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

const TIPOS_DOC = ['factura', 'factura_simplificada', 'autofactura', 'abono', 'rectificativa'] as const;
const TIPOS_TERCERO = ['compania', 'cliente_final', 'operario_autonomo', 'proveedor', 'grupo_empresa', 'cualquiera'] as const;
const FLUJOS = ['expediente', 'videoperitacion', 'manual', 'subcontrata', 'cualquiera'] as const;

function hasWriteRole(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('financiero');
}

function hasAdminRole(roles: string[]): boolean {
  return roles.includes('admin');
}

function forbiddenWrite(c: any) {
  return c.json(err('FORBIDDEN', 'Se requiere rol admin o financiero'), 403);
}

function forbiddenAdmin(c: any) {
  return c.json(err('FORBIDDEN', 'Se requiere rol admin'), 403);
}

// ═══════════════════════════════════════════════════════════════════════════
// REGLAS DE NUMERACIÓN
// ═══════════════════════════════════════════════════════════════════════════

configEmisionRoutes.get('/reglas-numeracion', async (c) => {
  const sb = c.get('supabase');
  const { empresa_id, incluir_globales } = c.req.query();

  let q = sb.from('reglas_numeracion').select('*').eq('activa', true).order('nombre');

  if (empresa_id) {
    if (incluir_globales !== 'false') {
      q = q.or(`empresa_facturadora_id.eq.${empresa_id},empresa_facturadora_id.is.null`);
    } else {
      q = q.eq('empresa_facturadora_id', empresa_id);
    }
  }

  const { data, error } = await q;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

configEmisionRoutes.post('/reglas-numeracion', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const result = validate(body, {
    nombre:            { required: true, minLength: 2 },
    longitud_contador: { isNumber: true },
    formato_anio:      { isEnum: ['YYYY', 'YY'] },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');
  const { data, error } = await sb.from('reglas_numeracion')
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error?.code === '23505') return c.json(err('NOMBRE_DUPLICADO', 'Ya existe una regla con ese nombre para esta empresa'), 422);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'reglas_numeracion', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: data });

  return c.json({ data, error: null }, 201);
});

configEmisionRoutes.get('/reglas-numeracion/:id', async (c) => {
  const { data, error } = await c.get('supabase').from('reglas_numeracion').select('*').eq('id', c.req.param('id')).single();
  if (error || !data) return c.json(err('NOT_FOUND', 'Regla no encontrada'), 404);
  return c.json({ data, error: null });
});

// Preview del número que generaría esta regla
configEmisionRoutes.get('/reglas-numeracion/:id/preview', async (c) => {
  const { data: regla, error } = await c.get('supabase').from('reglas_numeracion').select('*').eq('id', c.req.param('id')).single();
  if (error || !regla) return c.json(err('NOT_FOUND', 'Regla no encontrada'), 404);

  const prefijo  = c.req.query('prefijo') ?? 'F';
  const contador = parseInt(c.req.query('contador') ?? '42', 10);
  const anio     = new Date().getFullYear().toString().slice(regla.formato_anio === 'YY' ? 2 : 0);
  const pad      = String(contador).padStart(regla.longitud_contador, '0');

  const ejemplo = regla.incluir_anio
    ? `${prefijo}${regla.separador_prefijo}${anio}${regla.separador_anio}${pad}`
    : `${prefijo}${regla.separador_prefijo}${pad}`;

  return c.json({ data: { ejemplo, proximo_contador: contador }, error: null });
});

configEmisionRoutes.put('/reglas-numeracion/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const sb = c.get('supabase');

  const { data, error } = await sb.from('reglas_numeracion')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  if (!data) return c.json(err('NOT_FOUND', 'Regla no encontrada'), 404);

  await insertAudit(sb, { tabla: 'reglas_numeracion', registro_id: data.id, accion: 'UPDATE', actor_id: user.id, cambios: body });

  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// SERIES DE FACTURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

configEmisionRoutes.get('/series', async (c) => {
  const { empresa_id, tipo_documento, tipo_tercero, ejercicio_fiscal, activa } = c.req.query();
  const sb = c.get('supabase');

  let q = sb.from('series_facturacion')
    .select('*, regla_numeracion:reglas_numeracion(*), cuenta_bancaria:cuentas_bancarias_empresa(*)')
    .order('codigo');

  if (empresa_id)      q = q.eq('empresa_facturadora_id', empresa_id);
  if (tipo_documento)  q = q.eq('tipo_documento', tipo_documento);
  if (tipo_tercero)    q = q.eq('tipo_tercero', tipo_tercero);
  if (ejercicio_fiscal) q = q.eq('ejercicio_fiscal', ejercicio_fiscal);
  if (activa !== undefined) q = q.eq('activa', activa === 'true');

  const { data, error } = await q;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

configEmisionRoutes.post('/series', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const result = validate(body, {
    codigo:                   { required: true, minLength: 1, maxLength: 10 },
    nombre:                   { required: true, minLength: 2 },
    prefijo:                  { required: true, minLength: 1 },
    empresa_facturadora_id:   { required: true, isUuid: true },
    tipo_documento:           { required: true, isEnum: TIPOS_DOC },
    tipo_tercero:             { isEnum: TIPOS_TERCERO },
    flujo_origen:             { isEnum: FLUJOS },
    regla_numeracion_id:      { isUuid: true },
    cuenta_bancaria_id:       { isUuid: true },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');

  // Validar duplicidad activa
  const { data: dup } = await sb.from('series_facturacion')
    .select('id')
    .eq('activa', true)
    .eq('codigo', body.codigo)
    .eq('empresa_facturadora_id', body.empresa_facturadora_id)
    .eq('tipo_documento', body.tipo_documento)
    .maybeSingle();

  if (dup) {
    return c.json(err('SERIE_DUPLICADA', `Ya existe una serie activa con código '${body.codigo}' para este tipo documental`), 422);
  }

  const { data, error } = await sb.from('series_facturacion').insert({
    ...body,
    tipo: body.tipo_documento === 'abono' ? 'abono'
        : body.tipo_documento === 'rectificativa' ? 'rectificativa'
        : 'ordinaria',
    tipo_tercero: body.tipo_tercero ?? 'cualquiera',
    flujo_origen: body.flujo_origen ?? 'cualquiera',
    contador_actual: 0,
    version: 1,
    created_by: user.id,
    updated_by: user.id,
  }).select('*, regla_numeracion:reglas_numeracion(*), cuenta_bancaria:cuentas_bancarias_empresa(*)').single();

  if (error?.code === '23505') return c.json(err('SERIE_DUPLICADA', 'Ya existe una serie con esa combinación de código/empresa/tipo'), 422);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'series_facturacion', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: data });

  return c.json({ data, error: null }, 201);
});

configEmisionRoutes.get('/series/resolver', async (c) => {
  const { empresa_id, tipo_documento, tipo_tercero, flujo_origen, compania_id } = c.req.query();

  if (!empresa_id || !tipo_documento) {
    return c.json(err('VALIDATION', 'empresa_id y tipo_documento son requeridos'), 422);
  }

  const sb = c.get('supabase');
  const { data: serieId, error } = await sb.rpc('resolver_serie', {
    p_empresa_id:   empresa_id,
    p_tipo_doc:     tipo_documento,
    p_tipo_tercero: tipo_tercero ?? null,
    p_flujo:        flujo_origen ?? null,
    p_compania_id:  compania_id ?? null,
  });

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  if (!serieId) return c.json(err('SIN_SERIE_ASIGNADA', 'No existe una asignación de serie para este contexto'), 404);

  const { data: serie } = await sb.from('series_facturacion')
    .select('*, regla_numeracion:reglas_numeracion(*), cuenta_bancaria:cuentas_bancarias_empresa(*)')
    .eq('id', serieId)
    .single();

  return c.json({ data: { serie, asignacion_id: null }, error: null });
});

configEmisionRoutes.get('/series/:id', async (c) => {
  const { data, error } = await c.get('supabase').from('series_facturacion')
    .select('*, regla_numeracion:reglas_numeracion(*), cuenta_bancaria:cuentas_bancarias_empresa(*)')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Serie no encontrada'), 404);
  return c.json({ data, error: null });
});

configEmisionRoutes.put('/series/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const result = validate(body, {
    version:       { required: true, isNumber: true },
    tipo_documento: { isEnum: TIPOS_DOC },
    tipo_tercero:  { isEnum: TIPOS_TERCERO },
    flujo_origen:  { isEnum: FLUJOS },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');
  const id = c.req.param('id');
  const { version, motivo_cambio, ...campos } = body;

  // Optimistic locking
  const { data: actual } = await sb.from('series_facturacion').select('version, prefijo').eq('id', id).single();
  if (!actual) return c.json(err('NOT_FOUND', 'Serie no encontrada'), 404);
  if (actual.version !== version) {
    return c.json(err('VERSION_CONFLICT', 'La serie fue modificada por otro usuario. Recarga e inténtalo de nuevo.'), 409);
  }

  // No permitir cambiar prefijo si ya hay facturas emitidas en esta serie
  if (campos.prefijo && campos.prefijo !== actual.prefijo) {
    const { count } = await sb.from('facturas').select('id', { count: 'exact', head: true }).eq('serie_id', id);
    if ((count ?? 0) > 0) {
      return c.json(err('PREFIJO_NO_MODIFICABLE', 'No se puede cambiar el prefijo: la serie ya tiene facturas emitidas'), 422);
    }
  }

  const updatePayload: Record<string, unknown> = {
    ...campos,
    version: version + 1,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  // Mantener columna legacy tipo sincronizada
  if (campos.tipo_documento) {
    updatePayload.tipo = campos.tipo_documento === 'abono' ? 'abono'
      : campos.tipo_documento === 'rectificativa' ? 'rectificativa'
      : 'ordinaria';
  }

  const { data, error } = await sb.from('series_facturacion')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  // El trigger trg_series_facturacion_audit registra el historial automáticamente.

  await insertAudit(sb, { tabla: 'series_facturacion', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: { ...campos, motivo_cambio } });

  return c.json({ data, error: null });
});

// Reset de contador — solo admin, requiere motivo
configEmisionRoutes.post('/series/:id/reset-contador', async (c) => {
  const user = c.get('user');
  if (!hasAdminRole(user.roles)) return forbiddenAdmin(c);

  const { nuevo_valor = 0, motivo } = await c.req.json();
  if (!motivo) return c.json(err('MOTIVO_REQUERIDO', 'Se requiere motivo para resetear el contador'), 422);

  const sb = c.get('supabase');
  const id = c.req.param('id');

  const { data: actual } = await sb.from('series_facturacion').select('version, contador_actual').eq('id', id).single();
  if (!actual) return c.json(err('NOT_FOUND', 'Serie no encontrada'), 404);

  const { data, error } = await sb.from('series_facturacion')
    .update({ contador_actual: nuevo_valor, version: actual.version + 1, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'series_facturacion', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: { reset_contador: { de: actual.contador_actual, a: nuevo_valor, motivo } } });

  return c.json({ data, error: null });
});

// Historial de versiones de una serie
configEmisionRoutes.get('/series/:id/historial', async (c) => {
  const { data, error } = await c.get('supabase').from('series_facturacion_historial')
    .select('*')
    .eq('serie_id', c.req.param('id'))
    .order('version_numero', { ascending: false });

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// CUENTAS BANCARIAS
// ═══════════════════════════════════════════════════════════════════════════

configEmisionRoutes.get('/cuentas-bancarias', async (c) => {
  const { empresa_id, solo_activas } = c.req.query();
  const sb = c.get('supabase');

  let q = sb.from('cuentas_bancarias_empresa')
    .select('*')
    .order('es_principal', { ascending: false })
    .order('nombre_banco');

  if (empresa_id) q = q.eq('empresa_facturadora_id', empresa_id);
  if (solo_activas !== 'false') q = q.eq('activa', true);

  const { data, error } = await q;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

configEmisionRoutes.post('/cuentas-bancarias', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const result = validate(body, {
    empresa_facturadora_id: { required: true, isUuid: true },
    iban:                   { required: true, minLength: 15, maxLength: 34 },
    nombre_banco:           { required: true, minLength: 2 },
    titular:                { required: true, minLength: 2 },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');

  // Si se marca como principal, desmarcar las demás de la misma empresa
  if (body.es_principal) {
    await sb.from('cuentas_bancarias_empresa')
      .update({ es_principal: false })
      .eq('empresa_facturadora_id', body.empresa_facturadora_id)
      .eq('es_principal', true);
  }

  const { data, error } = await sb.from('cuentas_bancarias_empresa')
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error?.code === '23505') return c.json(err('IBAN_DUPLICADO', 'Ese IBAN ya está registrado para esta empresa'), 422);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'cuentas_bancarias_empresa', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: data });

  return c.json({ data, error: null }, 201);
});

configEmisionRoutes.put('/cuentas-bancarias/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const sb = c.get('supabase');
  const id = c.req.param('id');

  // Si se marca como principal, desmarcar las demás de la misma empresa
  if (body.es_principal) {
    const { data: cuenta } = await sb.from('cuentas_bancarias_empresa').select('empresa_facturadora_id').eq('id', id).single();
    if (cuenta) {
      await sb.from('cuentas_bancarias_empresa')
        .update({ es_principal: false })
        .eq('empresa_facturadora_id', cuenta.empresa_facturadora_id)
        .neq('id', id);
    }
  }

  const { data, error } = await sb.from('cuentas_bancarias_empresa')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  if (!data) return c.json(err('NOT_FOUND', 'Cuenta no encontrada'), 404);

  await insertAudit(sb, { tabla: 'cuentas_bancarias_empresa', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: body });

  return c.json({ data, error: null });
});

configEmisionRoutes.delete('/cuentas-bancarias/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const sb = c.get('supabase');
  const { error } = await sb.from('cuentas_bancarias_empresa')
    .update({ activa: false, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'));

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'cuentas_bancarias_empresa', registro_id: c.req.param('id'), accion: 'UPDATE', actor_id: user.id, cambios: { activa: false } });

  return c.json({ data: { ok: true }, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// ASIGNACIONES DE SERIE
// ═══════════════════════════════════════════════════════════════════════════

configEmisionRoutes.get('/asignaciones', async (c) => {
  const { empresa_id, tipo_documento } = c.req.query();
  const sb = c.get('supabase');

  let q = sb.from('asignaciones_serie')
    .select('*, serie:series_facturacion(id,codigo,nombre,prefijo), compania:companias(id,nombre)')
    .order('prioridad');

  if (empresa_id)     q = q.eq('empresa_facturadora_id', empresa_id);
  if (tipo_documento) q = q.eq('tipo_documento', tipo_documento);

  const { data, error } = await q;
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});

configEmisionRoutes.post('/asignaciones', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const result = validate(body, {
    empresa_facturadora_id: { required: true, isUuid: true },
    serie_id:               { required: true, isUuid: true },
    tipo_documento:          { required: true, isEnum: TIPOS_DOC },
    tipo_tercero:           { isEnum: ['compania', 'cliente_final', 'operario_autonomo', 'proveedor', 'grupo_empresa'] },
    flujo_origen:           { isEnum: ['expediente', 'videoperitacion', 'manual', 'subcontrata'] },
    compania_id:            { isUuid: true },
    prioridad:              { isNumber: true },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');
  const { data, error } = await sb.from('asignaciones_serie')
    .insert({ ...body, created_by: user.id })
    .select('*, serie:series_facturacion(id,codigo,nombre,prefijo), compania:companias(id,nombre)')
    .single();

  if (error?.code === '23505') return c.json(err('ASIGNACION_DUPLICADA', 'Ya existe una asignación activa con los mismos criterios'), 422);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'asignaciones_serie', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: data });

  return c.json({ data, error: null }, 201);
});

configEmisionRoutes.put('/asignaciones/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const sb = c.get('supabase');

  const { data, error } = await sb.from('asignaciones_serie')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('*, serie:series_facturacion(id,codigo,nombre,prefijo), compania:companias(id,nombre)')
    .single();

  if (error?.code === '23505') return c.json(err('ASIGNACION_DUPLICADA', 'Conflicto con otra asignación activa con los mismos criterios'), 422);
  if (error) return c.json(err('DB_ERROR', error.message), 500);
  if (!data) return c.json(err('NOT_FOUND', 'Asignación no encontrada'), 404);

  await insertAudit(sb, { tabla: 'asignaciones_serie', registro_id: c.req.param('id'), accion: 'UPDATE', actor_id: user.id, cambios: body });

  return c.json({ data, error: null });
});

configEmisionRoutes.delete('/asignaciones/:id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const sb = c.get('supabase');
  const { error } = await sb.from('asignaciones_serie')
    .update({ activa: false, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'));

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(sb, { tabla: 'asignaciones_serie', registro_id: c.req.param('id'), accion: 'UPDATE', actor_id: user.id, cambios: { activa: false } });

  return c.json({ data: { ok: true }, error: null });
});

// Simulador: dado un contexto, devuelve qué serie se resolvería
configEmisionRoutes.post('/asignaciones/simular', async (c) => {
  const body = await c.req.json();
  const result = validate(body, {
    empresa_facturadora_id: { required: true, isUuid: true },
    tipo_documento:          { required: true, isEnum: TIPOS_DOC },
  });
  if (!result.ok) return validationError(c, result.errors);

  const sb = c.get('supabase');
  const { data: asignaciones } = await sb.from('asignaciones_serie')
    .select('*, serie:series_facturacion(*, regla_numeracion:reglas_numeracion(*), cuenta_bancaria:cuentas_bancarias_empresa(*))')
    .eq('empresa_facturadora_id', body.empresa_facturadora_id)
    .eq('tipo_documento', body.tipo_documento)
    .eq('activa', true)
    .order('prioridad');

  const match = (asignaciones ?? []).find((a: any) =>
    (!a.tipo_tercero  || a.tipo_tercero  === body.tipo_tercero)  &&
    (!a.flujo_origen  || a.flujo_origen  === body.flujo_origen)  &&
    (!a.compania_id   || a.compania_id   === body.compania_id)   &&
    a.serie?.activa
  ) ?? null;

  return c.json({ data: { asignacion: match, serie: match?.serie ?? null }, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE EMISIÓN POR EMPRESA
// ═══════════════════════════════════════════════════════════════════════════

configEmisionRoutes.get('/configuracion/:empresa_id', async (c) => {
  const { data, error } = await c.get('supabase').from('config_emision_empresa')
    .select('*, cuenta_bancaria:cuentas_bancarias_empresa(*)')
    .eq('empresa_facturadora_id', c.req.param('empresa_id'))
    .maybeSingle();

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });  // null si no existe → usar defaults del sistema
});

configEmisionRoutes.put('/configuracion/:empresa_id', async (c) => {
  const user = c.get('user');
  if (!hasWriteRole(user.roles)) return forbiddenWrite(c);

  const body = await c.req.json();
  const sb = c.get('supabase');
  const empresa_id = c.req.param('empresa_id');

  // Obtener versión actual para optimistic lock y snapshot de historial
  const { data: actual } = await sb.from('config_emision_empresa')
    .select('id, version')
    .eq('empresa_facturadora_id', empresa_id)
    .maybeSingle();

  if (actual && body.version !== undefined && actual.version !== body.version) {
    return c.json(err('VERSION_CONFLICT', 'La configuración fue modificada por otro usuario. Recarga e inténtalo de nuevo.'), 409);
  }

  const { version: _v, motivo_cambio, ...campos } = body;
  const nuevaVersion = (actual?.version ?? 0) + 1;

  const { data, error } = await sb.from('config_emision_empresa').upsert({
    ...campos,
    empresa_facturadora_id: empresa_id,
    version: nuevaVersion,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_facturadora_id' }).select('*, cuenta_bancaria:cuentas_bancarias_empresa(*)').single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  // Registrar historial
  await sb.from('config_emision_historial').insert({
    empresa_facturadora_id: empresa_id,
    version_numero: nuevaVersion,
    datos_anteriores: actual ?? {},
    datos_nuevos: data,
    motivo_cambio: motivo_cambio ?? null,
    actor_id: user.id,
  });

  await insertAudit(sb, { tabla: 'config_emision_empresa', registro_id: data.id, accion: actual ? 'UPDATE' : 'INSERT', actor_id: user.id, cambios: campos });

  return c.json({ data, error: null });
});

configEmisionRoutes.get('/configuracion/:empresa_id/historial', async (c) => {
  const { data, error } = await c.get('supabase').from('config_emision_historial')
    .select('*')
    .eq('empresa_facturadora_id', c.req.param('empresa_id'))
    .order('version_numero', { ascending: false })
    .limit(50);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null });
});
