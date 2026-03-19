import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { CustomerTrackingIssueLinkResponse } from '@erp/types';
import { useExpediente, useExpedienteTimeline, useExpedientePartes, useTransicionEstado } from '@/hooks/useExpedientes';
import { useRealtimeExpediente } from '@/hooks/useRealtime';
import { NuevaCitaModal } from '@/components/NuevaCitaModal';
import { api } from '@/lib/api';

const ESTADO_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo', NO_ASIGNADO: 'No asignado', EN_PLANIFICACION: 'En planificación',
  EN_CURSO: 'En curso', PENDIENTE: 'Pendiente', PENDIENTE_MATERIAL: 'Pendiente material',
  PENDIENTE_PERITO: 'Pendiente perito', PENDIENTE_CLIENTE: 'Pendiente cliente',
  FINALIZADO: 'Finalizado', FACTURADO: 'Facturado', COBRADO: 'Cobrado',
  CERRADO: 'Cerrado', CANCELADO: 'Cancelado',
};

const TRANSICIONES_UI: Record<string, { estado: string; label: string; confirm?: string }[]> = {
  NUEVO: [{ estado: 'NO_ASIGNADO', label: 'Marcar como no asignado' }],
  NO_ASIGNADO: [{ estado: 'EN_PLANIFICACION', label: 'Pasar a planificación' }],
  EN_PLANIFICACION: [{ estado: 'EN_CURSO', label: 'Iniciar trabajos' }],
  EN_CURSO: [
    { estado: 'PENDIENTE', label: 'Marcar pendiente' },
    { estado: 'PENDIENTE_MATERIAL', label: 'Pendiente material' },
    { estado: 'PENDIENTE_PERITO', label: 'Pendiente perito' },
    { estado: 'PENDIENTE_CLIENTE', label: 'Pendiente cliente' },
    { estado: 'FINALIZADO', label: 'Finalizar', confirm: 'Requiere parte validado. ¿Continuar?' },
  ],
  PENDIENTE: [{ estado: 'EN_CURSO', label: 'Reanudar' }],
  PENDIENTE_MATERIAL: [{ estado: 'EN_CURSO', label: 'Material recibido' }],
  PENDIENTE_PERITO: [{ estado: 'EN_CURSO', label: 'Reanudar' }],
  PENDIENTE_CLIENTE: [{ estado: 'EN_PLANIFICACION', label: 'Replanificar' }],
  FINALIZADO: [{ estado: 'FACTURADO', label: 'Marcar facturado' }],
  FACTURADO: [{ estado: 'COBRADO', label: 'Marcar cobrado' }],
  COBRADO: [{ estado: 'CERRADO', label: 'Cerrar expediente' }],
};

export function ExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: expResult, isLoading } = useExpediente(id!);
  const { data: timelineResult } = useExpedienteTimeline(id!);
  const { data: partesResult } = useExpedientePartes(id!);
  const transicion = useTransicionEstado();
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [trackingLink, setTrackingLink] = useState<string | null>(null);
  const [trackingExpiry, setTrackingExpiry] = useState<string | null>(null);

  // Pedidos de material del expediente
  const { data: pedidosResult } = useQuery({
    queryKey: ['pedidos', { expediente_id: id }],
    queryFn: () => api.get(`/pedidos?expediente_id=${id}`),
  });

  // Realtime
  useRealtimeExpediente(id!);

  // Nota interna
  const [nota, setNota] = useState('');
  const qc = useQueryClient();
  const notaMut = useMutation({
    mutationFn: (contenido: string) => api.post('/comunicaciones', {
      expediente_id: id,
      tipo: 'nota_interna',
      contenido,
    }),
    onSuccess: () => {
      setNota('');
      qc.invalidateQueries({ queryKey: ['expediente-timeline', id] });
    },
  });

  const customerLinkMut = useMutation({
    mutationFn: () => api.post<CustomerTrackingIssueLinkResponse>('/customer-tracking-links', { expediente_id: id }),
    onSuccess: (result) => {
      if ('data' in result && result.data) {
        setTrackingLink(`${window.location.origin}${result.data.path}`);
        setTrackingExpiry(result.data.expires_at);
      }
    },
  });

  const handleAddNota = (e: FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) return;
    notaMut.mutate(nota);
  };

  if (isLoading) return <div className="loading">Cargando...</div>;

  const exp = expResult && 'data' in expResult ? expResult.data : null;
  if (!exp) return <div className="error">Expediente no encontrado</div>;

  const e = exp as any;
  const partes = partesResult && 'data' in partesResult ? (partesResult.data as any[]) : [];
  const allTimeline = timelineResult && 'data' in timelineResult ? (timelineResult.data as any[]) : [];
  const timeline = timelineFilter === 'all'
    ? allTimeline
    : allTimeline.filter((item: any) => item.timeline_type === timelineFilter);
  const transicionesDisponibles = TRANSICIONES_UI[e.estado] ?? [];

  const handleTransicion = async (estadoNuevo: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const motivo = window.prompt('Motivo (opcional):');
    transicion.mutate({ id: id!, estado_nuevo: estadoNuevo, motivo: motivo || undefined });
  };

  return (
    <div className="page-detail">
      {/* Cabecera */}
      <div className="detail-header">
        <div>
          <h2>{e.numero_expediente}</h2>
          <span className="badge estado-badge">{ESTADO_LABELS[e.estado] ?? e.estado}</span>
          <span className={`badge prioridad-${e.prioridad}`}>{e.prioridad}</span>
        </div>
        <div className="detail-actions">
          {transicionesDisponibles.map((t) => (
            <button key={t.estado} onClick={() => handleTransicion(t.estado, t.confirm)} className="btn-secondary" disabled={transicion.isPending}>
              {t.label}
            </button>
          ))}
          {['EN_PLANIFICACION', 'EN_CURSO', 'PENDIENTE_CLIENTE'].includes(e.estado) && (
            <button onClick={() => setShowCitaModal(true)} className="btn-primary">Nueva cita</button>
          )}
          {['EN_CURSO', 'PENDIENTE_MATERIAL'].includes(e.estado) && (
            <button onClick={() => setShowPedidoModal(true)} className="btn-secondary">Pedir material</button>
          )}
        </div>
      </div>

      {transicion.isError && (
        <div className="form-error">Error al cambiar estado. Verifica las precondiciones.</div>
      )}

      {/* Datos */}
      <div className="detail-grid">
        <section className="detail-section">
          <h3>Datos del siniestro</h3>
          <dl>
            <dt>Tipo</dt><dd>{e.tipo_siniestro}</dd>
            <dt>Descripción</dt><dd>{e.descripcion}</dd>
            <dt>Dirección</dt><dd>{e.direccion_siniestro}, {e.codigo_postal} {e.localidad} ({e.provincia})</dd>
            <dt>Nº Póliza</dt><dd>{e.numero_poliza ?? '—'}</dd>
            <dt>Nº Siniestro Cía</dt><dd>{e.numero_siniestro_cia ?? '—'}</dd>
            <dt>Fecha encargo</dt><dd>{new Date(e.fecha_encargo).toLocaleDateString('es-ES')}</dd>
          </dl>
        </section>

        <section className="detail-section">
          <h3>Asegurado</h3>
          {e.asegurados && (
            <dl>
              <dt>Nombre</dt><dd>{e.asegurados.nombre} {e.asegurados.apellidos}</dd>
              <dt>Teléfono</dt><dd>{e.asegurados.telefono}</dd>
              <dt>Email</dt><dd>{e.asegurados.email ?? '—'}</dd>
              <dt>Dirección</dt><dd>{e.asegurados.direccion}</dd>
            </dl>
          )}
        </section>

        <section className="detail-section">
          <h3>Compañía</h3>
          {e.companias && <p>{e.companias.nombre} ({e.companias.codigo})</p>}
        </section>

        <section className="detail-section">
          <h3>Operario asignado</h3>
          {e.operarios ? (
            <p>{e.operarios.nombre} {e.operarios.apellidos}</p>
          ) : (
            <p className="text-muted">Sin asignar</p>
          )}
        </section>
      </div>

      <section className="detail-section">
        <div className="customer-link-panel">
          <div>
            <h3>Portal cliente</h3>
            <p className="text-muted">Emite un magic link temporal para el tracking B2C del expediente.</p>
          </div>
          <div className="customer-link-actions">
            <button className="btn-secondary" onClick={() => customerLinkMut.mutate()} disabled={customerLinkMut.isPending}>
              {customerLinkMut.isPending ? 'Generando enlace...' : 'Generar enlace cliente'}
            </button>
            {trackingLink && (
              <button className="btn-primary" onClick={() => navigator.clipboard.writeText(trackingLink)}>
                Copiar enlace
              </button>
            )}
          </div>
        </div>
        {trackingLink && (
          <div className="customer-link-result">
            <input readOnly value={trackingLink} />
            {trackingExpiry && <p className="text-muted">Caduca el {new Date(trackingExpiry).toLocaleString('es-ES')}</p>}
          </div>
        )}
      </section>

      {/* Partes de operario */}
      {partes.length > 0 && (
        <section className="detail-section partes-section">
          <h3>Partes de operario ({partes.length})</h3>
          {partes.map((p: any) => (
            <div key={p.id} className="parte-card">
              <div className="parte-header">
                <span className="parte-resultado">{p.resultado ?? 'sin resultado'}</span>
                <span className={`badge ${p.validado ? 'badge-success' : 'badge-warning'}`}>
                  {p.validado ? 'Validado' : 'Pendiente validación'}
                </span>
                {p.firma_storage_path && <span className="badge badge-success">Firma</span>}
                <span className="text-muted">
                  {new Date(p.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {p.operarios && (
                <p className="parte-operario">
                  Operario: {p.operarios.nombre} {p.operarios.apellidos}
                  {p.operarios.telefono && <span> — {p.operarios.telefono}</span>}
                </p>
              )}
              <p className="parte-trabajos">{p.trabajos_realizados}</p>
              {p.trabajos_pendientes && <p className="text-muted">Pendiente: {p.trabajos_pendientes}</p>}
              {p.materiales_utilizados && <p className="text-muted">Materiales: {p.materiales_utilizados}</p>}
              {p.observaciones && <p className="text-muted">Obs: {p.observaciones}</p>}
              {p.motivo_resultado && <p className="text-muted">Motivo: {p.motivo_resultado}</p>}
              <div className="parte-footer">
                {p.requiere_nueva_visita && <span className="badge badge-warning">Requiere nueva visita</span>}
                {p.evidencias && p.evidencias.length > 0 && (
                  <span className="parte-evidencias-count">{p.evidencias.length} evidencia(s)</span>
                )}
              </div>
              {p.evidencias && p.evidencias.length > 0 && (
                <div className="parte-evidencias-list">
                  {(p.evidencias as any[]).map((ev: any) => (
                    <span key={ev.id} className="parte-ev-chip">
                      {ev.clasificacion}: {ev.nombre_original ?? ev.tipo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Pedidos de material */}
      {(() => {
        const pedidos = pedidosResult && 'data' in pedidosResult
          ? ((pedidosResult as any).data?.items ?? (pedidosResult as any).data ?? []) as any[]
          : [];
        return pedidos.length > 0 ? (
          <section className="detail-section">
            <h3>Pedidos de material ({pedidos.length})</h3>
            <table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Nº Pedido</th><th>Proveedor</th><th>Estado</th><th>Fecha límite</th><th></th></tr></thead>
              <tbody>
                {pedidos.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.numero_pedido}</td>
                    <td>{p.proveedores?.nombre ?? '—'}</td>
                    <td><span className={`badge badge-pedido-${p.estado}`}>{p.estado}</span></td>
                    <td>{p.fecha_limite ? new Date(p.fecha_limite).toLocaleDateString('es-ES') : '—'}</td>
                    <td><Link to={`/pedidos/${p.id}`} className="link">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null;
      })()}

      {/* Nota interna */}
      <section className="note-input-section">
        <form onSubmit={handleAddNota} className="note-form">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Escribir nota interna..."
            rows={2}
            className="note-textarea"
          />
          <button type="submit" className="btn-primary" disabled={notaMut.isPending || !nota.trim()}>
            {notaMut.isPending ? 'Enviando...' : 'Añadir nota'}
          </button>
        </form>
      </section>

      {/* Timeline */}
      <section className="timeline-section">
        <div className="timeline-header">
          <h3>Timeline</h3>
          <div className="timeline-filters">
            <button className={`filter-chip ${timelineFilter === 'all' ? 'active' : ''}`} onClick={() => setTimelineFilter('all')}>Todos</button>
            <button className={`filter-chip ${timelineFilter === 'estado' ? 'active' : ''}`} onClick={() => setTimelineFilter('estado')}>Estados</button>
            <button className={`filter-chip ${timelineFilter === 'comunicacion' ? 'active' : ''}`} onClick={() => setTimelineFilter('comunicacion')}>Notas</button>
            <button className={`filter-chip ${timelineFilter === 'cita' ? 'active' : ''}`} onClick={() => setTimelineFilter('cita')}>Citas</button>
          </div>
        </div>
        {timeline.length === 0 ? (
          <p className="text-muted">Sin actividad</p>
        ) : (
          <ul className="timeline">
            {timeline.map((item: any, i: number) => (
              <li key={item.id ?? i} className={`timeline-item timeline-${item.timeline_type}`}>
                <div className="timeline-date">{new Date(item.created_at).toLocaleString('es-ES')}</div>
                <div className="timeline-content">
                  {item.timeline_type === 'estado' && (
                    <span>
                      Estado: {ESTADO_LABELS[item.estado_anterior] ?? '—'} &rarr; {ESTADO_LABELS[item.estado_nuevo]}
                      {item.motivo && <em> — {item.motivo}</em>}
                    </span>
                  )}
                  {item.timeline_type === 'comunicacion' && (
                    <span>
                      <strong>[{item.tipo}]</strong> {item.contenido}
                      {item.actor_nombre && <span className="text-muted"> — {item.actor_nombre}</span>}
                    </span>
                  )}
                  {item.timeline_type === 'cita' && (
                    <span>
                      Cita {item.estado}: {item.fecha} {item.franja_inicio}–{item.franja_fin}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCitaModal && <NuevaCitaModal expedienteId={id!} onClose={() => setShowCitaModal(false)} />}
      {showPedidoModal && <CrearPedidoModal expedienteId={id!} onClose={() => setShowPedidoModal(false)} />}
    </div>
  );
}

// ─── Modal para crear pedido de material ───
function CrearPedidoModal({ expedienteId, onClose }: { expedienteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [proveedorId, setProveedorId] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState([{ descripcion: '', cantidad: 1, unidad: 'ud', referencia: '' }]);
  const [error, setError] = useState('');

  const { data: provsResult } = useQuery({
    queryKey: ['proveedores', { activo: true }],
    queryFn: () => api.get('/proveedores?activo=true'),
  });
  const proveedores = provsResult && 'data' in provsResult
    ? ((provsResult as any).data?.items ?? (provsResult as any).data ?? []) as any[]
    : [];

  const crear = useMutation({
    mutationFn: (body: any) => api.post('/pedidos', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      onClose();
    },
    onError: () => setError('Error al crear pedido'),
  });

  const addLinea = () => setLineas([...lineas, { descripcion: '', cantidad: 1, unidad: 'ud', referencia: '' }]);
  const removeLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, value: any) => {
    const copy = [...lineas];
    (copy[i] as any)[field] = value;
    setLineas(copy);
  };

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const validLineas = lineas.filter(l => l.descripcion.trim());
    if (!proveedorId) { setError('Selecciona un proveedor'); return; }
    if (validLineas.length === 0) { setError('Añade al menos una línea'); return; }
    crear.mutate({
      expediente_id: expedienteId,
      proveedor_id: proveedorId,
      fecha_limite: fechaLimite || undefined,
      observaciones: observaciones || undefined,
      lineas: validLineas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, referencia: l.referencia || undefined })),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 600 }}>
        <h3>Nuevo pedido de material</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Proveedor *</label>
            <select value={proveedorId} onChange={(ev) => setProveedorId(ev.target.value)} required>
              <option value="">Seleccionar...</option>
              {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha límite</label>
            <input type="date" value={fechaLimite} onChange={(ev) => setFechaLimite(ev.target.value)} />
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={observaciones} onChange={(ev) => setObservaciones(ev.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Líneas de material</label>
            <div className="lineas-pedido-form">
              {lineas.map((l, i) => (
                <div key={i} className="linea-row">
                  <input placeholder="Descripción *" value={l.descripcion} onChange={(ev) => updateLinea(i, 'descripcion', ev.target.value)} />
                  <input className="linea-qty" type="number" min={1} value={l.cantidad} onChange={(ev) => updateLinea(i, 'cantidad', +ev.target.value)} />
                  <input className="linea-unit" placeholder="ud" value={l.unidad} onChange={(ev) => updateLinea(i, 'unidad', ev.target.value)} />
                  <input placeholder="Ref." value={l.referencia} onChange={(ev) => updateLinea(i, 'referencia', ev.target.value)} style={{ width: 100 }} />
                  {lineas.length > 1 && <button type="button" className="btn-xs btn-remove-linea" onClick={() => removeLinea(i)}>X</button>}
                </div>
              ))}
              <button type="button" className="btn-xs" onClick={addLinea}>+ Línea</button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={crear.isPending}>
              {crear.isPending ? 'Creando...' : 'Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
