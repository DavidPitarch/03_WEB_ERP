import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useVideoperitacionDetail,
  useVpComunicaciones,
  useRegistrarEncargo,
  useRegistrarComunicacionVp,
  useRegistrarIntentoContacto,
  useAgendarVp,
  useReprogramarVp,
  useCancelarVp,
  useEnviarLinkVp,
  useVpSesiones,
  useVpArtefactos,
  useVpTranscripciones,
  useUploadArtefacto,
  useVpDictamenes,
  useCreateDictamen,
  useEmitirDictamen,
  useAprobarVp,
  useRechazarVp,
  useSolicitarMasInformacion,
  useEmitirInstruccion,
  useVpInstrucciones,
  useValidarDictamen,
  useRechazarDictamen,
  useVpInformes,
  useVpInformeDetail,
  useCreateInforme,
  useGuardarBorrador,
  useEnviarRevision,
  useValidarInforme,
  useRectificarInforme,
  useVpValoracion,
  useCalcularValoracion,
  useAddValoracionLinea,
  useRecalcularValoracion,
  useVpDocumentoFinal,
  useGenerarDocumento,
  useVpFacturacion,
  useEmitirFacturaVp,
  useEnviarInforme,
  useVpEnvios,
  useReintentarEnvio,
} from '@/hooks/useVideoperitaciones';
import { VP_ESTADOS, VP_COMUNICACION_TIPOS, VP_ARTEFACTO_TIPOS, VP_INSTRUCCION_TIPOS, VP_INFORME_ESTADOS, VP_VALORACION_ESTADOS, VP_DOCUMENTO_ESTADOS, VP_ENVIO_ESTADOS } from '@erp/types';

const ESTADO_BADGE: Record<string, string> = Object.fromEntries(
  VP_ESTADOS.map((e) => [e, `badge-vp-${e}`]),
);

export function VideoperitacionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useVideoperitacionDetail(id!);
  const { data: comData } = useVpComunicaciones(id!, 1);

  const registrarEncargo = useRegistrarEncargo();
  const registrarCom = useRegistrarComunicacionVp();
  const registrarIntento = useRegistrarIntentoContacto();
  const agendarMut = useAgendarVp();
  const reprogramarMut = useReprogramarVp();
  const cancelarMut = useCancelarVp();
  const enviarLinkMut = useEnviarLinkVp();

  // Encargo form
  const [showEncargo, setShowEncargo] = useState(false);
  const [encargoTipo, setEncargoTipo] = useState<'hoja_encargo' | 'declaracion_siniestro'>('hoja_encargo');
  const [encargoContenido, setEncargoContenido] = useState('');

  // Comunicacion form
  const [comTipo, setComTipo] = useState<string>('nota_interna');
  const [comEmisor, setComEmisor] = useState('');
  const [comResultado, setComResultado] = useState('');
  const [comContenido, setComContenido] = useState('');

  // Intento form
  const [showIntento, setShowIntento] = useState(false);
  const [intentoCanal, setIntentoCanal] = useState<'telefono' | 'email' | 'sms'>('telefono');
  const [intentoResultado, setIntentoResultado] = useState('');
  const [intentoNotas, setIntentoNotas] = useState('');

  // Agenda form
  const [showAgendar, setShowAgendar] = useState(false);
  const [agFecha, setAgFecha] = useState('');
  const [agHoraInicio, setAgHoraInicio] = useState('');
  const [agHoraFin, setAgHoraFin] = useState('');
  const [agNotas, setAgNotas] = useState('');

  // Cancelar form
  const [showCancelar, setShowCancelar] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Enviar link
  const [linkExterno, setLinkExterno] = useState('');

  // Sprint 2: Upload artefacto
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('');
  const [uploadNombre, setUploadNombre] = useState('');
  const [uploadMime, setUploadMime] = useState('');
  const [uploadPath, setUploadPath] = useState('');
  const [uploadNotas, setUploadNotas] = useState('');
  const [uploadScope, setUploadScope] = useState<'office' | 'perito' | 'all'>('office');

  // Sprint 2: Transcripciones
  const [selectedTranscripcion, setSelectedTranscripcion] = useState<string | null>(null);

  // Sprint 3: Cockpit pericial
  const [showDictamen, setShowDictamen] = useState(false);
  const [dictConclusiones, setDictConclusiones] = useState('');
  const [dictObservaciones, setDictObservaciones] = useState('');
  const [dictRecomendaciones, setDictRecomendaciones] = useState('');
  const [showRechazo, setShowRechazo] = useState(false);
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [solicitudInfo, setSolicitudInfo] = useState('');
  const [showInstruccion, setShowInstruccion] = useState(false);
  const [instrTipo, setInstrTipo] = useState('continuidad');
  const [instrDescripcion, setInstrDescripcion] = useState('');

  // Sprint 4: Informes + Valoración
  const [selectedInformeId, setSelectedInformeId] = useState<string | null>(null);
  const [showInformeEditor, setShowInformeEditor] = useState(false);
  const [showValoracionPanel, setShowValoracionPanel] = useState(false);
  const [rectificarMotivo, setRectificarMotivo] = useState('');
  const [showRectificarModal, setShowRectificarModal] = useState(false);

  const vp: any = data && 'data' in data ? data.data : null;
  const comunicaciones: any[] = comData && 'data' in comData ? (comData.data as any)?.items ?? [] : [];

  if (isLoading) return <div className="loading">Cargando videoperitacion...</div>;
  if (!vp) return <div className="empty-state">Videoperitacion no encontrada</div>;

  return (
    <div className="vp-detail-sections">
      {/* Header */}
      <div className="vp-section">
        <div className="page-header">
          <h2>{vp.numero_caso}</h2>
          <span className={`badge ${ESTADO_BADGE[vp.estado] ?? ''}`}>{vp.estado.replace(/_/g, ' ')}</span>
          <span className={`badge badge-prioridad-${vp.prioridad}`}>{vp.prioridad}</span>
        </div>
        <p>
          Expediente: <Link to={`/expedientes/${vp.expediente_id}`}>{vp.expedientes?.numero_expediente ?? vp.expediente_id}</Link>
          {' | '}Perito: {vp.peritos ? `${vp.peritos.nombre} ${vp.peritos.apellidos}` : 'Sin asignar'}
          {vp.deadline && <> | Deadline: {new Date(vp.deadline).toLocaleDateString('es-ES')}</>}
        </p>
      </div>

      {/* Encargos */}
      <div className="vp-section">
        <h3>Encargos</h3>
        {vp.encargos?.length > 0 ? (
          <ul>
            {vp.encargos.map((enc: any) => (
              <li key={enc.id}>
                <strong>{enc.tipo.replace(/_/g, ' ')}</strong> — {enc.contenido.substring(0, 100)}
                <span className="vp-com-meta"> ({new Date(enc.created_at).toLocaleString('es-ES')})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">Sin encargos registrados</p>
        )}
        <button className="btn btn-primary" onClick={() => setShowEncargo(true)} style={{ marginTop: '0.5rem' }}>Registrar encargo</button>

        {showEncargo && (
          <div className="modal-overlay" onClick={() => setShowEncargo(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Registrar encargo</h3>
              <div className="form-group">
                <label>Tipo</label>
                <select value={encargoTipo} onChange={(e) => setEncargoTipo(e.target.value as any)} className="form-input">
                  <option value="hoja_encargo">Hoja de encargo</option>
                  <option value="declaracion_siniestro">Declaracion del siniestro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contenido</label>
                <textarea value={encargoContenido} onChange={(e) => setEncargoContenido(e.target.value)} className="form-input" rows={4} />
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setShowEncargo(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  registrarEncargo.mutate({ id: id!, tipo: encargoTipo, contenido: encargoContenido }, {
                    onSuccess: () => { setShowEncargo(false); setEncargoContenido(''); },
                  });
                }} disabled={registrarEncargo.isPending}>
                  {registrarEncargo.isPending ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comunicaciones */}
      <div className="vp-section">
        <h3>Comunicaciones <span className="vp-intentos-badge">{vp.intentos_contacto_count ?? 0} intentos</span></h3>
        <div className="vp-comunicaciones-list">
          {comunicaciones.length === 0 ? (
            <p className="empty-state">Sin comunicaciones</p>
          ) : (
            comunicaciones.map((com: any) => (
              <div key={com.id} className="vp-com-item">
                <strong>{com.tipo.replace(/_/g, ' ')}</strong>
                {com.emisor_tipo && <> — {com.emisor_tipo}</>}
                {com.resultado && <> — {com.resultado}</>}
                <div>{com.contenido}</div>
                <div className="vp-com-meta">{com.actor_nombre} — {new Date(com.created_at).toLocaleString('es-ES')}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={comTipo} onChange={(e) => setComTipo(e.target.value)} className="form-input" style={{ flex: 1 }}>
              {VP_COMUNICACION_TIPOS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={comEmisor} onChange={(e) => setComEmisor(e.target.value)} className="form-input" style={{ flex: 1 }}>
              <option value="">Emisor (opcional)</option>
              <option value="oficina">Oficina</option>
              <option value="cliente">Cliente</option>
              <option value="compania">Compania</option>
              <option value="perito">Perito</option>
            </select>
          </div>
          <input type="text" value={comResultado} onChange={(e) => setComResultado(e.target.value)} placeholder="Resultado" className="form-input" />
          <textarea value={comContenido} onChange={(e) => setComContenido(e.target.value)} placeholder="Contenido de la comunicacion" className="form-input" rows={2} />
          <button className="btn btn-primary" onClick={() => {
            registrarCom.mutate({
              id: id!, tipo: comTipo, emisor_tipo: comEmisor || null, resultado: comResultado || null, contenido: comContenido,
            }, { onSuccess: () => { setComContenido(''); setComResultado(''); } });
          }} disabled={registrarCom.isPending || !comContenido}>
            {registrarCom.isPending ? 'Registrando...' : 'Registrar comunicacion'}
          </button>
        </div>
        <button className="btn" onClick={() => setShowIntento(true)} style={{ marginTop: '0.5rem' }}>Registrar intento de contacto</button>

        {showIntento && (
          <div className="modal-overlay" onClick={() => setShowIntento(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Registrar intento de contacto</h3>
              <div className="form-group">
                <label>Canal</label>
                <select value={intentoCanal} onChange={(e) => setIntentoCanal(e.target.value as any)} className="form-input">
                  <option value="telefono">Telefono</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="form-group">
                <label>Resultado</label>
                <input type="text" value={intentoResultado} onChange={(e) => setIntentoResultado(e.target.value)} className="form-input" placeholder="ej: contactado, no_contesta, buzon_voz" />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea value={intentoNotas} onChange={(e) => setIntentoNotas(e.target.value)} className="form-input" rows={2} />
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setShowIntento(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  registrarIntento.mutate({ id: id!, canal: intentoCanal, resultado: intentoResultado, notas: intentoNotas || null }, {
                    onSuccess: () => { setShowIntento(false); setIntentoResultado(''); setIntentoNotas(''); },
                  });
                }} disabled={registrarIntento.isPending || !intentoResultado}>
                  {registrarIntento.isPending ? 'Registrando...' : 'Registrar intento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agenda */}
      <div className="vp-section">
        <h3>Agenda</h3>
        {vp.agenda_activa ? (
          <div className="vp-agenda-card">
            <div className="vp-agenda-date">{new Date(vp.agenda_activa.fecha).toLocaleDateString('es-ES')}</div>
            <div>
              <div>{vp.agenda_activa.hora_inicio} — {vp.agenda_activa.hora_fin}</div>
              <div className="vp-com-meta">Estado: {vp.agenda_activa.estado}</div>
              {vp.agenda_activa.link_enviado_at && <div className="vp-com-meta">Link enviado: {new Date(vp.agenda_activa.link_enviado_at).toLocaleString('es-ES')}</div>}
              {vp.agenda_activa.notas && <div className="vp-com-meta">{vp.agenda_activa.notas}</div>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={() => setShowAgendar(true)}>Reprogramar</button>
              <button className="btn btn-danger" onClick={() => setShowCancelar(true)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <p className="empty-state">Sin cita agendada</p>
            <button className="btn btn-primary" onClick={() => setShowAgendar(true)} style={{ marginTop: '0.5rem' }}>Agendar</button>
          </>
        )}

        {showAgendar && (
          <div className="modal-overlay" onClick={() => setShowAgendar(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>{vp.agenda_activa ? 'Reprogramar' : 'Agendar'} videoperitacion</h3>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={agFecha} onChange={(e) => setAgFecha(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label>Hora inicio</label>
                <input type="time" value={agHoraInicio} onChange={(e) => setAgHoraInicio(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label>Hora fin</label>
                <input type="time" value={agHoraFin} onChange={(e) => setAgHoraFin(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea value={agNotas} onChange={(e) => setAgNotas(e.target.value)} className="form-input" rows={2} />
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setShowAgendar(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  const mut = vp.agenda_activa ? reprogramarMut : agendarMut;
                  mut.mutate({ id: id!, fecha: agFecha, hora_inicio: agHoraInicio, hora_fin: agHoraFin, notas: agNotas || undefined }, {
                    onSuccess: () => { setShowAgendar(false); setAgFecha(''); setAgHoraInicio(''); setAgHoraFin(''); setAgNotas(''); },
                  });
                }} disabled={agendarMut.isPending || reprogramarMut.isPending || !agFecha || !agHoraInicio || !agHoraFin}>
                  {(agendarMut.isPending || reprogramarMut.isPending) ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enviar enlace */}
      <div className="vp-section">
        <h3>Enviar enlace de videoperitacion</h3>
        {vp.estado === 'agendado' || vp.estado === 'link_enviado' ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="url" value={linkExterno} onChange={(e) => setLinkExterno(e.target.value)} placeholder="URL del enlace externo (opcional)" className="form-input" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={() => {
              enviarLinkMut.mutate({ id: id!, link_externo: linkExterno || undefined }, {
                onSuccess: () => setLinkExterno(''),
              });
            }} disabled={enviarLinkMut.isPending}>
              {enviarLinkMut.isPending ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </div>
        ) : (
          <p className="vp-com-meta">Debe estar en estado agendado para enviar el enlace</p>
        )}
      </div>

      {/* Cancelar modal */}
      {showCancelar && (
        <div className="modal-overlay" onClick={() => setShowCancelar(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Cancelar videoperitacion</h3>
            <div className="form-group">
              <label>Motivo de cancelacion *</label>
              <textarea value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCancelar(false)}>Volver</button>
              <button className="btn btn-danger" onClick={() => {
                cancelarMut.mutate({ id: id!, motivo: cancelMotivo }, {
                  onSuccess: () => { setShowCancelar(false); setCancelMotivo(''); },
                });
              }} disabled={cancelarMut.isPending || !cancelMotivo}>
                {cancelarMut.isPending ? 'Cancelando...' : 'Confirmar cancelacion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consentimientos */}
      <div className="vp-section">
        <h3>Consentimientos</h3>
        {vp.consentimientos?.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {vp.consentimientos.map((c: any) => (
              <span key={c.id} className={`badge ${c.estado === 'otorgado' ? 'badge-vp-contactado' : c.estado === 'denegado' || c.estado === 'revocado' ? 'badge-vp-cancelado' : 'badge-vp-pendiente_contacto'}`}>
                {c.tipo.replace(/_/g, ' ')}: {c.estado}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-state">Sin consentimientos registrados</p>
        )}
      </div>

      {/* Sesiones */}
      <SesionesSection vpId={id!} />

      {/* Artefactos */}
      <ArtefactosSection vpId={id!} showUpload={showUpload} setShowUpload={setShowUpload}
        uploadTipo={uploadTipo} setUploadTipo={setUploadTipo}
        uploadNombre={uploadNombre} setUploadNombre={setUploadNombre}
        uploadMime={uploadMime} setUploadMime={setUploadMime}
        uploadPath={uploadPath} setUploadPath={setUploadPath}
        uploadNotas={uploadNotas} setUploadNotas={setUploadNotas}
        uploadScope={uploadScope} setUploadScope={setUploadScope}
      />

      {/* Transcripciones */}
      <TranscripcionesSection vpId={id!} selectedTranscripcion={selectedTranscripcion} setSelectedTranscripcion={setSelectedTranscripcion} />

      {/* Dictámenes — Cockpit Pericial */}
      <DictamenesSection vpId={id!} showDictamen={showDictamen} setShowDictamen={setShowDictamen}
        dictConclusiones={dictConclusiones} setDictConclusiones={setDictConclusiones}
        dictObservaciones={dictObservaciones} setDictObservaciones={setDictObservaciones}
        dictRecomendaciones={dictRecomendaciones} setDictRecomendaciones={setDictRecomendaciones}
        showRechazo={showRechazo} setShowRechazo={setShowRechazo}
        rechazoMotivo={rechazoMotivo} setRechazoMotivo={setRechazoMotivo}
        showSolicitud={showSolicitud} setShowSolicitud={setShowSolicitud}
        solicitudInfo={solicitudInfo} setSolicitudInfo={setSolicitudInfo}
      />

      {/* Instrucciones periciales */}
      <InstruccionesSection vpId={id!} showInstruccion={showInstruccion} setShowInstruccion={setShowInstruccion}
        instrTipo={instrTipo} setInstrTipo={setInstrTipo}
        instrDescripcion={instrDescripcion} setInstrDescripcion={setInstrDescripcion}
      />
      {/* Informes — Sprint 4 */}
      <InformesSection vpId={vp.id} expedienteId={vp.expediente_id} vpEstado={vp.estado} userRoles={[]} />

      {/* Valoración — Sprint 4 */}
      <ValoracionSection vpId={vp.id} expedienteId={vp.expediente_id} vpEstado={vp.estado} userRoles={[]} />

      {/* Documento Final — Sprint 5 */}
      <DocumentoFinalSection vpId={vp.id} vpEstado={vp.estado} userRoles={[]} />

      {/* Facturación VP — Sprint 5 */}
      <FacturacionVpSection vpId={vp.id} vpEstado={vp.estado} userRoles={[]} />

      {/* Envíos — Sprint 5 */}
      <EnviosSection vpId={vp.id} vpEstado={vp.estado} userRoles={[]} />
    </div>
  );
}

// ─── Sprint 2 Sub-components ───

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SesionesSection({ vpId }: { vpId: string }) {
  const { data } = useVpSesiones(vpId);
  const sesiones: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];

  return (
    <div className="vp-section">
      <h3>Sesiones</h3>
      {sesiones.length === 0 ? (
        <p className="empty-state">Sin sesiones registradas</p>
      ) : (
        <table className="vp-sesiones-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Session ID</th>
              <th>Iniciada</th>
              <th>Finalizada</th>
              <th>Duracion</th>
              <th>Participantes</th>
              <th>Incidencias</th>
            </tr>
          </thead>
          <tbody>
            {sesiones.map((s: any) => (
              <tr key={s.id}>
                <td><span className={`badge badge-vp-sesion-${s.estado}`}>{s.estado}</span></td>
                <td>{s.external_session_id ?? '—'}</td>
                <td>{s.iniciada_at ? new Date(s.iniciada_at).toLocaleString('es-ES') : '—'}</td>
                <td>{s.finalizada_at ? new Date(s.finalizada_at).toLocaleString('es-ES') : '—'}</td>
                <td>{formatDuration(s.duracion_segundos)}</td>
                <td>{s.participantes_conectados ?? '—'}</td>
                <td>{s.incidencias ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ArtefactosSection({ vpId, showUpload, setShowUpload, uploadTipo, setUploadTipo, uploadNombre, setUploadNombre, uploadMime, setUploadMime, uploadPath, setUploadPath, uploadNotas, setUploadNotas, uploadScope, setUploadScope }: {
  vpId: string; showUpload: boolean; setShowUpload: (v: boolean) => void;
  uploadTipo: string; setUploadTipo: (v: string) => void;
  uploadNombre: string; setUploadNombre: (v: string) => void;
  uploadMime: string; setUploadMime: (v: string) => void;
  uploadPath: string; setUploadPath: (v: string) => void;
  uploadNotas: string; setUploadNotas: (v: string) => void;
  uploadScope: string; setUploadScope: (v: any) => void;
}) {
  const [filterTipo, setFilterTipo] = useState('');
  const { data } = useVpArtefactos(vpId, filterTipo || undefined);
  const artefactos: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];
  const uploadMut = useUploadArtefacto();

  const handleUpload = () => {
    uploadMut.mutate({
      id: vpId, tipo: uploadTipo, nombre_original: uploadNombre, mime_type: uploadMime,
      storage_path: uploadPath, notas: uploadNotas || undefined, visibility_scope: uploadScope,
    }, {
      onSuccess: () => {
        setShowUpload(false); setUploadTipo(''); setUploadNombre(''); setUploadMime(''); setUploadPath(''); setUploadNotas('');
      },
    });
  };

  return (
    <div className="vp-section">
      <h3>Artefactos</h3>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          <option value="">Todos los tipos</option>
          {VP_ARTEFACTO_TIPOS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ marginLeft: 'auto' }}>Subir artefacto</button>
      </div>
      {artefactos.length === 0 ? (
        <p className="empty-state">Sin artefactos</p>
      ) : (
        <div className="vp-artefactos-grid">
          {artefactos.map((a: any) => (
            <div key={a.id} className="vp-artefacto-card">
              <div className="artefacto-tipo">{a.tipo}</div>
              <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>{a.nombre_original}</div>
              <div className="artefacto-meta">
                {a.mime_type} &middot; {formatSize(a.tamano_bytes)}
              </div>
              <div className="artefacto-meta">
                Origen: {a.origen ?? '—'} &middot; {a.estado_disponibilidad ?? '—'} &middot; {a.visibility_scope ?? '—'}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                onClick={() => window.open(`/api/videoperitaciones/artefactos/${a.id}/signed-url`, '_blank')}>
                Ver
              </button>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Subir artefacto</h3>
            <div className="form-group">
              <label>Tipo</label>
              <select value={uploadTipo} onChange={(e) => setUploadTipo(e.target.value)} className="form-input">
                <option value="">Seleccionar tipo</option>
                {VP_ARTEFACTO_TIPOS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nombre original</label>
              <input type="text" value={uploadNombre} onChange={(e) => setUploadNombre(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>MIME type</label>
              <input type="text" value={uploadMime} onChange={(e) => setUploadMime(e.target.value)} className="form-input" placeholder="ej: image/jpeg" />
            </div>
            <div className="form-group">
              <label>Storage path</label>
              <input type="text" value={uploadPath} onChange={(e) => setUploadPath(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea value={uploadNotas} onChange={(e) => setUploadNotas(e.target.value)} className="form-input" rows={2} />
            </div>
            <div className="form-group">
              <label>Visibilidad</label>
              <select value={uploadScope} onChange={(e) => setUploadScope(e.target.value)} className="form-input">
                <option value="office">Oficina</option>
                <option value="perito">Perito</option>
                <option value="all">Todos</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowUpload(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleUpload}
                disabled={uploadMut.isPending || !uploadTipo || !uploadNombre || !uploadMime || !uploadPath}>
                {uploadMut.isPending ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DictamenesSection({ vpId, showDictamen, setShowDictamen, dictConclusiones, setDictConclusiones, dictObservaciones, setDictObservaciones, dictRecomendaciones, setDictRecomendaciones, showRechazo, setShowRechazo, rechazoMotivo, setRechazoMotivo, showSolicitud, setShowSolicitud, solicitudInfo, setSolicitudInfo }: {
  vpId: string; showDictamen: boolean; setShowDictamen: (v: boolean) => void;
  dictConclusiones: string; setDictConclusiones: (v: string) => void;
  dictObservaciones: string; setDictObservaciones: (v: string) => void;
  dictRecomendaciones: string; setDictRecomendaciones: (v: string) => void;
  showRechazo: boolean; setShowRechazo: (v: boolean) => void;
  rechazoMotivo: string; setRechazoMotivo: (v: string) => void;
  showSolicitud: boolean; setShowSolicitud: (v: boolean) => void;
  solicitudInfo: string; setSolicitudInfo: (v: string) => void;
}) {
  const { data } = useVpDictamenes(vpId);
  const dictamenes: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];
  const createDictamen = useCreateDictamen();
  const emitirDictamen = useEmitirDictamen();
  const aprobarVp = useAprobarVp();
  const rechazarVp = useRechazarVp();
  const solicitarInfo = useSolicitarMasInformacion();
  const validarDictamen = useValidarDictamen();
  const rechazarDictamen = useRechazarDictamen();

  return (
    <div className="vp-section">
      <h3>Dictámenes — Cockpit Pericial</h3>
      {dictamenes.length === 0 ? (
        <p className="empty-state">Sin dictámenes</p>
      ) : (
        dictamenes.map((d: any) => (
          <div key={d.id} className="vp-dictamen-card">
            <div className="dict-header">
              <div>
                <strong>v{d.version}</strong>
                <span className={`badge badge-vp-dict-${d.estado}`} style={{ marginLeft: '0.5rem' }}>{d.estado.replace(/_/g, ' ')}</span>
                {d.tipo_resolucion && <span className="badge" style={{ marginLeft: '0.25rem', background: '#e0e7ff', color: '#3b5bdb' }}>{d.tipo_resolucion.replace(/_/g, ' ')}</span>}
              </div>
              {d.impacto_expediente && <span className="vp-com-meta">Impacto: {d.impacto_expediente.replace(/_/g, ' ')}</span>}
            </div>
            {d.conclusiones && <div className="dict-conclusiones">{d.conclusiones.length > 200 ? d.conclusiones.substring(0, 200) + '...' : d.conclusiones}</div>}
            <div className="dict-meta">
              {d.emitido_at && <>Emitido: {new Date(d.emitido_at).toLocaleString('es-ES')} | </>}
              Creado: {new Date(d.created_at).toLocaleString('es-ES')}
            </div>
            <div className="vp-dictamen-actions">
              {d.estado === 'borrador' && (
                <button className="btn btn-primary" onClick={() => emitirDictamen.mutate({ id: vpId, dictamen_id: d.id })} disabled={emitirDictamen.isPending}>
                  {emitirDictamen.isPending ? 'Emitiendo...' : 'Emitir'}
                </button>
              )}
              {d.estado === 'emitido' && (
                <>
                  <button className="btn btn-success" onClick={() => aprobarVp.mutate({ id: vpId, dictamen_id: d.id, conclusiones: d.conclusiones })} disabled={aprobarVp.isPending}>
                    {aprobarVp.isPending ? 'Aprobando...' : 'Aprobar'}
                  </button>
                  <button className="btn btn-danger" onClick={() => setShowRechazo(true)}>Rechazar</button>
                  <button className="btn btn-warning" onClick={() => setShowSolicitud(true)}>Solicitar info</button>
                  <button className="btn btn-secondary" onClick={() => validarDictamen.mutate({ id: vpId, dictamen_id: d.id })} disabled={validarDictamen.isPending}>
                    {validarDictamen.isPending ? 'Validando...' : 'Validar'}
                  </button>
                  <button className="btn btn-outline-danger" onClick={() => rechazarDictamen.mutate({ id: vpId, dictamen_id: d.id, motivo: 'Devuelto para revisión' })} disabled={rechazarDictamen.isPending}>
                    {rechazarDictamen.isPending ? 'Devolviendo...' : 'Devolver'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={() => setShowDictamen(true)} style={{ marginTop: '0.75rem' }}>Crear borrador</button>

      {showDictamen && (
        <div className="modal-overlay" onClick={() => setShowDictamen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Crear borrador de dictamen</h3>
            <div className="form-group">
              <label>Conclusiones</label>
              <textarea value={dictConclusiones} onChange={(e) => setDictConclusiones(e.target.value)} className="form-input" rows={4} />
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea value={dictObservaciones} onChange={(e) => setDictObservaciones(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="form-group">
              <label>Recomendaciones</label>
              <textarea value={dictRecomendaciones} onChange={(e) => setDictRecomendaciones(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowDictamen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                createDictamen.mutate({ id: vpId, conclusiones: dictConclusiones, observaciones: dictObservaciones || null, recomendaciones: dictRecomendaciones || null }, {
                  onSuccess: () => { setShowDictamen(false); setDictConclusiones(''); setDictObservaciones(''); setDictRecomendaciones(''); },
                });
              }} disabled={createDictamen.isPending || !dictConclusiones}>
                {createDictamen.isPending ? 'Creando...' : 'Crear borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRechazo && (
        <div className="modal-overlay" onClick={() => setShowRechazo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Rechazar videoperitación</h3>
            <div className="form-group">
              <label>Motivo de rechazo *</label>
              <textarea value={rechazoMotivo} onChange={(e) => setRechazoMotivo(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowRechazo(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => {
                rechazarVp.mutate({ id: vpId, motivo_rechazo: rechazoMotivo }, {
                  onSuccess: () => { setShowRechazo(false); setRechazoMotivo(''); },
                });
              }} disabled={rechazarVp.isPending || !rechazoMotivo}>
                {rechazarVp.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSolicitud && (
        <div className="modal-overlay" onClick={() => setShowSolicitud(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Solicitar más información</h3>
            <div className="form-group">
              <label>Información solicitada *</label>
              <textarea value={solicitudInfo} onChange={(e) => setSolicitudInfo(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSolicitud(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                solicitarInfo.mutate({ id: vpId, informacion_solicitada: solicitudInfo }, {
                  onSuccess: () => { setShowSolicitud(false); setSolicitudInfo(''); },
                });
              }} disabled={solicitarInfo.isPending || !solicitudInfo}>
                {solicitarInfo.isPending ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstruccionesSection({ vpId, showInstruccion, setShowInstruccion, instrTipo, setInstrTipo, instrDescripcion, setInstrDescripcion }: {
  vpId: string; showInstruccion: boolean; setShowInstruccion: (v: boolean) => void;
  instrTipo: string; setInstrTipo: (v: string) => void;
  instrDescripcion: string; setInstrDescripcion: (v: string) => void;
}) {
  const { data } = useVpInstrucciones(vpId);
  const instrucciones: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];
  const emitirInstruccion = useEmitirInstruccion();

  return (
    <div className="vp-section">
      <h3>Instrucciones periciales</h3>
      {instrucciones.length === 0 ? (
        <p className="empty-state">Sin instrucciones</p>
      ) : (
        instrucciones.map((instr: any) => (
          <div key={instr.id} className="vp-instruccion-card">
            <div className="instr-header">
              <span className={`badge badge-vp-instr-${instr.tipo}`}>{instr.tipo}</span>
              <span className={`badge badge-prio-${instr.prioridad}`}>{instr.prioridad}</span>
              <span className={`badge ${instr.estado === 'ejecutada' ? 'badge-resuelta' : instr.estado === 'rechazada' ? 'badge-vp-dict-rechazado' : 'badge-pendiente'}`}>{instr.estado}</span>
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{instr.descripcion}</div>
            <div className="vp-com-meta">{new Date(instr.created_at).toLocaleString('es-ES')}</div>
          </div>
        ))
      )}

      <button className="btn btn-primary" onClick={() => setShowInstruccion(true)} style={{ marginTop: '0.75rem' }}>Emitir instrucción</button>

      {showInstruccion && (
        <div className="modal-overlay" onClick={() => setShowInstruccion(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Emitir instrucción pericial</h3>
            <div className="form-group">
              <label>Tipo</label>
              <select value={instrTipo} onChange={(e) => setInstrTipo(e.target.value)} className="form-input">
                {VP_INSTRUCCION_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea value={instrDescripcion} onChange={(e) => setInstrDescripcion(e.target.value)} className="form-input" rows={4} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowInstruccion(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                emitirInstruccion.mutate({ id: vpId, tipo: instrTipo, descripcion: instrDescripcion }, {
                  onSuccess: () => { setShowInstruccion(false); setInstrTipo('continuidad'); setInstrDescripcion(''); },
                });
              }} disabled={emitirInstruccion.isPending || !instrDescripcion}>
                {emitirInstruccion.isPending ? 'Emitiendo...' : 'Emitir instrucción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TranscripcionesSection({ vpId, selectedTranscripcion, setSelectedTranscripcion }: {
  vpId: string; selectedTranscripcion: string | null; setSelectedTranscripcion: (v: string | null) => void;
}) {
  const { data } = useVpTranscripciones(vpId);
  const transcripciones: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];

  return (
    <div className="vp-section">
      <h3>Transcripciones</h3>
      {transcripciones.length === 0 ? (
        <p className="empty-state">Sin transcripciones</p>
      ) : (
        <div>
          {transcripciones.map((t: any) => (
            <div key={t.id}>
              <div style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setSelectedTranscripcion(selectedTranscripcion === t.id ? null : t.id)}>
                <div>
                  <strong>{t.idioma ?? 'es'}</strong>
                  <span className="vp-com-meta" style={{ marginLeft: '0.5rem' }}>
                    {t.resumen ? (t.resumen.length > 80 ? t.resumen.substring(0, 80) + '...' : t.resumen) : 'Sin resumen'}
                  </span>
                </div>
                <div className="vp-com-meta">
                  {t.proveedor ?? '—'} &middot; {t.created_at ? new Date(t.created_at).toLocaleString('es-ES') : '—'}
                </div>
              </div>
              {selectedTranscripcion === t.id && (
                <div className="vp-transcript-viewer">
                  {t.resumen && <div className="transcript-resumen">{t.resumen}</div>}
                  {t.highlights?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      {t.highlights.map((h: string, i: number) => (
                        <span key={i} className="vp-highlight-badge">{h}</span>
                      ))}
                    </div>
                  )}
                  {t.texto_completo && <div className="transcript-text">{t.texto_completo}</div>}
                  {t.segmentos?.length > 0 && (
                    <ul className="vp-transcript-segments" style={{ marginTop: '0.75rem' }}>
                      {t.segmentos.map((seg: any, i: number) => (
                        <li key={i}>
                          <span className="seg-time">[{seg.start ?? '?'}–{seg.end ?? '?'}]</span>
                          <span className="seg-speaker">{seg.speaker ?? '?'}:</span>
                          <span>{seg.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sprint 4: Informes Section ───

function InformesSection({ vpId, expedienteId, vpEstado, userRoles }: { vpId: string; expedienteId: string; vpEstado: string; userRoles: string[] }) {
  const { data } = useVpInformes(vpId);
  const informes: any[] = data && 'data' in data ? (data.data as any)?.items ?? (Array.isArray(data.data) ? data.data : []) : [];
  const createInforme = useCreateInforme(vpId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editConclusiones, setEditConclusiones] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [editEvidencias, setEditEvidencias] = useState('');
  const [rectMotivo, setRectMotivo] = useState('');
  const [showRect, setShowRect] = useState(false);

  const selected = informes.find((i: any) => i.id === selectedId);
  const guardarBorrador = useGuardarBorrador(vpId, selectedId ?? '');
  const enviarRevision = useEnviarRevision(vpId, selectedId ?? '');
  const validarInforme = useValidarInforme(vpId, selectedId ?? '');
  const rectificarInforme = useRectificarInforme(vpId, selectedId ?? '');

  const canCreate = informes.length === 0 && ['sesion_finalizada', 'pendiente_perito', 'revision_pericial', 'pendiente_informe', 'informe_borrador'].includes(vpEstado);
  const isAdmin = userRoles.includes('admin') || userRoles.includes('supervisor');

  return (
    <div className="vp-section">
      <h3>Informes Técnicos</h3>
      {informes.length === 0 ? (
        <p className="empty-state">Sin informes</p>
      ) : (
        informes.map((inf: any) => (
          <div key={inf.id} className="vp-dictamen-card" style={{ cursor: 'pointer' }} onClick={() => {
            setSelectedId(selectedId === inf.id ? null : inf.id);
            setEditConclusiones(inf.conclusiones ?? '');
            setEditObservaciones(inf.observaciones_finales ?? '');
            setEditEvidencias((inf.evidencias_principales ?? []).join(', '));
          }}>
            <div className="dict-header">
              <div>
                <strong>v{inf.version}</strong>
                <span className={`badge badge-vp-inf-${inf.estado}`} style={{ marginLeft: '0.5rem' }}>{inf.estado.replace(/_/g, ' ')}</span>
              </div>
              <span className="vp-com-meta">
                {inf.creado_por} — {new Date(inf.created_at).toLocaleString('es-ES')}
                {inf.validado_at && <> | Validado: {new Date(inf.validado_at).toLocaleString('es-ES')}</>}
              </span>
            </div>
          </div>
        ))
      )}

      {canCreate && (
        <button className="btn btn-primary" onClick={() => createInforme.mutate({})} disabled={createInforme.isPending} style={{ marginTop: '0.75rem' }}>
          {createInforme.isPending ? 'Creando...' : 'Crear informe'}
        </button>
      )}

      {selected && selectedId && (
        <div className="vp-informe-editor" style={{ marginTop: '1rem' }}>
          <div className="vp-informe-section">
            <h4>Datos del expediente</h4>
            <pre>{JSON.stringify(selected.datos_expediente, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Datos del encargo</h4>
            <pre>{JSON.stringify(selected.datos_encargo, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Datos de la videoperitación</h4>
            <pre>{JSON.stringify(selected.datos_videoperitacion, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Resumen de sesión</h4>
            <pre>{JSON.stringify(selected.resumen_sesion, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Resolución pericial</h4>
            <pre>{JSON.stringify(selected.resolucion_pericial, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Hallazgos</h4>
            <pre>{JSON.stringify(selected.hallazgos, null, 2)}</pre>
          </div>
          <div className="vp-informe-section">
            <h4>Conclusiones</h4>
            <textarea value={editConclusiones} onChange={(e) => setEditConclusiones(e.target.value)}
              disabled={selected.estado !== 'borrador' && selected.estado !== 'rectificado'} />
          </div>
          <div className="vp-informe-section">
            <h4>Observaciones finales</h4>
            <textarea value={editObservaciones} onChange={(e) => setEditObservaciones(e.target.value)}
              disabled={selected.estado !== 'borrador' && selected.estado !== 'rectificado'} />
          </div>
          <div className="vp-informe-section">
            <h4>Evidencias principales (IDs separados por coma)</h4>
            <textarea value={editEvidencias} onChange={(e) => setEditEvidencias(e.target.value)}
              disabled={selected.estado !== 'borrador' && selected.estado !== 'rectificado'} />
          </div>

          {/* Version history */}
          {selected.versiones && selected.versiones.length > 0 && (
            <div className="vp-informe-section">
              <h4>Historial de versiones</h4>
              <div className="vp-version-history">
                {selected.versiones.map((v: any) => (
                  <div key={v.id} className="vp-version-item">
                    <span>v{v.version} — {v.estado_anterior} → {v.estado_nuevo}</span>
                    <span>{v.creado_por} — {new Date(v.created_at).toLocaleString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="vp-dictamen-actions">
            {(selected.estado === 'borrador' || selected.estado === 'rectificado') && (
              <>
                <button className="btn btn-primary" onClick={() => {
                  guardarBorrador.mutate({
                    conclusiones: editConclusiones,
                    observaciones_finales: editObservaciones,
                    evidencias_principales: editEvidencias.split(',').map((s: string) => s.trim()).filter(Boolean),
                  });
                }} disabled={guardarBorrador.isPending}>
                  {guardarBorrador.isPending ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button className="btn btn-success" onClick={() => enviarRevision.mutate()} disabled={enviarRevision.isPending}>
                  {enviarRevision.isPending ? 'Enviando...' : 'Enviar a revisión'}
                </button>
              </>
            )}
            {selected.estado === 'en_revision' && isAdmin && (
              <button className="btn btn-success" onClick={() => validarInforme.mutate()} disabled={validarInforme.isPending}>
                {validarInforme.isPending ? 'Validando...' : 'Validar'}
              </button>
            )}
            {selected.estado === 'validado' && (
              <button className="btn btn-warning" onClick={() => setShowRect(true)}>Rectificar</button>
            )}
          </div>
        </div>
      )}

      {showRect && selectedId && (
        <div className="modal-overlay" onClick={() => setShowRect(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Rectificar informe</h3>
            <div className="form-group">
              <label>Motivo de rectificación *</label>
              <textarea value={rectMotivo} onChange={(e) => setRectMotivo(e.target.value)} className="form-input" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowRect(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => {
                rectificarInforme.mutate({ motivo: rectMotivo }, {
                  onSuccess: () => { setShowRect(false); setRectMotivo(''); },
                });
              }} disabled={rectificarInforme.isPending || !rectMotivo}>
                {rectificarInforme.isPending ? 'Rectificando...' : 'Confirmar rectificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sprint 4: Valoración Section ───

function ValoracionSection({ vpId, expedienteId, vpEstado, userRoles }: { vpId: string; expedienteId: string; vpEstado: string; userRoles: string[] }) {
  const { data } = useVpValoracion(vpId);
  const valoracion: any = data && 'data' in data ? data.data : null;
  const calcularValoracion = useCalcularValoracion(vpId);
  const addLinea = useAddValoracionLinea(vpId);
  const recalcular = useRecalcularValoracion(vpId);

  const [showAddLinea, setShowAddLinea] = useState(false);
  const [lineaCodigo, setLineaCodigo] = useState('');
  const [lineaDescripcion, setLineaDescripcion] = useState('');
  const [lineaEspecialidad, setLineaEspecialidad] = useState('');
  const [lineaCantidad, setLineaCantidad] = useState('1');
  const [lineaPrecio, setLineaPrecio] = useState('');
  const [lineaObs, setLineaObs] = useState('');

  const lineas: any[] = valoracion?.lineas ?? [];
  const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="vp-section">
      <h3>Valoración</h3>
      {!valoracion ? (
        <>
          <p className="empty-state">Sin valoración calculada</p>
          <button className="btn btn-primary" onClick={() => calcularValoracion.mutate({ lineas: [] })} disabled={calcularValoracion.isPending} style={{ marginTop: '0.5rem' }}>
            {calcularValoracion.isPending ? 'Calculando...' : 'Calcular valoración'}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className={`badge badge-vp-val-${valoracion.estado}`}>{valoracion.estado}</span>
            {valoracion.baremo_nombre && <span className="vp-com-meta">Baremo: {valoracion.baremo_nombre} v{valoracion.baremo_version}</span>}
            {valoracion.calculado_at && <span className="vp-com-meta">Calculado: {new Date(valoracion.calculado_at).toLocaleString('es-ES')}</span>}
          </div>

          <table className="vp-valoracion-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Especialidad</th>
                <th>Cant.</th>
                <th>P. Baremo</th>
                <th>P. Aplicado</th>
                <th>Importe</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l: any) => (
                <tr key={l.id} className={l.es_ajuste_manual ? 'ajuste-manual' : l.fuera_de_baremo ? 'fuera-baremo' : ''}>
                  <td>{l.codigo ?? '—'}</td>
                  <td>{l.descripcion}</td>
                  <td>{l.especialidad ?? '—'}</td>
                  <td>{l.cantidad}</td>
                  <td>{fmt(l.precio_unitario_baremo)}</td>
                  <td>{fmt(l.precio_unitario_aplicado)}</td>
                  <td>{fmt(l.importe)}</td>
                  <td>
                    {l.es_ajuste_manual && <span style={{ color: '#dc2626', fontWeight: 600 }}>Ajuste</span>}
                    {l.fuera_de_baremo && <span style={{ color: '#d97706', fontWeight: 600 }}> Fuera baremo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="vp-valoracion-totals">
            <div className="total-item">
              <div className="label">Importe Total</div>
              <div className="value">{fmt(valoracion.importe_total)}</div>
            </div>
            <div className="total-item">
              <div className="label">Importe Baremo</div>
              <div className="value">{fmt(valoracion.importe_baremo)}</div>
            </div>
            <div className="total-item">
              <div className="label">Importe Ajustado</div>
              <div className="value">{fmt(valoracion.importe_ajustado)}</div>
            </div>
            <div className={`total-item ${valoracion.desviacion_total > 0 ? 'desviacion-positiva' : 'desviacion-cero'}`}>
              <div className="label">Desviación</div>
              <div className="value">{fmt(valoracion.desviacion_total)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => setShowAddLinea(true)}>Añadir línea</button>
            <button className="btn" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
              {recalcular.isPending ? 'Recalculando...' : 'Recalcular'}
            </button>
          </div>

          {showAddLinea && (
            <div className="modal-overlay" onClick={() => setShowAddLinea(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Añadir línea de valoración</h3>
                <div className="form-group">
                  <label>Código</label>
                  <input type="text" value={lineaCodigo} onChange={(e) => setLineaCodigo(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <input type="text" value={lineaDescripcion} onChange={(e) => setLineaDescripcion(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Especialidad</label>
                  <input type="text" value={lineaEspecialidad} onChange={(e) => setLineaEspecialidad(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Cantidad</label>
                  <input type="number" value={lineaCantidad} onChange={(e) => setLineaCantidad(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Precio unitario</label>
                  <input type="number" value={lineaPrecio} onChange={(e) => setLineaPrecio(e.target.value)} className="form-input" step="0.01" />
                </div>
                <div className="form-group">
                  <label>Observaciones</label>
                  <textarea value={lineaObs} onChange={(e) => setLineaObs(e.target.value)} className="form-input" rows={2} />
                </div>
                <div className="modal-actions">
                  <button className="btn" onClick={() => setShowAddLinea(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={() => {
                    addLinea.mutate({
                      codigo: lineaCodigo || null,
                      descripcion: lineaDescripcion,
                      especialidad: lineaEspecialidad || null,
                      cantidad: Number(lineaCantidad),
                      precio_unitario_aplicado: Number(lineaPrecio),
                      observaciones: lineaObs || null,
                      fuera_de_baremo: true,
                    }, {
                      onSuccess: () => {
                        setShowAddLinea(false); setLineaCodigo(''); setLineaDescripcion('');
                        setLineaEspecialidad(''); setLineaCantidad('1'); setLineaPrecio(''); setLineaObs('');
                      },
                    });
                  }} disabled={addLinea.isPending || !lineaDescripcion}>
                    {addLinea.isPending ? 'Añadiendo...' : 'Añadir'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sprint 5: Documento Final ───────────────────────────────────────

function DocumentoFinalSection({ vpId, vpEstado, userRoles }: { vpId: string; vpEstado: string; userRoles: string[] }) {
  const { data: doc, isLoading } = useVpDocumentoFinal(vpId);
  const generarMut = useGenerarDocumento(vpId);
  const [showJson, setShowJson] = useState(false);

  const DOC_BADGE: Record<string, string> = Object.fromEntries(
    VP_DOCUMENTO_ESTADOS.map((e) => [e, `badge-vp-doc-${e}`]),
  );

  return (
    <div className="vp-section">
      <h3>Documento Final</h3>
      {isLoading && <p className="text-muted">Cargando...</p>}

      {!isLoading && doc && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className={`badge ${DOC_BADGE[doc.estado] || ''}`}>{doc.estado}</span>
            <span style={{ fontSize: '0.85rem' }}>v{doc.version}</span>
            {doc.nombre_archivo && <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{doc.nombre_archivo}</span>}
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{doc.formato}</span>
            {doc.generado_at && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Generado: {new Date(doc.generado_at).toLocaleString()}</span>}
          </div>

          {doc.error_detalle && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{doc.error_detalle}</p>}

          <button className="btn-secondary" style={{ marginBottom: '0.5rem' }} onClick={() => setShowJson(!showJson)}>
            {showJson ? 'Ocultar JSON' : 'Ver contenido JSON'}
          </button>

          {showJson && (
            <div className="vp-documento-viewer">
              <pre>{JSON.stringify(doc.contenido_json, null, 2)}</pre>
            </div>
          )}
        </>
      )}

      {!isLoading && !doc && <p className="text-muted">No hay documento generado aún.</p>}

      <div style={{ marginTop: '0.75rem' }}>
        <button className="btn-primary" onClick={() => generarMut.mutate()} disabled={generarMut.isPending}>
          {generarMut.isPending ? 'Generando...' : doc ? 'Regenerar documento' : 'Generar documento'}
        </button>
      </div>
    </div>
  );
}

// ─── Sprint 5: Facturación VP ────────────────────────────────────────

function FacturacionVpSection({ vpId, vpEstado, userRoles }: { vpId: string; vpEstado: string; userRoles: string[] }) {
  const { data: factura, isLoading } = useVpFacturacion(vpId);
  const emitirMut = useEmitirFacturaVp(vpId);
  const [serieId, setSerieId] = useState('');
  const [notas, setNotas] = useState('');

  return (
    <div className="vp-section">
      <h3>Facturación VP</h3>
      {isLoading && <p className="text-muted">Cargando...</p>}

      {!isLoading && factura && (
        <div className="vp-factura-card">
          {factura.numero_factura && (
            <div className="factura-field">
              <div className="label">N.º Factura</div>
              <div>{factura.numero_factura}</div>
            </div>
          )}
          {factura.estado && (
            <div className="factura-field">
              <div className="label">Estado</div>
              <span className={`badge badge-estado-${factura.estado}`}>{factura.estado}</span>
            </div>
          )}
          {factura.fecha_emision && (
            <div className="factura-field">
              <div className="label">Fecha emisión</div>
              <div>{new Date(factura.fecha_emision).toLocaleDateString()}</div>
            </div>
          )}
          {factura.fecha_vencimiento && (
            <div className="factura-field">
              <div className="label">Fecha vencimiento</div>
              <div>{new Date(factura.fecha_vencimiento).toLocaleDateString()}</div>
            </div>
          )}
          {factura.total != null && (
            <div className="factura-total">{Number(factura.total).toFixed(2)} &euro;</div>
          )}
        </div>
      )}

      {!isLoading && !factura && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '360px' }}>
          <div className="form-group">
            <label>Serie facturación</label>
            <input type="text" value={serieId} onChange={(e) => setSerieId(e.target.value)} placeholder="ID de serie" />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
          <button className="btn-primary" onClick={() => emitirMut.mutate({ serie_id: serieId, notas: notas || undefined })} disabled={emitirMut.isPending || !serieId}>
            {emitirMut.isPending ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sprint 5: Envíos ────────────────────────────────────────────────

function EnviosSection({ vpId, vpEstado, userRoles }: { vpId: string; vpEstado: string; userRoles: string[] }) {
  const { data: envios, isLoading } = useVpEnvios(vpId);
  const enviarMut = useEnviarInforme(vpId);
  const reintentarMut = useReintentarEnvio(vpId);
  const [email, setEmail] = useState('');

  const ENV_BADGE: Record<string, string> = Object.fromEntries(
    VP_ENVIO_ESTADOS.map((e) => [e, `badge-vp-env-${e}`]),
  );

  return (
    <div className="vp-section">
      <h3>Envíos</h3>
      {isLoading && <p className="text-muted">Cargando...</p>}

      {!isLoading && envios && envios.length > 0 && (
        <div className="vp-envios-list">
          {envios.map((env: any) => (
            <div key={env.id} className="vp-envio-item">
              <span className="envio-intento">#{env.intento_numero}</span>
              <span className={`badge ${ENV_BADGE[env.estado] || ''}`}>{env.estado}</span>
              <span>{env.canal}</span>
              {env.destinatario_email && <span style={{ color: '#6b7280' }}>{env.destinatario_email}</span>}
              {env.enviado_at && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(env.enviado_at).toLocaleString()}</span>}
              {env.error_detalle && <span className="envio-error">{env.error_detalle}</span>}
              {env.estado === 'error' && (
                <button className="btn-secondary" onClick={() => reintentarMut.mutate(env.id)} disabled={reintentarMut.isPending}>
                  Reintentar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!envios || envios.length === 0) && <p className="text-muted">Sin envíos registrados.</p>}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', maxWidth: '480px' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Email destinatario</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
        </div>
        <button className="btn-primary" onClick={() => { enviarMut.mutate({ destinatario_email: email }); setEmail(''); }} disabled={enviarMut.isPending || !email}>
          {enviarMut.isPending ? 'Enviando...' : 'Enviar informe'}
        </button>
      </div>
    </div>
  );
}
