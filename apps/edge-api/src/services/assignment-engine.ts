import type { SupabaseClient } from '@supabase/supabase-js';

export interface AssignmentSuggestion {
  tramitador_id: string;
  nombre_completo: string;
  porcentaje_carga: number;
  total_activos: number;
  max_expedientes_activos: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
  puede_aceptar: boolean;
  motivo_sugerencia: 'preasignacion' | 'round_robin' | 'weighted' | 'sla_priority' | 'rule_based';
}

interface ExpedienteCtx {
  id?: string;
  compania_id?: string | null;
  tipo_siniestro?: string | null;
  prioridad?: string | null;
  codigo_postal?: string | null;
  empresa_facturadora_id?: string | null;
}

/**
 * Sugiere hasta `limit` tramitadores para un expediente dado.
 * Orden de evaluación:
 *   1. Preasignaciones que coincidan (por peso DESC)
 *   2. Regla de reparto activa para la empresa (round_robin, weighted, sla_priority, rule_based)
 *   3. Fallback: tramitador con menor carga absoluta
 */
export async function suggestTramitador(
  exp: ExpedienteCtx,
  supabase: SupabaseClient,
  limit = 3
): Promise<AssignmentSuggestion[]> {
  const empresaId = exp.empresa_facturadora_id ?? null;

  // Cargar tramitadores activos con carga actual
  let cargaQuery = supabase
    .from('v_carga_tramitadores')
    .select('*')
    .eq('activo', true)
    .neq('semaforo', 'rojo')
    .order('porcentaje_carga', { ascending: true });

  if (empresaId) cargaQuery = cargaQuery.eq('empresa_facturadora_id', empresaId);

  const { data: tramitadores } = await cargaQuery;
  if (!tramitadores?.length) return [];

  const cargaMap = new Map(tramitadores.map((t: any) => [t.tramitador_id, t]));

  // ── NIVEL 1: Preasignaciones ─────────────────────────────────
  let preQuery = supabase
    .from('tramitador_reglas_preasignacion')
    .select('*')
    .eq('activa', true)
    .order('peso', { ascending: false });

  if (empresaId) preQuery = preQuery.or(`empresa_facturadora_id.eq.${empresaId},empresa_facturadora_id.is.null`);

  const { data: preRules } = await preQuery;

  const preMatches = (preRules ?? []).filter((r: any) =>
    cargaMap.has(r.tramitador_id) && matchesPreasignacion(r, exp)
  );

  const seen = new Set<string>();
  const result: AssignmentSuggestion[] = [];

  for (const r of preMatches) {
    if (result.length >= limit) break;
    if (seen.has(r.tramitador_id)) continue;
    seen.add(r.tramitador_id);

    const carga = cargaMap.get(r.tramitador_id);
    result.push(mapToSuggestion(carga, 'preasignacion'));
  }

  if (result.length >= limit) return result;

  // ── NIVEL 2: Regla de reparto activa ─────────────────────────
  let reglaQuery = supabase
    .from('reglas_reparto')
    .select('*')
    .eq('activa', true)
    .order('prioridad_orden', { ascending: true })
    .limit(1);

  if (empresaId) reglaQuery = reglaQuery.or(`empresa_facturadora_id.eq.${empresaId},empresa_facturadora_id.is.null`);

  const { data: reglas } = await reglaQuery;
  const regla = reglas?.[0];

  const candidatos = tramitadores.filter((t: any) => !seen.has(t.tramitador_id));
  let ranked = candidatos;

  const tipoRegla = regla?.tipo ?? 'round_robin';

  if (tipoRegla === 'weighted') {
    ranked = applyWeightedRanking(candidatos, regla?.config ?? {});
  } else if (tipoRegla === 'sla_priority') {
    ranked = applySLAPriority(candidatos, exp, regla?.config ?? {});
  }
  // round_robin y manual: ya ordenado por porcentaje_carga asc

  for (const t of ranked) {
    if (result.length >= limit) break;
    if (seen.has(t.tramitador_id)) continue;
    seen.add(t.tramitador_id);
    result.push(mapToSuggestion(t, tipoRegla as any));
  }

  return result;
}

function matchesPreasignacion(rule: any, exp: ExpedienteCtx): boolean {
  if (rule.compania_id && rule.compania_id !== exp.compania_id) return false;
  if (rule.tipo_siniestro && rule.tipo_siniestro !== exp.tipo_siniestro) return false;
  if (rule.prioridad && rule.prioridad !== exp.prioridad) return false;
  if (rule.zona_cp_patron && exp.codigo_postal) {
    const pattern = rule.zona_cp_patron.replace(/%/g, '');
    if (!exp.codigo_postal.startsWith(pattern)) return false;
  }
  return true;
}

function applyWeightedRanking(tramitadores: any[], config: any): any[] {
  const pesos: Record<string, number> = config.pesos ?? {};
  return [...tramitadores].sort((a, b) => {
    // Capacidad libre relativa ponderada
    const pesoA = pesos[a.tramitador_id] ?? 1;
    const pesoB = pesos[b.tramitador_id] ?? 1;
    const libreA = (a.max_expedientes_activos - a.total_activos) * pesoA;
    const libreB = (b.max_expedientes_activos - b.total_activos) * pesoB;
    return libreB - libreA; // mayor espacio ponderado primero
  });
}

function applySLAPriority(tramitadores: any[], exp: ExpedienteCtx, config: any): any[] {
  // Para urgentes, priorizar tramitadores con menor carga de urgentes
  if (exp.prioridad === 'urgente') {
    return [...tramitadores].sort((a, b) => (a.total_urgentes ?? 0) - (b.total_urgentes ?? 0));
  }
  return tramitadores;
}

function mapToSuggestion(
  t: any,
  motivo: AssignmentSuggestion['motivo_sugerencia']
): AssignmentSuggestion {
  return {
    tramitador_id:          t.tramitador_id,
    nombre_completo:        t.nombre_completo,
    porcentaje_carga:       t.porcentaje_carga ?? 0,
    total_activos:          t.total_activos ?? 0,
    max_expedientes_activos: t.max_expedientes_activos,
    semaforo:               t.semaforo as 'verde' | 'amarillo' | 'rojo',
    puede_aceptar:          t.semaforo !== 'rojo',
    motivo_sugerencia:      motivo,
  };
}
