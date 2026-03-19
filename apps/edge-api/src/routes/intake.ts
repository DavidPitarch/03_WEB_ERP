import { Hono } from 'hono';
import type { IntakeClaimRequest, IntakeClaimResponse } from '@erp/types';
import { getRequestIp } from '../http/request-metadata';
import { createExpedienteCommand, normalizeCommandError } from '../services/core-commands';
import { validate, validationError } from '../validation/schema';
import type { Env } from '../types';

export const intakeRoutes = new Hono<{ Bindings: Env }>();

// POST /intake/claims - Ingesta estructurada de siniestros
intakeRoutes.post('/claims', async (c) => {
  const supabase = c.get('adminSupabase');
  const user = c.get('user');
  const body = await c.req.json<IntakeClaimRequest>();

  // Validación declarativa del payload raíz
  const rootCheck = validate(body, {
    referencia_externa: { required: true, minLength: 1, maxLength: 100 },
    compania_codigo:    { required: true, minLength: 1, maxLength: 20 },
    tipo_siniestro:     { required: true, minLength: 1, maxLength: 60 },
    descripcion:        { required: true, minLength: 1, maxLength: 2000 },
    direccion_siniestro:{ required: true, minLength: 1, maxLength: 300 },
    codigo_postal:      { required: true, minLength: 5, maxLength: 10 },
    localidad:          { required: true, minLength: 1, maxLength: 100 },
    provincia:          { required: true, minLength: 1, maxLength: 100 },
  });
  if (!rootCheck.ok) return validationError(c, rootCheck.errors);

  // Validación del sub-objeto asegurado
  const aseguradoCheck = validate(body.asegurado as Record<string, unknown> ?? {}, {
    nombre:       { required: true, minLength: 1, maxLength: 200 },
    apellidos:    { required: true, minLength: 1, maxLength: 200 },
    telefono:     { required: true, minLength: 9, maxLength: 20 },
    direccion:    { required: true, minLength: 1, maxLength: 300 },
    codigo_postal:{ required: true, minLength: 5, maxLength: 10 },
    localidad:    { required: true, minLength: 1, maxLength: 100 },
    provincia:    { required: true, minLength: 1, maxLength: 100 },
    email:        { isEmail: true },
  });
  if (!aseguradoCheck.ok) {
    const prefixed: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(aseguradoCheck.errors)) {
      prefixed[`asegurado.${k}`] = v;
    }
    return validationError(c, prefixed);
  }

  const { data: dupRef } = await supabase
    .from('expedientes')
    .select('id, numero_expediente')
    .eq('referencia_externa', body.referencia_externa)
    .maybeSingle();

  if (dupRef) {
    const resp: IntakeClaimResponse = {
      status: 'duplicate_detected',
      duplicate_of: dupRef.numero_expediente,
      expediente_id: dupRef.id,
    };
    return c.json({ data: resp, error: null }, 200);
  }

  if (body.numero_siniestro_cia) {
    const { data: dupSiniestro } = await supabase
      .from('expedientes')
      .select('id, numero_expediente')
      .eq('numero_siniestro_cia', body.numero_siniestro_cia)
      .maybeSingle();

    if (dupSiniestro) {
      const resp: IntakeClaimResponse = {
        status: 'duplicate_detected',
        duplicate_of: dupSiniestro.numero_expediente,
        expediente_id: dupSiniestro.id,
      };
      return c.json({ data: resp, error: null }, 200);
    }
  }

  if (body.numero_poliza) {
    const { data: dupPoliza } = await supabase
      .from('expedientes')
      .select('id, numero_expediente, asegurados!inner(telefono)')
      .eq('numero_poliza', body.numero_poliza)
      .eq('asegurados.telefono', body.asegurado.telefono)
      .not('estado', 'in', '("CERRADO","CANCELADO")')
      .maybeSingle();

    if (dupPoliza) {
      const resp: IntakeClaimResponse = {
        status: 'duplicate_detected',
        duplicate_of: dupPoliza.numero_expediente,
        expediente_id: dupPoliza.id,
      };
      return c.json({ data: resp, error: null }, 200);
    }
  }

  const { data: compania } = await supabase
    .from('companias')
    .select('id')
    .eq('codigo', body.compania_codigo)
    .eq('activa', true)
    .single();

  if (!compania) {
    return c.json({
      data: { status: 'validation_error', errors: [`Compania con codigo '${body.compania_codigo}' no encontrada`] } as IntakeClaimResponse,
      error: null,
    }, 422);
  }

  const { data: empresa } = await supabase
    .from('empresas_facturadoras')
    .select('id')
    .eq('activa', true)
    .limit(1)
    .single();

  if (!empresa) {
    return c.json({
      data: { status: 'validation_error', errors: ['No hay empresa facturadora activa'] } as IntakeClaimResponse,
      error: null,
    }, 422);
  }

  const { data: existingAsegurado } = await supabase
    .from('asegurados')
    .select('id')
    .eq('telefono', body.asegurado.telefono)
    .eq('nombre', body.asegurado.nombre)
    .eq('apellidos', body.asegurado.apellidos)
    .maybeSingle();

  try {
    const exp = await createExpedienteCommand(
      supabase,
      {
        compania_id: compania.id,
        empresa_facturadora_id: empresa.id,
        asegurado_id: existingAsegurado?.id,
        asegurado_nuevo: existingAsegurado ? undefined : {
          nombre: body.asegurado.nombre,
          apellidos: body.asegurado.apellidos,
          telefono: body.asegurado.telefono,
          telefono2: body.asegurado.telefono2,
          email: body.asegurado.email,
          nif: body.asegurado.nif,
          direccion: body.asegurado.direccion,
          codigo_postal: body.asegurado.codigo_postal,
          localidad: body.asegurado.localidad,
          provincia: body.asegurado.provincia,
        },
        tipo_siniestro: body.tipo_siniestro,
        descripcion: body.descripcion,
        direccion_siniestro: body.direccion_siniestro,
        codigo_postal: body.codigo_postal,
        localidad: body.localidad,
        provincia: body.provincia,
        numero_poliza: body.numero_poliza,
        numero_siniestro_cia: body.numero_siniestro_cia,
        prioridad: body.prioridad ?? 'media',
        fecha_limite_sla: body.fecha_limite_sla ?? undefined,
        origen: 'api',
        referencia_externa: body.referencia_externa,
        datos_origen: body.metadata ?? {},
      },
      user.id,
      getRequestIp(c),
    );

    const resp: IntakeClaimResponse = {
      status: 'created',
      expediente_id: String(exp.id),
      numero_expediente: String(exp.numero_expediente),
    };

    return c.json({ data: resp, error: null }, 201);
  } catch (error) {
    const commandError = normalizeCommandError(error);

    if (commandError.code === 'CONFLICT') {
      const { data: duplicate } = await supabase
        .from('expedientes')
        .select('id, numero_expediente')
        .eq('referencia_externa', body.referencia_externa)
        .maybeSingle();

      if (duplicate) {
        const resp: IntakeClaimResponse = {
          status: 'duplicate_detected',
          duplicate_of: duplicate.numero_expediente,
          expediente_id: duplicate.id,
        };
        return c.json({ data: resp, error: null }, 200);
      }
    }

    return c.json({
      data: null,
      error: {
        code: commandError.code,
        message: commandError.message,
        details: commandError.details,
      },
    }, commandError.status);
  }
});
