import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

function buildQs(filters: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useVideoperitaciones(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['videoperitaciones', filters],
    queryFn: () => api.get(`/videoperitaciones${buildQs(filters)}`),
  });
}

export function useVideoperitacionDetail(id: string) {
  return useQuery({
    queryKey: ['videoperitacion', id],
    queryFn: () => api.get(`/videoperitaciones/${id}`),
    enabled: !!id,
  });
}

export function useVpPendientesContacto(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['vp-pendientes-contacto', filters],
    queryFn: () => api.get(`/videoperitaciones/pendientes-contacto${buildQs(filters)}`),
  });
}

export function useVpAgenda(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['vp-agenda', filters],
    queryFn: () => api.get(`/videoperitaciones/agenda${buildQs(filters)}`),
  });
}

export function useVpComunicaciones(vpId: string, page: number = 1) {
  return useQuery({
    queryKey: ['vp-comunicaciones', vpId, page],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/comunicaciones?page=${page}`),
    enabled: !!vpId,
  });
}

export function useCreateVideoperitacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/videoperitaciones', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
      qc.invalidateQueries({ queryKey: ['vp-pendientes-contacto'] });
    },
  });
}

export function useRegistrarEncargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/registrar-encargo`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useRegistrarComunicacionVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/registrar-comunicacion`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['vp-comunicaciones', vars.id] });
    },
  });
}

export function useRegistrarIntentoContacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/registrar-intento-contacto`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['vp-pendientes-contacto'] });
    },
  });
}

export function useAgendarVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/agendar`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['vp-agenda'] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useReprogramarVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/reprogramar`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['vp-agenda'] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useCancelarVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/videoperitaciones/${id}/cancelar`, { motivo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
      qc.invalidateQueries({ queryKey: ['vp-agenda'] });
      qc.invalidateQueries({ queryKey: ['vp-pendientes-contacto'] });
    },
  });
}

export function useEnviarLinkVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, link_externo }: { id: string; link_externo?: string }) =>
      api.post(`/videoperitaciones/${id}/enviar-link`, { link_externo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['vp-agenda'] });
    },
  });
}

// ─── Sprint 2: Sessions, Artifacts, Transcripts ───

export function useVpSesiones(vpId: string) {
  return useQuery({
    queryKey: ['vp-sesiones', vpId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/sesiones`),
    enabled: !!vpId,
  });
}

export function useVpArtefactos(vpId: string, tipo?: string) {
  return useQuery({
    queryKey: ['vp-artefactos', vpId, tipo],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/artefactos${tipo ? `?tipo=${tipo}` : ''}`),
    enabled: !!vpId,
  });
}

export function useVpTranscripciones(vpId: string) {
  return useQuery({
    queryKey: ['vp-transcripciones', vpId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/transcripciones`),
    enabled: !!vpId,
  });
}

export function useVpTranscripcionDetail(vpId: string, transcripcionId: string) {
  return useQuery({
    queryKey: ['vp-transcripcion', transcripcionId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/transcripciones/${transcripcionId}`),
    enabled: !!vpId && !!transcripcionId,
  });
}

export function useUploadArtefacto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/artefactos`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-artefactos', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

export function useArtefactoSignedUrl(artefactoId: string) {
  return useQuery({
    queryKey: ['vp-artefacto-signed-url', artefactoId],
    queryFn: () => api.get(`/videoperitaciones/artefactos/${artefactoId}/signed-url`),
    enabled: !!artefactoId,
    staleTime: 30 * 60 * 1000, // 30 min
  });
}

export function useBuscarTranscripcion(q: string, vpId?: string) {
  return useQuery({
    queryKey: ['vp-buscar-transcripcion', q, vpId],
    queryFn: () => api.get(`/videoperitaciones/buscar-transcripcion?q=${encodeURIComponent(q)}${vpId ? `&vp_id=${vpId}` : ''}`),
    enabled: q.length >= 3,
  });
}

// ─── Sprint 3: Cockpit Pericial — Dictámenes, Instrucciones ───

export function useVpDictamenes(vpId: string) {
  return useQuery({
    queryKey: ['vp-dictamenes', vpId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/dictamenes`),
    enabled: !!vpId,
  });
}

export function useVpDictamenDetail(vpId: string, dictamenId: string) {
  return useQuery({
    queryKey: ['vp-dictamen', dictamenId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/dictamenes/${dictamenId}`),
    enabled: !!vpId && !!dictamenId,
  });
}

export function useCreateDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/dictamenes`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

export function useEmitirDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/emitir-dictamen`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useSolicitarMasInformacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/solicitar-mas-informacion`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

export function useAprobarVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/aprobar`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useRechazarVp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/rechazar`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitaciones'] });
    },
  });
}

export function useEmitirInstruccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/instruccion`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-instrucciones', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

export function useVpInstrucciones(vpId: string) {
  return useQuery({
    queryKey: ['vp-instrucciones', vpId],
    queryFn: () => api.get(`/videoperitaciones/${vpId}/instrucciones`),
    enabled: !!vpId,
  });
}

export function useValidarDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/validar-dictamen`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

export function useRechazarDictamen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api.post(`/videoperitaciones/${id}/rechazar-dictamen`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vp-dictamenes', vars.id] });
      qc.invalidateQueries({ queryKey: ['videoperitacion', vars.id] });
    },
  });
}

// ─── Sprint 4: Informes + Valoración ─────────────────────────────────

export function useVpInformes(vpId: string | undefined) {
  return useQuery({
    queryKey: ['vp-informes', vpId],
    queryFn: () => api.get<any[]>(`/videoperitaciones/${vpId}/informes`),
    enabled: !!vpId,
  });
}

export function useVpInformeDetail(vpId: string | undefined, informeId: string | undefined) {
  return useQuery({
    queryKey: ['vp-informe', vpId, informeId],
    queryFn: () => api.get<any>(`/videoperitaciones/${vpId}/informes/${informeId}`),
    enabled: !!vpId && !!informeId,
  });
}

export function useCreateInforme(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, any>) => api.post<any>(`/videoperitaciones/${vpId}/informes`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-informes', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useGuardarBorrador(vpId: string, informeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, any>) => api.post<any>(`/videoperitaciones/${vpId}/informes/${informeId}/guardar-borrador`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-informe', vpId, informeId] }); qc.invalidateQueries({ queryKey: ['vp-informes', vpId] }); },
  });
}

export function useEnviarRevision(vpId: string, informeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<any>(`/videoperitaciones/${vpId}/informes/${informeId}/enviar-revision`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-informe', vpId, informeId] }); qc.invalidateQueries({ queryKey: ['vp-informes', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useValidarInforme(vpId: string, informeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<any>(`/videoperitaciones/${vpId}/informes/${informeId}/validar`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-informe', vpId, informeId] }); qc.invalidateQueries({ queryKey: ['vp-informes', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useRectificarInforme(vpId: string, informeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { motivo: string }) => api.post<any>(`/videoperitaciones/${vpId}/informes/${informeId}/rectificar`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-informe', vpId, informeId] }); qc.invalidateQueries({ queryKey: ['vp-informes', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useVpValoracion(vpId: string | undefined) {
  return useQuery({
    queryKey: ['vp-valoracion', vpId],
    queryFn: () => api.get<any>(`/videoperitaciones/${vpId}/valoracion`),
    enabled: !!vpId,
  });
}

export function useCalcularValoracion(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { lineas: Array<{ partida_baremo_id: string; cantidad: number; observaciones?: string }> }) =>
      api.post<any>(`/videoperitaciones/${vpId}/calcular-valoracion`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-valoracion', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useAddValoracionLinea(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, any>) => api.post<any>(`/videoperitaciones/${vpId}/valoracion/lineas`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-valoracion', vpId] }); },
  });
}

export function useRecalcularValoracion(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<any>(`/videoperitaciones/${vpId}/valoracion/recalcular`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-valoracion', vpId] }); },
  });
}

export function useInformePreview(vpId: string | undefined, informeId: string | undefined) {
  return useQuery({
    queryKey: ['vp-informe-preview', vpId, informeId],
    queryFn: () => api.get<any>(`/videoperitaciones/${vpId}/informes/${informeId}/preview`),
    enabled: !!vpId && !!informeId,
  });
}

// ─── Sprint 5: Facturación + Envío + Documento Final ─────────────────

export function useVpDocumentoFinal(vpId: string | undefined) {
  return useQuery({
    queryKey: ['vp-documento-final', vpId],
    queryFn: () => api.get<any>(`/videoperitaciones/${vpId}/documento-final`),
    enabled: !!vpId,
  });
}

export function useGenerarDocumento(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<any>(`/videoperitaciones/${vpId}/documento-final/generar`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-documento-final', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useVpFacturacion(vpId: string | undefined) {
  return useQuery({
    queryKey: ['vp-facturacion', vpId],
    queryFn: () => api.get<any>(`/videoperitaciones/${vpId}/facturacion`),
    enabled: !!vpId,
  });
}

export function useEmitirFacturaVp(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { serie_id: string; forma_pago?: string; cuenta_bancaria?: string; notas?: string; iva_porcentaje?: number }) =>
      api.post<any>(`/videoperitaciones/${vpId}/emitir-factura`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-facturacion', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useEnviarInforme(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { canal?: string; destinatario_email?: string; destinatario_nombre?: string }) =>
      api.post<any>(`/videoperitaciones/${vpId}/enviar-informe`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-envios', vpId] }); qc.invalidateQueries({ queryKey: ['videoperitacion', vpId] }); },
  });
}

export function useVpEnvios(vpId: string | undefined) {
  return useQuery({
    queryKey: ['vp-envios', vpId],
    queryFn: () => api.get<any[]>(`/videoperitaciones/${vpId}/envios`),
    enabled: !!vpId,
  });
}

export function useReintentarEnvio(vpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envioId: string) => api.post<any>(`/videoperitaciones/${vpId}/envios/${envioId}/reintentar`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vp-envios', vpId] }); },
  });
}
