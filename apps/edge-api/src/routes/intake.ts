import { Hono } from 'hono';
import type { IntakeClaimRequest, IntakeClaimResponse } from '@erp/types';
import { getRequestIp } from '../http/request-metadata';
import { createExpedienteCommand, normalizeCommandError } from '../services/core-commands';
import type { Env } from '../types';

export const intakeRoutes = new Hono<{ Bindings: Env }>();

// POST /intake/claims - Ingesta estructurada de siniestros
intakeRoutes.post('/claims', async (c) => {
  const supabase = c.get('adminSupabase');
  const user = c.get('user');
  const body = await c.req.json<IntakeClaimRequest>();

  const errors: string[] = [];
  if (!body.referencia_externa) errors.push('referencia_externa requerida');
  if (!body.compania_codigo) errors.push('compania_codigo requerido');
  if (!body.tipo_siniestro) errors.push('tipo_siniestro requerido');
  if (!body.descripcion) errors.push('descripcion requerida');
  if (!body.direccion_siniestro) errors.push('direccion_siniestro requerida');
  if (!body.codigo_postal) errors.push('codigo_postal requerido');
  if (!body.localidad) errors.push('localidad requerida');
  if (!body.provincia) errors.push('provincia requerida');
  if (!body.asegurado?.nombre) errors.push('asegurado.nombre requerido');
  if (!body.asegurado?.apellidos) errors.push('asegurado.apellidos requerido');
  if (!body.asegurado?.telefono) errors.push('asegurado.telefono requerido');
  if (!body.asegurado?.direccion) errors.push('asegurado.direccion requerida');
  if (!body.asegurado?.codigo_postal) errors.push('asegurado.codigo_postal requerido');
  if (!body.asegurado?.localidad) errors.push('asegurado.localidad requerida');
  if (!body.asegurado?.provincia) errors.push('asegurado.provincia requerida');

  if (errors.length > 0) {
    const resp: IntakeClaimResponse = { status: 'validation_error', errors };
    return c.json({ data: resp, error: null }, 422);
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
