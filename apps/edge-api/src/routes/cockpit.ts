import { Hono } from 'hono';
import type { Env } from '../types';

/**
 * Cockpit feed — agregado de datos para los 3 módulos del cockpit operativo.
 *
 * GET /cockpit/feed
 * Devuelve en una sola petición los datos de:
 *  - asignaciones:          expedientes NO_ASIGNADO + EN_PLANIFICACION
 *  - solicitudes:           alertas activas + avisos
 *  - trabajos_no_revisados: partes_operario pendientes de validación
 *
 * Roles: OFFICE_ROLES (admin, supervisor, tramitador, financiero, dirección)
 */
export const cockpitRoutes = new Hono<{ Bindings: Env }>();

interface CockpitItem {
  id: string;
  numero: string;
  tipo?: string;
  localidad?: string;
  prioridad?: string;
  estado?: string;
  etiqueta?: string;
  fecha?: string;
  asegurado_nombre?: string;
  direccion_completa?: string;
  detailPath: string;
}

interface ModuleData {
  total: number;
  criticos: number;
  items: CockpitItem[];
}

interface CockpitFeedResponse {
  asignaciones: ModuleData;
  solicitudes: ModuleData;
  trabajos_no_revisados: ModuleData;
}

cockpitRoutes.get('/feed', async (c) => {
  const supabase = c.get('supabase');

  // ── 1. ASIGNACIONES ──────────────────────────────────────────────────────
  // Expedientes recién llegados: NUEVO y NO_ASIGNADO (sin tramitar aún)
  const { data: expsAsign, error: e1 } = await supabase
    .from('expedientes')
    .select(`
      id,
      numero_expediente,
      tipo_siniestro,
      localidad,
      prioridad,
      estado,
      fecha_encargo,
      compania:companias(nombre)
    `)
    .in('estado', ['NUEVO', 'NO_ASIGNADO'])
    .order('prioridad', { ascending: false })
    .order('fecha_encargo', { ascending: true })
    .limit(10);

  // Total de asignaciones
  const { count: totalAsign } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['NUEVO', 'NO_ASIGNADO']);

  const asignItems: CockpitItem[] = (expsAsign ?? []).map((e: any) => ({
    id:         e.id,
    numero:     e.numero_expediente,
    tipo:       e.tipo_siniestro,
    localidad:  e.localidad,
    prioridad:  e.prioridad,
    estado:     e.estado,
    fecha:      e.fecha_encargo,
    detailPath: `/expedientes/${e.id}`,
  }));

  const asignaciones: ModuleData = {
    total:    totalAsign ?? asignItems.length,
    criticos: asignItems.filter((i) => i.prioridad === 'urgente' || i.prioridad === 'alta').length,
    items:    asignItems.slice(0, 5),
  };

  // ── 2. SOLICITUDES / AVISOS ───────────────────────────────────────────────
  // Alertas activas + datos del asegurado para el tooltip
  const { data: alertasData } = await supabase
    .from('alertas')
    .select(`
      id, tipo, expediente_id, mensaje, prioridad, created_at,
      expediente:expedientes(
        numero_expediente,
        direccion_siniestro,
        codigo_postal,
        localidad,
        asegurado:asegurados(nombre, apellidos)
      )
    `)
    .eq('estado', 'activa')
    .order('prioridad', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10);

  const { count: totalAlertas } = await supabase
    .from('alertas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'activa');

  const solicItems: CockpitItem[] = (alertasData ?? []).map((a: any) => {
    const exp = a.expediente;
    const aseg = exp?.asegurado;
    const partesDireccion = [exp?.direccion_siniestro, exp?.codigo_postal, exp?.localidad].filter(Boolean);
    return {
      id:                a.id,
      numero:            exp?.numero_expediente ?? `AVISO-${a.id.slice(0, 6)}`,
      tipo:              a.tipo,
      etiqueta:          a.prioridad ?? 'pendiente',
      prioridad:         a.prioridad,
      fecha:             a.created_at,
      detailPath:        a.expediente_id ? `/expedientes/${a.expediente_id}` : '/solicitudes',
      asegurado_nombre:  aseg ? `${aseg.nombre} ${aseg.apellidos}`.trim() : undefined,
      direccion_completa: partesDireccion.length ? partesDireccion.join(', ') : undefined,
    };
  });

  const solicitudes: ModuleData = {
    total:    totalAlertas ?? solicItems.length,
    criticos: solicItems.filter((i) => i.prioridad === 'urgente').length,
    items:    solicItems.slice(0, 5),
  };

  // ── 3. TRABAJOS NO REVISADOS ──────────────────────────────────────────────
  // Partes de operario con validacion_estado = 'pendiente'
  const { data: partesData } = await supabase
    .from('partes_operario')
    .select(`
      id,
      expediente_id,
      fecha_trabajo,
      validacion_estado,
      expediente:expedientes(numero_expediente, tipo_siniestro, localidad, prioridad),
      operario:operarios(nombre, apellidos)
    `)
    .eq('validacion_estado', 'pendiente')
    .order('fecha_trabajo', { ascending: true })
    .limit(10);

  const { count: totalPartes } = await supabase
    .from('partes_operario')
    .select('id', { count: 'exact', head: true })
    .eq('validacion_estado', 'pendiente');

  const partesItems: CockpitItem[] = (partesData ?? []).map((p: any) => ({
    id:         p.id,
    numero:     p.expediente?.numero_expediente ?? p.id.slice(0, 8),
    tipo:       p.expediente?.tipo_siniestro,
    localidad:  p.expediente?.localidad,
    prioridad:  p.expediente?.prioridad,
    etiqueta:   'pendiente',
    fecha:      p.fecha_trabajo,
    detailPath: p.expediente_id ? `/expedientes/${p.expediente_id}` : '/partes-validacion',
  }));

  const trabajos_no_revisados: ModuleData = {
    total:    totalPartes ?? partesItems.length,
    criticos: partesItems.filter((i) => i.prioridad === 'urgente' || i.prioridad === 'alta').length,
    items:    partesItems.slice(0, 5),
  };

  // ── Respuesta ─────────────────────────────────────────────────────────────
  const feed: CockpitFeedResponse = {
    asignaciones,
    solicitudes,
    trabajos_no_revisados,
  };

  return c.json({ data: feed, error: null });
});

// ── Contadores rápidos (solo totales, sin feed) ─────────────────────────────
cockpitRoutes.get('/counts', async (c) => {
  const supabase = c.get('supabase');

  const [
    { count: asignaciones },
    { count: solicitudes },
    { count: partes },
  ] = await Promise.all([
    supabase
      .from('expedientes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['NO_ASIGNADO', 'EN_PLANIFICACION']),
    supabase
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'activa'),
    supabase
      .from('partes_operario')
      .select('id', { count: 'exact', head: true })
      .eq('validacion_estado', 'pendiente'),
  ]);

  return c.json({
    data: {
      asignaciones:          asignaciones ?? 0,
      solicitudes:           solicitudes  ?? 0,
      trabajos_no_revisados: partes       ?? 0,
    },
    error: null,
  });
});
