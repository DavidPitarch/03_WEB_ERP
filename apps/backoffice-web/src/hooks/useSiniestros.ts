import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  SiniestrosActivosFilters,
  SiniestrosFinalizadosFilters,
  SiniestrosActivosResult,
  SiniestrosFinalizadosResult,
  SeguimientoExpediente,
  SiniestroEstadoCounter,
  UpdateSiniestroRequest,
  CreateIncidenciaRequest,
  UpdateFacturaSiniestroRequest,
  SeguimientoIncidencia,
  ExpedientePresencia,
  TipoCompania,
  EventoCompania,
  TextoPredefinido,
  UpdateComunicacionesAseguradoRequest,
  EnviarSmsRequest,
  EnviarEmailRequest,
  EnviarPanelClienteRequest,
  // B2 types
  SeguimientoPedido,
  TrabajoExpediente,
  NotaInterna,
  ComunicacionAsitur,
  CreatePedidoExpedienteRequest,
  UpdatePedidoExpedienteRequest,
  CreateTrabajoRequest,
  UpdateTrabajoEstadoRequest,
  CreateNotaRequest,
  EnviarMensajeAsiturRequest,
  // B3 types
  CamposAdicionalesExpediente,
  UpsertCamposAdicionalesRequest,
  AdjuntoUploadInitResponse,
  RegistrarAdjuntoRequest,
  EnviarEmailAdjuntosRequest,
  EnviarEncuestaRequest,
  EnviarSmsExpedienteRequest,
  SmsProgramado,
  // B4 types
  EnviarEmailOperarioRequest,
  // Gaps verificación
  ActualizarCampoVisitaRequest,
  PlantillaDocumento,
  GenerarDocumentoExpedienteRequest,
} from '@erp/types';

const BASE = '/siniestros';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQs(filters: object = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Siniestros Activos ───────────────────────────────────────────────────────

export function useSiniestrosActivos(filters: SiniestrosActivosFilters = {}) {
  return useQuery({
    queryKey: ['siniestros', 'activos', filters],
    queryFn: () =>
      api.get<SiniestrosActivosResult>(`${BASE}/activos${buildQs(filters)}`),
    staleTime: 30_000,
  });
}

export function useSiniestrosActivosStats() {
  return useQuery({
    queryKey: ['siniestros', 'activos', 'stats'],
    queryFn: () =>
      api.get<SiniestroEstadoCounter[]>(`${BASE}/activos/stats`),
    staleTime: 60_000,
  });
}

// ─── Siniestros Finalizados ───────────────────────────────────────────────────

export function useSiniestrosFinalizados(filters: SiniestrosFinalizadosFilters = {}) {
  return useQuery({
    queryKey: ['siniestros', 'finalizados', filters],
    queryFn: () =>
      api.get<SiniestrosFinalizadosResult>(`${BASE}/finalizados${buildQs(filters)}`),
    staleTime: 30_000,
  });
}

// ─── Ficha de seguimiento ─────────────────────────────────────────────────────

export function useSeguimiento(id: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'seguimiento', id],
    queryFn: () => api.get<SeguimientoExpediente>(`${BASE}/${id}/seguimiento`),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ─── Listas para filtros ──────────────────────────────────────────────────────

export function useSiniestrosTramitadoresList() {
  return useQuery({
    queryKey: ['siniestros', 'tramitadores-list'],
    queryFn: () =>
      api.get<Array<{ user_id: string; nombre: string; apellidos: string }>>(
        `${BASE}/tramitadores-list`,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useSiniestrosOperariosList() {
  return useQuery({
    queryKey: ['siniestros', 'operarios-list'],
    queryFn: () =>
      api.get<Array<{ id: string; nombre: string; apellidos: string; activo: boolean }>>(
        `${BASE}/operarios-list`,
      ),
    staleTime: 5 * 60_000,
  });
}

// ─── Mutación: actualizar campos operativos ───────────────────────────────────

export function useUpdateSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSiniestroRequest & { id: string }) =>
      api.patch<{ id: string }>(`${BASE}/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.id] });
      qc.invalidateQueries({ queryKey: ['siniestros', 'activos'] });
      qc.invalidateQueries({ queryKey: ['siniestros', 'finalizados'] });
    },
  });
}

// ─── Mutación: crear incidencia ───────────────────────────────────────────────

export function useCrearIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expediente_id, ...data }: CreateIncidenciaRequest) =>
      api.post<SeguimientoIncidencia>(`${BASE}/${expediente_id}/incidencias`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expediente_id] });
    },
  });
}

// ─── Mutación: eliminar incidencia ────────────────────────────────────────────

export function useEliminarIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, incidenciaId }: { expedienteId: string; incidenciaId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${expedienteId}/incidencias/${incidenciaId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── Mutación: actualizar factura (enviada / cobrada) ────────────────────────

export function useUpdateFacturaSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      factura_id,
      ...data
    }: UpdateFacturaSiniestroRequest & { expedienteId: string }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/facturas/${factura_id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestros', 'finalizados'] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 1 — SECCIONES 1-5
// ═══════════════════════════════════════════════════════════════

// ─── S1: Presencia / Bloqueo colaborativo ────────────────────────────────────

export function usePresencia(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'presencia', expedienteId],
    queryFn: () => api.get<ExpedientePresencia | null>(`${BASE}/${expedienteId}/presencia`),
    enabled: !!expedienteId,
    refetchInterval: 25_000, // re-verifica cada 25s
    staleTime: 20_000,
  });
}

export function useAcquirePresencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expedienteId: string) =>
      api.post<ExpedientePresencia>(`${BASE}/${expedienteId}/presencia`, {}),
    onSuccess: (_data, expedienteId) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'presencia', expedienteId] });
    },
  });
}

export function useReleasePresencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, force = false }: { expedienteId: string; force?: boolean }) =>
      api.del<{ released: boolean }>(
        `${BASE}/${expedienteId}/presencia${force ? '?force=true' : ''}`,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'presencia', vars.expedienteId] });
    },
  });
}

// ─── S3: Tipos de compañía ────────────────────────────────────────────────────

export function useTiposCompania(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'tipos-compania', expedienteId],
    queryFn: () => api.get<TipoCompania[]>(`${BASE}/${expedienteId}/tipos-compania`),
    enabled: !!expedienteId,
    staleTime: 60_000,
  });
}

export function useUpdateTiposCompania() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, tipo_ids }: { expedienteId: string; tipo_ids: string[] }) =>
      api.put<{ updated: boolean }>(`${BASE}/${expedienteId}/tipos-compania`, { tipo_ids }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'tipos-compania', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S3: Eventos ─────────────────────────────────────────────────────────────

export function useEventosCompania(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'eventos', expedienteId],
    queryFn: () => api.get<EventoCompania[]>(`${BASE}/${expedienteId}/eventos`),
    enabled: !!expedienteId,
    staleTime: 60_000,
  });
}

export function useEjecutarEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, eventoId }: { expedienteId: string; eventoId: string }) =>
      api.post<{ ejecutado: boolean; evento: string }>(
        `${BASE}/${expedienteId}/eventos/${eventoId}/ejecutar`,
        {},
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S3: Pendiente de ─────────────────────────────────────────────────────────

export function useUpdatePendienteDe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, pendiente_de }: { expedienteId: string; pendiente_de: string | null }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/pendiente-de`, { pendiente_de }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S4: Notificar al asegurado ───────────────────────────────────────────────

export function useNotificarAsegurado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expedienteId: string) =>
      api.post<{ enviado: boolean; canal: string; destinatario: string }>(
        `${BASE}/${expedienteId}/notificar-asegurado`,
        {},
      ),
    onSuccess: (_data, expedienteId) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', expedienteId] });
    },
  });
}

// ─── S5: Textos predefinidos ──────────────────────────────────────────────────

export function useTextosPredefinidos(tipo?: 'sms' | 'email') {
  return useQuery({
    queryKey: ['textos-predefinidos', tipo ?? 'all'],
    queryFn: () =>
      api.get<TextoPredefinido[]>(`${BASE}/textos-predefinidos${tipo ? `?tipo=${tipo}` : ''}`),
    staleTime: 5 * 60_000,
  });
}

// ─── S5: Comunicaciones — envíos ─────────────────────────────────────────────

export function useEnviarSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarSmsRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean }>(`${BASE}/${expedienteId}/comunicaciones/enviar-sms`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEnviarEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarEmailRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean }>(`${BASE}/${expedienteId}/comunicaciones/enviar-email`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEnviarPanelCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarPanelClienteRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean; url: string }>(`${BASE}/${expedienteId}/comunicaciones/enviar-panel-cliente`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEnviarTeleAsistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarPanelClienteRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean; url: string }>(`${BASE}/${expedienteId}/comunicaciones/enviar-teleasistencia`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S5: Actualizar datos de comunicación del asegurado ──────────────────────

export function useUpdateComunicacionesAsegurado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: UpdateComunicacionesAseguradoRequest & { expedienteId: string }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/asegurado/comunicaciones`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 2 — Secciones 7-10
// ═══════════════════════════════════════════════════════════════

// ─── S7: Pedidos inline ───────────────────────────────────────────────────────

export function useCrearPedidoExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: CreatePedidoExpedienteRequest & { expedienteId: string }) =>
      api.post<SeguimientoPedido>(`${BASE}/${expedienteId}/pedidos`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useCambiarEstadoPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      pedidoId,
      ...data
    }: UpdatePedidoExpedienteRequest & { expedienteId: string; pedidoId: string }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/pedidos/${pedidoId}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEliminarPedidoExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, pedidoId }: { expedienteId: string; pedidoId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${expedienteId}/pedidos/${pedidoId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S8: Trabajos expediente ──────────────────────────────────────────────────

export function useTrabajos(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'trabajos', expedienteId],
    queryFn: () => api.get<TrabajoExpediente[]>(`${BASE}/${expedienteId}/trabajos`),
    enabled: !!expedienteId,
    staleTime: 30_000,
  });
}

export function useActualizarEstadoTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      trabajoId,
      estado,
    }: UpdateTrabajoEstadoRequest & { expedienteId: string; trabajoId: string }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/trabajos/${trabajoId}/estado`, { estado }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'trabajos', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useCrearTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: CreateTrabajoRequest & { expedienteId: string }) =>
      api.post<TrabajoExpediente>(`${BASE}/${expedienteId}/trabajos`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'trabajos', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEliminarTrabajo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, trabajoId }: { expedienteId: string; trabajoId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${expedienteId}/trabajos/${trabajoId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'trabajos', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S9: Comunicaciones ASITUR ────────────────────────────────────────────────

export function useComunicacionesAsitur(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'comunicaciones-asitur', expedienteId],
    queryFn: () => api.get<ComunicacionAsitur[]>(`${BASE}/${expedienteId}/comunicaciones-asitur`),
    enabled: !!expedienteId,
    staleTime: 30_000,
  });
}

export function useEnviarMensajeAsitur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarMensajeAsiturRequest & { expedienteId: string }) =>
      api.post<ComunicacionAsitur>(`${BASE}/${expedienteId}/comunicaciones-asitur`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'comunicaciones-asitur', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S10: Notas internas ──────────────────────────────────────────────────────

export function useNotasInternas(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'notas', expedienteId],
    queryFn: () => api.get<NotaInterna[]>(`${BASE}/${expedienteId}/notas`),
    enabled: !!expedienteId,
    staleTime: 30_000,
  });
}

export function useCrearNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: CreateNotaRequest & { expedienteId: string }) =>
      api.post<NotaInterna>(`${BASE}/${expedienteId}/notas`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'notas', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useMarcarNotaRealizada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      notaId,
      realizado,
    }: { expedienteId: string; notaId: string; realizado: boolean }) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/notas/${notaId}/realizado`, { realizado }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'notas', vars.expedienteId] });
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  BLOQUE 3 — Secciones 11-15
// ═══════════════════════════════════════════════════════════════

// ─── S11: Actualizar incidencia ───────────────────────────────────────────────

export function useActualizarIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      incidenciaId,
      ...data
    }: { expedienteId: string; incidenciaId: string } & Record<string, unknown>) =>
      api.patch<{ id: string }>(`${BASE}/${expedienteId}/incidencias/${incidenciaId}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S12: Encuesta ────────────────────────────────────────────────────────────

export function useEnviarEncuesta() {
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarEncuestaRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean }>(`${BASE}/${expedienteId}/encuesta/enviar`, data),
  });
}

// ─── S13: Campos adicionales informe fotográfico ──────────────────────────────

export function useCamposAdicionales(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'campos-adicionales', expedienteId],
    queryFn: () => api.get<CamposAdicionalesExpediente | null>(`${BASE}/${expedienteId}/campos-adicionales`),
    enabled: !!expedienteId,
    staleTime: 60_000,
  });
}

export function useGuardarCamposAdicionales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: UpsertCamposAdicionalesRequest & { expedienteId: string }) =>
      api.post<CamposAdicionalesExpediente>(`${BASE}/${expedienteId}/campos-adicionales`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'campos-adicionales', vars.expedienteId] });
    },
  });
}

// ─── S14: Adjuntos ────────────────────────────────────────────────────────────

export function useIniciarSubidaAdjunto() {
  return useMutation({
    mutationFn: ({
      expedienteId,
      nombre_original,
      mime_type,
    }: { expedienteId: string; nombre_original: string; mime_type?: string }) =>
      api.post<AdjuntoUploadInitResponse>(`${BASE}/${expedienteId}/adjuntos/init-upload`, {
        nombre_original,
        mime_type,
      }),
  });
}

export function useRegistrarAdjunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: RegistrarAdjuntoRequest & { expedienteId: string }) =>
      api.post<{ id: string }>(`${BASE}/${expedienteId}/adjuntos`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEliminarAdjunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, adjuntoId }: { expedienteId: string; adjuntoId: string }) =>
      api.del<{ deleted: boolean }>(`${BASE}/${expedienteId}/adjuntos/${adjuntoId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

export function useEnviarEmailAdjuntos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarEmailAdjuntosRequest & { expedienteId: string }) =>
      api.post<{ enviado: boolean }>(`${BASE}/${expedienteId}/email-adjuntos`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S15: SMS programado ──────────────────────────────────────────────────────

export function useEnviarSmsExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarSmsExpedienteRequest & { expedienteId: string }) =>
      api.post<SmsProgramado>(`${BASE}/${expedienteId}/sms-programado`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── S16: Email al operario ───────────────────────────────────────────────────

export function useEnviarEmailOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: EnviarEmailOperarioRequest & { expedienteId: string }) =>
      api.post<{ id: string }>(`${BASE}/${expedienteId}/email-operario`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// ─── Gaps de verificación ─────────────────────────────────────────────────────

// G2: campo_2 por visita
export function useActualizarCampoVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expedienteId,
      visitaId,
      ...data
    }: ActualizarCampoVisitaRequest & { expedienteId: string; visitaId: string }) =>
      api.patch<{ id: string; campo_2: string | null }>(`${BASE}/${expedienteId}/visitas/${visitaId}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

// G3: plantillas de documento
export function usePlantillasExpediente(expedienteId: string | null) {
  return useQuery({
    queryKey: ['siniestro', 'plantillas', expedienteId],
    queryFn: () => api.get<PlantillaDocumento[]>(`${BASE}/${expedienteId}/plantillas`),
    enabled: !!expedienteId,
    staleTime: 120_000,
  });
}

export function useGenerarDocumentoExpediente() {
  return useMutation({
    mutationFn: ({ expedienteId, ...data }: GenerarDocumentoExpedienteRequest & { expedienteId: string }) =>
      api.post<{ generado: boolean }>(`${BASE}/${expedienteId}/generar-documento`, data),
  });
}

// G4: firma STE email por visita
export function useEnviarFirmaEmailVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expedienteId, visitaId }: { expedienteId: string; visitaId: string }) =>
      api.post<{ enviado: boolean }>(`${BASE}/${expedienteId}/visitas/${visitaId}/firma-email`, {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['siniestro', 'seguimiento', vars.expedienteId] });
    },
  });
}

