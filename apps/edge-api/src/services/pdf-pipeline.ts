import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAudit, insertDomainEvent } from './audit';

/**
 * PDF Pipeline — Stub para generación de documentos PDF.
 *
 * Flujo:
 * 1. Al recibir un parte validado, se encola generación de PDF
 * 2. Se registra en tabla `documentos` con estado 'pendiente'
 * 3. Un worker futuro (Cloudflare Queue / cron) procesa la cola
 * 4. Al completar, actualiza estado a 'completado' con storage_path
 *
 * Storage:
 * - Bucket: 'documentos' (privado)
 * - Path: documentos/{expediente_id}/parte_{parte_id}.pdf
 */

export async function enqueuePartePdf(
  supabase: SupabaseClient,
  params: {
    expediente_id: string;
    parte_id: string;
    actor_id: string;
    numero_expediente: string;
  }
): Promise<{ documento_id: string | null; error: string | null }> {
  const storagePath = `documentos/${params.expediente_id}/parte_${params.parte_id}.pdf`;
  const nombre = `Parte_${params.numero_expediente}_${new Date().toISOString().split('T')[0]}.pdf`;

  const { data, error } = await supabase
    .from('documentos')
    .insert({
      expediente_id: params.expediente_id,
      parte_id: params.parte_id,
      tipo: 'parte_operario_pdf',
      storage_path: storagePath,
      nombre,
      generado_automaticamente: true,
      generado_por: params.actor_id,
      estado: 'pendiente',
    })
    .select()
    .single();

  if (error) {
    return { documento_id: null, error: error.message };
  }

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'documentos',
      registro_id: data.id,
      accion: 'INSERT',
      actor_id: params.actor_id,
      cambios: { tipo: 'parte_operario_pdf', parte_id: params.parte_id, estado: 'pendiente' },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: params.expediente_id,
      aggregate_type: 'expediente',
      event_type: 'DocumentoEncolado',
      payload: {
        documento_id: data.id,
        tipo: 'parte_operario_pdf',
        parte_id: params.parte_id,
      },
      actor_id: params.actor_id,
    }),
  ]);

  return { documento_id: data.id, error: null };
}

/**
 * Stub: Procesar documento pendiente.
 * En producción, esto se ejecutará vía Cloudflare Queue o cron.
 * Por ahora solo marca el documento como procesando/error para demostrar el pipeline.
 */
export async function processDocumentStub(
  supabase: SupabaseClient,
  documentoId: string
): Promise<void> {
  // Mark as processing
  await supabase
    .from('documentos')
    .update({ estado: 'procesando' })
    .eq('id', documentoId);

  // In production: generate PDF with a library, upload to storage
  // For now: mark as pending (will be processed by future worker)
}

// GET pending documents count for monitoring
export async function getPendingDocuments(
  supabase: SupabaseClient
): Promise<{ count: number }> {
  const { count } = await supabase
    .from('documentos')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente');

  return { count: count ?? 0 };
}
