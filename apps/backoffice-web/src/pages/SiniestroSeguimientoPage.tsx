/**
 * SiniestroSeguimientoPage — Ficha completa del expediente.
 *
 * BLOQUE 1 (Secciones 1-5) implementado:
 *   S1 ✅ Barra de presencia / bloqueo colaborativo
 *   S2 ✅ Selector de tramitador (auto-save)
 *   S3 ✅ Cabecera: tipo daño, pendiente_de, tipos compañía dinámicos, eventos
 *   S4 ✅ Notificación al asegurado
 *   S5 ✅ Panel de comunicaciones: consent, 3 teléfonos, email, modales SMS/email
 *
 * BLOQUE 2 (Secciones 6-10) implementado:
 *   S6 ✅ Planning / Calendario de citas (resumen + enlace)
 *   S7 ✅ Pedidos de material (formulario inline + CRUD + proveedor select)
 *   S8 ✅ Trabajos en curso (visitas con slideshow fotos + tabla trabajos por operario)
 *   S9 ✅ Comunicaciones ASITUR/INTERPWGS (12 tipos de mensaje + historial)
 *   S10 ✅ Notas internas (2 columnas tramitadores/operarios + alarmas)
 *
 * BLOQUE 3 (Secciones 11-15) implementado:
 *   S11 ✅ Incidencias extendidas (tipo, tipología, plataforma, interna, proc)
 *   S12 ✅ Encuesta de satisfacción (select visita + tipo + Envío Email)
 *   S13 ✅ Informe fotográfico / Gestión DOC (galería + campos adicionales)
 *   S14 ✅ Adjuntos y Email (upload + email con adjuntos seleccionados)
 *   S15 ✅ SMS programado (destinatario auto-fill + 160 chars + scheduled)
 *
 * Secciones ya existentes que se mantienen:
 *   ✅ Datos del asegurado (read-only)
 *   ✅ Historial de comunicaciones
 *   ✅ Presupuestos
 *   ✅ Facturas
 *
 * BLOQUE 4 (Sección 16) implementado:
 *   S16 ✅ Email al operario/asegurado (select destinatario + email libre + cuerpo)
 *
 * Secciones pendientes (bloques futuros):
 *   🔲 Firma electrónica
 *   🔲 Portal asegurado (Sigue Tu Expediente)
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  SeguimientoExpediente,
  SeguimientoIncidencia,
  SeguimientoVisita,
  SeguimientoPedido,
  UpdateSiniestroRequest,
  TextoPredefinido,
  TrabajoExpediente,
  NotaInterna,
  ComunicacionAsitur,
  CamposAdicionalesExpediente,
} from '@erp/types';
import {
  TIPOS_DANO,
  PENDIENTE_DE_OPTIONS,
  TIPOS_MENSAJE_ASITUR,
  TIPO_INCIDENCIA_OPTIONS,
  TIPOLOGIA_INCIDENCIA_OPTIONS,
  PROC_INCIDENCIA_OPTIONS,
  TIPO_ENCUESTA_OPTIONS,
  ESPECIALIDADES_SINIESTRO,
} from '@erp/types';
import {
  useSeguimiento,
  useUpdateSiniestro,
  useCrearIncidencia,
  useEliminarIncidencia,
  useSiniestrosTramitadoresList,
  useAcquirePresencia,
  useReleasePresencia,
  useUpdatePendienteDe,
  useUpdateTiposCompania,
  useEjecutarEvento,
  useNotificarAsegurado,
  useTextosPredefinidos,
  useEnviarSms,
  useEnviarEmail,
  useEnviarPanelCliente,
  useEnviarTeleAsistencia,
  useUpdateComunicacionesAsegurado,
  // B2 hooks
  useCrearPedidoExpediente,
  useCambiarEstadoPedido,
  useEliminarPedidoExpediente,
  useActualizarEstadoTrabajo,
  useCrearTrabajo,
  useEliminarTrabajo,
  useEnviarMensajeAsitur,
  useCrearNota,
  useMarcarNotaRealizada,
  // B3 hooks
  useEnviarEncuesta,
  useCamposAdicionales,
  useGuardarCamposAdicionales,
  useIniciarSubidaAdjunto,
  useRegistrarAdjunto,
  useEliminarAdjunto,
  useEnviarEmailAdjuntos,
  useEnviarSmsExpediente,
  // B4 hooks
  useEnviarEmailOperario,
  // Gap hooks
  useActualizarCampoVisita,
  usePlantillasExpediente,
  useGenerarDocumentoExpediente,
  useEnviarFirmaEmailVisita,
} from '@/hooks/useSiniestros';
import { useProveedores } from '@/hooks/useProveedores';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtDatetime(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtEur(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + '€';
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ─── Sección colapsable ───────────────────────────────────────────────────────

function Seccion({
  titulo,
  defaultOpen = false,
  children,
  badge,
}: {
  titulo: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`seg-seccion ${open ? 'seg-seccion--open' : ''}`}>
      <button
        type="button"
        className="seg-seccion-header"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="seg-seccion-titulo">{titulo}</span>
        {badge !== undefined && badge > 0 && (
          <span className="seg-badge">{badge}</span>
        )}
        <span className="seg-seccion-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="seg-seccion-body">{children}</div>}
    </section>
  );
}

// ─── S1: Barra de presencia (fixed top) ───────────────────────────────────────

function BarraPresencia({
  expedienteId,
  userId: _userId,
}: {
  expedienteId: string;
  userId: string | null;
}) {
  const acquireMut  = useAcquirePresencia();
  const releaseMut  = useReleasePresencia();
  const [presencia, setPresencia] = useState<{
    user_nombre: string;
    es_propio: boolean;
    locked_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Adquirir bloqueo al montar + heartbeat cada 25s
  useEffect(() => {
    let mounted = true;

    const acquire = async () => {
      try {
        const res: any = await acquireMut.mutateAsync(expedienteId);
        if (mounted && res?.data) {
          setPresencia(res.data);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) {
          // 409 = expediente bloqueado por otro usuario
          const detail = e?.response?.data?.error?.details;
          if (detail) {
            setPresencia({ user_nombre: detail.user_nombre, es_propio: false, locked_at: detail.locked_at });
          }
          setError(e?.response?.data?.error?.message ?? 'No se pudo adquirir el bloqueo');
        }
      }
    };

    acquire();

    // Heartbeat cada 25s (< 2min de expiración)
    heartbeatRef.current = setInterval(() => {
      if (mounted && !error) acquire();
    }, 25_000);

    // Liberar al desmontar
    return () => {
      mounted = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      releaseMut.mutate({ expedienteId });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  const handleForceRelease = () => {
    if (window.confirm('¿Forzar el desbloqueo del expediente? Esto puede causar pérdida de datos del otro usuario.')) {
      releaseMut.mutate({ expedienteId, force: true }, {
        onSuccess: () => { setError(null); window.location.reload(); },
      });
    }
  };

  if (!presencia) return null;

  if (!presencia.es_propio) {
    return (
      <div className="seg-presencia seg-presencia--bloqueado">
        <span>
          El usuario <strong>{presencia.user_nombre}</strong> está en esta ventana
          desde ({fmt(presencia.locked_at)}).
        </span>
        <button
          type="button"
          className="seg-presencia-force"
          onClick={handleForceRelease}
        >
          Desbloquear
        </button>
      </div>
    );
  }

  return (
    <div className="seg-presencia seg-presencia--propio">
      <span>Editando como: <strong>{presencia.user_nombre}</strong></span>
      {error && <span className="seg-presencia-error"> ⚠ {error}</span>}
    </div>
  );
}

// ─── S2: Selector de tramitador (auto-save) ───────────────────────────────────

function TramitadorSelector({
  expedienteId,
  tramitadorActual,
}: {
  expedienteId: string;
  tramitadorActual: SeguimientoExpediente['tramitador'];
}) {
  const { data: listRes } = useSiniestrosTramitadoresList();
  const updateMut = useUpdateSiniestro();
  const [valor, setValor] = useState(tramitadorActual?.id ?? '');
  const [guardado, setGuardado] = useState(false);

  const lista: Array<{ user_id: string; nombre: string; apellidos: string }> =
    (listRes as any)?.data ?? [];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoId = e.target.value;
    setValor(nuevoId);
    setGuardado(false);
    await updateMut.mutateAsync({ id: expedienteId, tramitador_id: nuevoId || null });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  return (
    <div className="seg-tramitador-selector">
      <label className="seg-label">Tramitador:</label>
      <select
        className="seg-select seg-select--tramitador"
        value={valor}
        onChange={handleChange}
        disabled={updateMut.isPending}
      >
        <option value="">— Sin tramitador —</option>
        {lista.map((t) => (
          <option key={t.user_id} value={t.user_id}>
            {t.nombre} {t.apellidos}
          </option>
        ))}
      </select>
      {updateMut.isPending && <span className="seg-guardando"> Guardando…</span>}
      {guardado && <span className="seg-guardado"> ✅</span>}
    </div>
  );
}

// ─── S3: Cabecera del expediente + Estado general + Tipos + Eventos ───────────

function SeccionEstadoGeneral({
  exp,
  onSave,
}: {
  exp: SeguimientoExpediente;
  onSave: (data: UpdateSiniestroRequest) => void;
}) {
  const updatePendienteMut  = useUpdatePendienteDe();
  const updateTiposMut      = useUpdateTiposCompania();
  const ejecutarEventoMut   = useEjecutarEvento();

  const [tipoDano, setTipoDano]         = useState(exp.tipo_dano);
  const [especialidad, setEspecialidad] = useState(exp.especialidad ?? '');
  const [pendienteDe, setPendienteDe]   = useState(exp.pendiente_de ?? '');
  const [fechaEspera, setFechaEspera]   = useState(toInputDate(exp.fecha_espera));
  const [pausado, setPausado]       = useState(exp.pausado);
  const [urgente, setUrgente]       = useState(exp.urgente);
  const [vip, setVip]               = useState(exp.vip);
  const [dirty, setDirty]           = useState(false);

  // Tipos de compañía activos
  const tiposDisponibles = exp.tipos_compania ?? [];
  const [tiposActivos, setTiposActivos] = useState<string[]>(
    tiposDisponibles.filter((t) => t.seleccionado).map((t) => t.id),
  );

  const handleSave = () => {
    onSave({ tipo_dano: tipoDano, especialidad: especialidad || null, fecha_espera: fechaEspera || null, pausado, urgente, vip });
    setDirty(false);
  };

  const handlePendienteDeChange = (val: string) => {
    setPendienteDe(val);
    updatePendienteMut.mutate({ expedienteId: exp.id, pendiente_de: val || null });
  };

  const toggleTipo = (tipoId: string) => {
    const nuevos = tiposActivos.includes(tipoId)
      ? tiposActivos.filter((id) => id !== tipoId)
      : [...tiposActivos, tipoId];
    setTiposActivos(nuevos);
    updateTiposMut.mutate({ expedienteId: exp.id, tipo_ids: nuevos });
  };

  const handleEjecutarEvento = (eventoId: string, nombre: string) => {
    if (window.confirm(`¿Ejecutar el evento "${nombre}"?`)) {
      ejecutarEventoMut.mutate({ expedienteId: exp.id, eventoId });
    }
  };

  const eventos = exp.eventos ?? [];

  return (
    <div className="seg-estado-general">
      <div className="seg-form-grid">
        {/* Tipo de daño */}
        <div className="seg-form-field">
          <label className="seg-label">Tipo de daño</label>
          <select
            className="seg-select"
            value={tipoDano}
            onChange={(e) => { setTipoDano(e.target.value); setDirty(true); }}
          >
            <option value="">— Sin tipo —</option>
            {TIPOS_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Especialidad del servicio (G1) */}
        <div className="seg-form-field">
          <label className="seg-label">Especialidad</label>
          <select
            className="seg-select"
            value={especialidad}
            onChange={(e) => { setEspecialidad(e.target.value); setDirty(true); }}
          >
            <option value="">— Sin especialidad —</option>
            {ESPECIALIDADES_SINIESTRO.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Expediente pendiente de (73 opciones operacionales) */}
        <div className="seg-form-field">
          <label className="seg-label">Expediente pendiente de</label>
          <select
            className="seg-select"
            value={pendienteDe}
            onChange={(e) => handlePendienteDeChange(e.target.value)}
          >
            <option value="">— Seleccione estado —</option>
            {PENDIENTE_DE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {updatePendienteMut.isPending && (
            <span className="seg-guardando"> Guardando…</span>
          )}
        </div>

        {/* Fecha espera */}
        <div className="seg-form-field">
          <label className="seg-label">Fecha espera</label>
          <input
            type="date"
            className="seg-input seg-input--fecha-espera"
            value={fechaEspera}
            onChange={(e) => { setFechaEspera(e.target.value); setDirty(true); }}
          />
        </div>

        {/* Flags: Pausar / Urgente / VIP */}
        <div className="seg-form-field seg-form-field--flags">
          <label className="seg-label">Estado</label>
          <div className="seg-flags">
            <label className="seg-check">
              <input
                type="checkbox"
                checked={pausado}
                onChange={(e) => { setPausado(e.target.checked); setDirty(true); }}
              />
              Pausar
            </label>
            <label className="seg-check">
              <input
                type="checkbox"
                checked={urgente}
                onChange={(e) => { setUrgente(e.target.checked); setDirty(true); }}
              />
              Urgente
            </label>
            <label className="seg-check">
              <input
                type="checkbox"
                checked={vip}
                onChange={(e) => { setVip(e.target.checked); setDirty(true); }}
              />
              VIP
            </label>
          </div>
        </div>

        {dirty && (
          <div className="seg-form-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Guardar cambios
            </button>
          </div>
        )}
      </div>

      {/* Tipos de compañía (dinámicos) */}
      {tiposDisponibles.length > 0 && (
        <div className="seg-tipos-compania">
          <span className="seg-label">Tipos de la compañía:</span>
          <div className="seg-tipos-grid">
            {tiposDisponibles.map((tipo) => (
              <label key={tipo.id} className="seg-check">
                <input
                  type="checkbox"
                  checked={tiposActivos.includes(tipo.id)}
                  onChange={() => toggleTipo(tipo.id)}
                  disabled={updateTiposMut.isPending}
                />
                {tipo.nombre}
              </label>
            ))}
          </div>
          {updateTiposMut.isPending && (
            <span className="seg-guardando"> Actualizando tipos…</span>
          )}
        </div>
      )}

      {/* Eventos ejecutables */}
      {eventos.length > 0 && (
        <div className="seg-eventos">
          <span className="seg-label">Ejecutar eventos:</span>
          <div className="seg-eventos-botones">
            {eventos.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="btn btn-evento"
                onClick={() => handleEjecutarEvento(ev.id, ev.nombre)}
                disabled={ejecutarEventoMut.isPending}
              >
                {ev.nombre}
              </button>
            ))}
          </div>
          {ejecutarEventoMut.isSuccess && (
            <span className="seg-guardado"> ✅ Evento ejecutado</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── S3: Cabecera rápida del expediente ───────────────────────────────────────

function CabeceraExpediente({ exp }: { exp: SeguimientoExpediente }) {
  return (
    <div className="seg-cabecera">
      <div className="seg-cabecera-numero">
        <span className="seg-compania">{exp.compania.nombre} ({exp.compania.codigo})</span>
        <h2 className="seg-numero">{exp.numero_expediente}</h2>
        {exp.codigo_externo && (
          <span className="seg-codigo-ext">Ref. cía: {exp.codigo_externo}</span>
        )}
      </div>
      <div className="seg-cabecera-estado">
        <span className={`seg-estado-badge seg-estado-${exp.estado.toLowerCase()}`}>
          {exp.estado.replace(/_/g, ' ')}
        </span>
        {exp.pendiente_de && (
          <span className="seg-pendiente-de-badge">{exp.pendiente_de}</span>
        )}
        {exp.urgente && <span className="tag tag-urgente">URGENTE</span>}
        {exp.vip && <span className="tag tag-vip">VIP</span>}
        {exp.pausado && <span className="tag tag-pausado">PAUSADO</span>}
      </div>
      <div className="seg-cabecera-meta">
        <span>Alta: {fmt(exp.fecha_alta_asegurado)}</span>
        {exp.fecha_espera && (
          <span className={new Date(exp.fecha_espera) < new Date() ? 'seg-meta-vencida' : ''}>
            Espera: {fmt(exp.fecha_espera)}
          </span>
        )}
        {exp.operario && (
          <span>
            Operario: {exp.operario.nombre} {exp.operario.apellidos ?? ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── S4: Notificación al asegurado ────────────────────────────────────────────

function SeccionNotificarAsegurado({ exp }: { exp: SeguimientoExpediente }) {
  const notificarMut = useNotificarAsegurado();
  const a = exp.asegurado;
  const nombreCompleto = `${a.nombre} ${a.apellidos}`.trim();

  const handleNotificar = async () => {
    if (!window.confirm(
      `¿Enviar notificación a ${nombreCompleto} (${a.telefono}) para que contacte con nosotros?`,
    )) return;
    await notificarMut.mutateAsync(exp.id);
  };

  return (
    <div className="seg-notificar-asegurado">
      <p>
        Notificar al asegurado <strong>{nombreCompleto}</strong> para que se ponga
        en contacto con nosotros
      </p>
      <div className="seg-notificar-acciones">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNotificar}
          disabled={notificarMut.isPending}
        >
          {notificarMut.isPending ? 'Enviando…' : 'Notificar'}
        </button>
        {notificarMut.isSuccess && (
          <span className="seg-guardado"> ✅ Notificación registrada</span>
        )}
        {notificarMut.isError && (
          <span className="seg-error"> ❌ Error al notificar</span>
        )}
      </div>
    </div>
  );
}

// ─── S5: Modal SMS ────────────────────────────────────────────────────────────

function ModalSMS({
  expedienteId,
  telefonoPredefinido,
  onClose,
}: {
  expedienteId: string;
  telefonoPredefinido: string;
  onClose: () => void;
}) {
  const { data: textosRes } = useTextosPredefinidos('sms');
  const enviarMut = useEnviarSms();

  const textos: TextoPredefinido[] = (textosRes as any)?.data ?? [];
  const [telefono, setTelefono] = useState(telefonoPredefinido);
  const [textoPredId, setTextoPredId] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSelectTexto = (id: string) => {
    setTextoPredId(id);
    const t = textos.find((x) => x.id === id);
    if (t) setMensaje(t.cuerpo);
  };

  const handleEnviar = async () => {
    if (!telefono.trim() || !mensaje.trim()) return;
    await enviarMut.mutateAsync({
      expedienteId,
      telefono,
      texto: mensaje,
      texto_predefinido_id: textoPredId || undefined,
    });
    onClose();
  };

  return (
    <div className="seg-modal-overlay" onClick={onClose}>
      <div className="seg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="seg-modal-header">
          <h3>Enviar SMS al asegurado/perjudicado</h3>
          <button type="button" className="seg-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="seg-modal-body">
          <div className="seg-form-field">
            <label className="seg-label">Número</label>
            <input
              type="tel"
              className="seg-input seg-input--amarillo"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Texto predefinido</label>
            <select
              className="seg-select"
              value={textoPredId}
              onChange={(e) => handleSelectTexto(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {textos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Mensaje</label>
            <textarea
              className="seg-textarea"
              rows={5}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Texto del SMS…"
            />
          </div>
        </div>
        <div className="seg-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEnviar}
            disabled={!telefono.trim() || !mensaje.trim() || enviarMut.isPending}
          >
            {enviarMut.isPending ? 'Enviando…' : 'Enviar SMS'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── S5: Modal Email ──────────────────────────────────────────────────────────

function ModalEmail({
  expedienteId,
  emailPredefinido,
  onClose,
}: {
  expedienteId: string;
  emailPredefinido: string;
  onClose: () => void;
}) {
  const { data: textosRes } = useTextosPredefinidos('email');
  const enviarMut = useEnviarEmail();

  const textos: TextoPredefinido[] = (textosRes as any)?.data ?? [];
  const [email, setEmail]     = useState(emailPredefinido);
  const [textoPredId, setTextoPredId] = useState('');
  const [asunto, setAsunto]   = useState('');
  const [cuerpo, setCuerpo]   = useState('');

  const handleSelectTexto = (id: string) => {
    setTextoPredId(id);
    const t = textos.find((x) => x.id === id);
    if (t) { setAsunto(t.asunto ?? ''); setCuerpo(t.cuerpo); }
  };

  const handleEnviar = async () => {
    if (!email.trim() || !asunto.trim() || !cuerpo.trim()) return;
    await enviarMut.mutateAsync({
      expedienteId,
      email,
      asunto,
      cuerpo,
      texto_predefinido_id: textoPredId || undefined,
    });
    onClose();
  };

  return (
    <div className="seg-modal-overlay" onClick={onClose}>
      <div className="seg-modal seg-modal--email" onClick={(e) => e.stopPropagation()}>
        <div className="seg-modal-header">
          <h3>Enviar email al asegurado/perjudicado</h3>
          <button type="button" className="seg-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="seg-modal-body">
          <div className="seg-form-field">
            <label className="seg-label">Email destino</label>
            <input
              type="email"
              className="seg-input seg-input--amarillo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Texto predefinido</label>
            <select
              className="seg-select"
              value={textoPredId}
              onChange={(e) => handleSelectTexto(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {textos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Asunto</label>
            <input
              type="text"
              className="seg-input"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
            />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Cuerpo del mensaje</label>
            <textarea
              className="seg-textarea seg-textarea--email"
              rows={8}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
          </div>
        </div>
        <div className="seg-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEnviar}
            disabled={!email.trim() || !asunto.trim() || !cuerpo.trim() || enviarMut.isPending}
          >
            {enviarMut.isPending ? 'Enviando…' : 'Enviar email'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── S5: Bloque de teléfono individual ───────────────────────────────────────

function BloquetelefOno({
  numero,
  descripcion,
  esMovil,
  esPrioritario,
  indice,
  expedienteId,
  emailParaModal: _emailParaModal,
  onChange,
}: {
  numero: string;
  descripcion: string;
  esMovil: boolean;
  esPrioritario: boolean;
  indice: 1 | 2 | 3;
  expedienteId: string;
  emailParaModal?: string;
  onChange: (field: string, value: string | boolean) => void;
}) {
  const enviarSteMut     = useEnviarPanelCliente();
  const enviarTaMut      = useEnviarTeleAsistencia();
  const [modalSMS, setModalSMS] = useState(false);

  const handleSte = async () => {
    if (!numero.trim()) return;
    await enviarSteMut.mutateAsync({ expedienteId, canal: 'sms', telefono: numero });
  };

  const handleTa = async () => {
    if (!numero.trim()) return;
    await enviarTaMut.mutateAsync({ expedienteId, canal: 'sms', telefono: numero });
  };

  const fieldNum  = indice === 1 ? 'telefono'  : `telefono${indice}`;
  const fieldDesc = indice === 1 ? 'telefono_desc' : `telefono${indice}_desc`;
  const fieldMov  = indice === 1 ? 'telefono_movil' : `telefono${indice}_movil`;

  return (
    <div className={`seg-tel-bloque ${esPrioritario ? 'seg-tel-bloque--prioritario' : ''}`}>
      <div className="seg-tel-fila">
        <label className="seg-label seg-label--tel">Tel {indice}</label>
        <input
          type="tel"
          className="seg-input seg-input--tel seg-input--amarillo"
          value={numero}
          onChange={(e) => onChange(fieldNum, e.target.value)}
          placeholder={`Teléfono ${indice}`}
        />
        <input
          type="text"
          className="seg-input seg-input--tel-desc"
          value={descripcion}
          onChange={(e) => onChange(fieldDesc, e.target.value)}
          placeholder="Descripción"
        />
        <label className="seg-check">
          <input
            type="radio"
            name="tel_prioritario"
            checked={esPrioritario}
            onChange={() => onChange('telefono_prioridad', String(indice))}
          />
          Prioritario
        </label>
        <label className="seg-check">
          <input
            type="checkbox"
            checked={esMovil}
            onChange={(e) => onChange(fieldMov, e.target.checked)}
          />
          Móvil
        </label>
      </div>
      <div className="seg-tel-acciones">
        <button
          type="button"
          className="btn btn-sm btn-ste"
          onClick={handleSte}
          disabled={!numero.trim() || enviarSteMut.isPending}
          title="Enviar enlace Sigue Tu Expediente por SMS"
        >
          {enviarSteMut.isPending ? '…' : 'Sigue Tu Expediente'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ta"
          onClick={handleTa}
          disabled={!numero.trim() || enviarTaMut.isPending}
          title="Enviar enlace TeleAsistencia por SMS"
        >
          {enviarTaMut.isPending ? '…' : 'TeleAsistencia'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-sms"
          onClick={() => setModalSMS(true)}
          disabled={!numero.trim()}
          title="Abrir modal SMS"
        >
          ✉ SMS
        </button>
      </div>

      {modalSMS && (
        <ModalSMS
          expedienteId={expedienteId}
          telefonoPredefinido={numero}
          onClose={() => setModalSMS(false)}
        />
      )}

      {enviarSteMut.isSuccess && <span className="seg-guardado"> ✅ Sigue Tu Expediente enviado</span>}
      {enviarTaMut.isSuccess && <span className="seg-guardado"> ✅ TeleAsistencia enviado</span>}
    </div>
  );
}

// ─── S5: Panel de comunicaciones asegurado/perjudicado ───────────────────────

function SeccionComunicacionesAsegurado({ exp }: { exp: SeguimientoExpediente }) {
  const updateComMut  = useUpdateComunicacionesAsegurado();
  const enviarSteMut  = useEnviarPanelCliente();
  const enviarTaMut   = useEnviarTeleAsistencia();
  const [modalEmail, setModalEmail] = useState(false);

  const a = exp.asegurado;

  // Estado local editable
  const [consentimientoCom, setConsentimientoCom] = useState<'acepta' | 'rechaza' | null>(
    a.consentimiento_com ?? null,
  );
  const [consentimientoTipo, setConsentimientoTipo] = useState<'sms' | 'email' | 'ambos' | null>(
    a.consentimiento_tipo ?? 'sms',
  );
  const [tel1, setTel1]           = useState(a.telefono ?? '');
  const [tel1Desc, setTel1Desc]   = useState(a.telefono_desc ?? '');
  const [tel1Mov, setTel1Mov]     = useState(a.telefono_movil ?? false);
  const [tel2, setTel2]           = useState(a.telefono2 ?? '');
  const [tel2Desc, setTel2Desc]   = useState(a.telefono2_desc ?? '');
  const [tel2Mov, setTel2Mov]     = useState(a.telefono2_movil ?? false);
  const [tel3, setTel3]           = useState(a.telefono3 ?? '');
  const [tel3Desc, setTel3Desc]   = useState(a.telefono3_desc ?? '');
  const [tel3Mov, setTel3Mov]     = useState(a.telefono3_movil ?? false);
  const [prioridad, setPrioridad] = useState<number>(a.telefono_prioridad ?? 1);
  const [email, setEmail]         = useState(a.email ?? '');
  const [dirty, setDirty]         = useState(false);

  const mark = () => setDirty(true);

  const handleConsentimientoChange = (val: 'acepta' | 'rechaza') => {
    setConsentimientoCom(val);
    mark();
  };

  const handleTipoChange = (val: 'sms' | 'email' | 'ambos') => {
    setConsentimientoTipo(val);
    mark();
  };

  const handleTelChange = (field: string, value: string | boolean) => {
    switch (field) {
      case 'telefono':        setTel1(value as string); break;
      case 'telefono_desc':   setTel1Desc(value as string); break;
      case 'telefono_movil':  setTel1Mov(value as boolean); break;
      case 'telefono2':       setTel2(value as string); break;
      case 'telefono2_desc':  setTel2Desc(value as string); break;
      case 'telefono2_movil': setTel2Mov(value as boolean); break;
      case 'telefono3':       setTel3(value as string); break;
      case 'telefono3_desc':  setTel3Desc(value as string); break;
      case 'telefono3_movil': setTel3Mov(value as boolean); break;
      case 'telefono_prioridad': setPrioridad(Number(value)); break;
    }
    mark();
  };

  const handleGuardar = async () => {
    await updateComMut.mutateAsync({
      expedienteId: exp.id,
      asegurado_id: a.id,
      consentimiento_com: consentimientoCom ?? undefined,
      consentimiento_tipo: consentimientoTipo ?? undefined,
      telefono: tel1,
      telefono_desc: tel1Desc,
      telefono_movil: tel1Mov,
      telefono_prioridad: prioridad,
      telefono2: tel2,
      telefono2_desc: tel2Desc,
      telefono2_movil: tel2Mov,
      telefono3: tel3,
      telefono3_desc: tel3Desc,
      telefono3_movil: tel3Mov,
      email,
    });
    setDirty(false);
  };

  const handleSteEmail = async () => {
    if (!email.trim()) return;
    await enviarSteMut.mutateAsync({ expedienteId: exp.id, canal: 'email', email });
  };

  const handleTaEmail = async () => {
    if (!email.trim()) return;
    await enviarTaMut.mutateAsync({ expedienteId: exp.id, canal: 'email', email });
  };

  return (
    <div className="seg-comunicaciones-asegurado">
      {/* Consentimiento */}
      <div className="seg-consentimiento-header">
        <span className="seg-label seg-label--consent">
          Consentimiento comunicaciones {a.nombre} {a.apellidos}
        </span>
      </div>

      <div className="seg-consentimiento-grid">
        {/* Acepta / Rechaza */}
        <div className="seg-consent-grupo">
          <label className="seg-check">
            <input
              type="radio"
              name={`consent_com_${a.id}`}
              value="acepta"
              checked={consentimientoCom === 'acepta'}
              onChange={() => handleConsentimientoChange('acepta')}
            />
            Acepta
          </label>
          <label className="seg-check">
            <input
              type="radio"
              name={`consent_com_${a.id}`}
              value="rechaza"
              checked={consentimientoCom === 'rechaza'}
              onChange={() => handleConsentimientoChange('rechaza')}
            />
            Rechaza
          </label>
        </div>

        {/* Tipo de comunicación preferida */}
        <div className="seg-consent-grupo">
          <label className="seg-check">
            <input
              type="radio"
              name={`consent_tipo_${a.id}`}
              value="sms"
              checked={consentimientoTipo === 'sms'}
              onChange={() => handleTipoChange('sms')}
            />
            SMS
          </label>
          <label className="seg-check">
            <input
              type="radio"
              name={`consent_tipo_${a.id}`}
              value="email"
              checked={consentimientoTipo === 'email'}
              onChange={() => handleTipoChange('email')}
            />
            Email
          </label>
          <label className="seg-check">
            <input
              type="radio"
              name={`consent_tipo_${a.id}`}
              value="ambos"
              checked={consentimientoTipo === 'ambos'}
              onChange={() => handleTipoChange('ambos')}
            />
            Ambos
          </label>
        </div>
      </div>

      {/* Teléfono 1 */}
      <BloquetelefOno
        numero={tel1}
        descripcion={tel1Desc}
        esMovil={tel1Mov}
        esPrioritario={prioridad === 1}
        indice={1}
        expedienteId={exp.id}
        emailParaModal={email}
        onChange={handleTelChange}
      />

      {/* Teléfono 2 */}
      <BloquetelefOno
        numero={tel2}
        descripcion={tel2Desc}
        esMovil={tel2Mov}
        esPrioritario={prioridad === 2}
        indice={2}
        expedienteId={exp.id}
        emailParaModal={email}
        onChange={handleTelChange}
      />

      {/* Teléfono 3 */}
      <BloquetelefOno
        numero={tel3}
        descripcion={tel3Desc}
        esMovil={tel3Mov}
        esPrioritario={prioridad === 3}
        indice={3}
        expedienteId={exp.id}
        emailParaModal={email}
        onChange={handleTelChange}
      />

      {/* Email */}
      <div className="seg-email-bloque">
        <div className="seg-tel-fila">
          <label className="seg-label seg-label--tel">Email</label>
          <input
            type="email"
            className="seg-input seg-input--email seg-input--amarillo"
            value={email}
            onChange={(e) => { setEmail(e.target.value); mark(); }}
            placeholder="email@ejemplo.com"
          />
        </div>
        <div className="seg-tel-acciones">
          <button
            type="button"
            className="btn btn-sm btn-ste"
            onClick={handleSteEmail}
            disabled={!email.trim() || enviarSteMut.isPending}
          >
            Sigue Tu Expediente
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ta"
            onClick={handleTaEmail}
            disabled={!email.trim() || enviarTaMut.isPending}
          >
            TeleAsistencia
          </button>
          <button
            type="button"
            className="btn btn-sm btn-email"
            onClick={() => setModalEmail(true)}
            disabled={!email.trim()}
          >
            ✉ Email
          </button>
        </div>
      </div>

      {/* Guardar cambios de contacto */}
      {dirty && (
        <div className="seg-form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGuardar}
            disabled={updateComMut.isPending}
          >
            {updateComMut.isPending ? 'Guardando…' : 'Guardar datos de contacto'}
          </button>
          {updateComMut.isSuccess && <span className="seg-guardado"> ✅ Guardado</span>}
          {updateComMut.isError && <span className="seg-error"> ❌ Error al guardar</span>}
        </div>
      )}

      {/* Modal email */}
      {modalEmail && (
        <ModalEmail
          expedienteId={exp.id}
          emailPredefinido={email}
          onClose={() => setModalEmail(false)}
        />
      )}
    </div>
  );
}

// ─── Sección: Datos del asegurado (read-only) ─────────────────────────────────

function SeccionAsegurado({ exp }: { exp: SeguimientoExpediente }) {
  const a = exp.asegurado;
  return (
    <div className="seg-asegurado">
      <div className="seg-asegurado-nombre">
        <strong>{a.nombre} {a.apellidos}</strong>
        {a.nif && <span className="seg-nif"> · NIF: {a.nif}</span>}
      </div>
      <div className="seg-asegurado-dir">
        {a.direccion}, {a.codigo_postal} {a.localidad} ({a.provincia})
      </div>
    </div>
  );
}


// ─── S7: Pedidos de material (con formulario inline) ─────────────────────────

const ESTADOS_PEDIDO = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];

function SeccionPedidos({
  expedienteId,
  pedidos,
}: {
  expedienteId: string;
  pedidos: SeguimientoPedido[];
}) {
  const crearMut    = useCrearPedidoExpediente();
  const cambiarMut  = useCambiarEstadoPedido();
  const eliminarMut = useEliminarPedidoExpediente();

  const { data: provData } = useProveedores({ activo: true });
  const proveedores: Array<{ id: string; nombre: string }> =
    provData && 'data' in provData
      ? (((provData.data as unknown) as any)?.items ?? [])
      : [];

  const [showForm, setShowForm]           = useState(false);
  const [proveedorId, setProveedorId]     = useState('');
  const [descripcion, setDescripcion]     = useState('');
  const [fechaLimite, setFechaLimite]     = useState('');

  const handleCrear = async () => {
    if (!proveedorId || !descripcion.trim()) return;
    await crearMut.mutateAsync({
      expedienteId,
      proveedor_id: proveedorId,
      descripcion,
      fecha_limite: fechaLimite || null,
    });
    setProveedorId(''); setDescripcion(''); setFechaLimite('');
    setShowForm(false);
  };

  const handleEliminar = (pedidoId: string) => {
    if (window.confirm('¿Eliminar este pedido?')) {
      eliminarMut.mutate({ expedienteId, pedidoId });
    }
  };

  return (
    <div className="seg-pedidos">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setShowForm((s) => !s)}
      >
        {showForm ? 'Cancelar' : '+ Añadir pedido'}
      </button>

      {showForm && (
        <div className="seg-pedido-form seg-form-grid">
          <div className="seg-form-field">
            <label className="seg-label">Proveedor <span className="req">*</span></label>
            <select
              className="seg-select"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">Seleccione proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Fecha límite</label>
            <input
              type="date"
              className="seg-input"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
          </div>
          <div className="seg-form-field seg-form-field--full">
            <label className="seg-label">Descripción material <span className="req">*</span></label>
            <textarea
              className="seg-textarea"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del material solicitado…"
            />
          </div>
          <div className="seg-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!proveedorId || !descripcion.trim() || crearMut.isPending}
              onClick={handleCrear}
            >
              {crearMut.isPending ? 'Añadiendo…' : 'Añadir'}
            </button>
          </div>
        </div>
      )}

      {pedidos.length === 0 ? (
        <p className="seg-vacio">No hay pedidos registrados.</p>
      ) : (
        <table className="seg-tabla">
          <thead>
            <tr>
              <th>Proveedor</th><th>Descripción</th><th>Creación</th>
              <th>Límite</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{p.proveedor?.nombre ?? '—'}</td>
                <td>{p.descripcion}</td>
                <td className="td-fecha">{fmt(p.fecha_creacion)}</td>
                <td className={p.fecha_limite && new Date(p.fecha_limite) < new Date() ? 'td-vencido' : ''}>
                  {fmt(p.fecha_limite)}
                </td>
                <td>
                  <select
                    className="seg-select seg-select--sm"
                    value={p.estado}
                    onChange={(e) =>
                      cambiarMut.mutate({ expedienteId, pedidoId: p.id, estado: e.target.value })
                    }
                  >
                    {ESTADOS_PEDIDO.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </td>
                <td className="td-accion td-centro">
                  <button
                    type="button"
                    className="btn-eliminar"
                    onClick={() => handleEliminar(p.id)}
                    title="Eliminar pedido"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── S11: Sección Incidencias (extendida Bloque 3) ───────────────────────────

function SeccionIncidencias({
  expedienteId,
  incidencias,
  visitas,
}: {
  expedienteId: string;
  incidencias: SeguimientoIncidencia[];
  visitas: SeguimientoVisita[];
}) {
  const crearMut = useCrearIncidencia();
  const elimMut  = useEliminarIncidencia();

  const [showForm, setShowForm]             = useState(false);
  const [texto, setTexto]                   = useState('');
  const [tipologia, setTipologia]           = useState('');
  const [nivelRga, setNivelRga]             = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('');
  const [operarioSel, setOperarioSel]       = useState('');
  const [plataforma, setPlataforma]         = useState('');
  const [procIncidencia, setProcIncidencia] = useState('');
  const [interna, setInterna]               = useState(false);

  // Operarios únicos del expediente (extraídos de las visitas)
  const operariosExpediente = Array.from(
    new Map(
      visitas
        .filter((v) => v.operario)
        .map((v) => [v.operario!.id, v.operario!])
    ).values()
  );

  const handleCrear = async () => {
    if (!texto.trim()) return;
    await crearMut.mutateAsync({
      expediente_id:               expedienteId,
      texto,
      tipologia:                   tipologia || undefined,
      nivel_rga:                   nivelRga || undefined,
      tipo_incidencia:             tipoIncidencia || null,
      plataforma_usuario_nombre:   plataforma || null,
      proc_incidencia:             procIncidencia || null,
      interna,
      imputada_a:                  operarioSel || undefined,
    });
    setTexto(''); setTipologia(''); setNivelRga('');
    setTipoIncidencia(''); setOperarioSel(''); setPlataforma('');
    setProcIncidencia(''); setInterna(false);
    setShowForm(false);
  };

  const handleEliminar = (id: string) => {
    if (window.confirm('¿Eliminar esta incidencia?')) {
      elimMut.mutate({ expedienteId, incidenciaId: id });
    }
  };

  return (
    <div className="seg-incidencias">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setShowForm((s) => !s)}
      >
        {showForm ? 'Cancelar' : '+ Añadir incidencia'}
      </button>

      {showForm && (
        <div className="seg-incidencia-form">
          <div className="seg-form-grid">
            {/* Tipo incidencia */}
            <div className="seg-form-field">
              <label className="seg-label">Origen</label>
              <select
                className="seg-select"
                value={tipoIncidencia}
                onChange={(e) => setTipoIncidencia(e.target.value)}
              >
                <option value="">— Seleccione origen —</option>
                {TIPO_INCIDENCIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Operario del expediente */}
            <div className="seg-form-field">
              <label className="seg-label">Operario</label>
              <select
                className="seg-select"
                value={operarioSel}
                onChange={(e) => setOperarioSel(e.target.value)}
              >
                <option value="">— Seleccione operario —</option>
                {operariosExpediente.map((op) => (
                  <option key={op.id} value={`${op.nombre} ${op.apellidos}`}>
                    {op.nombre} {op.apellidos}
                  </option>
                ))}
              </select>
            </div>

            {/* Plataforma (usuario libre) */}
            <div className="seg-form-field">
              <label className="seg-label">Plataforma / usuario</label>
              <input
                type="text"
                className="seg-input"
                value={plataforma}
                onChange={(e) => setPlataforma(e.target.value)}
                placeholder="Nombre usuario plataforma"
              />
            </div>

            {/* Tipología */}
            <div className="seg-form-field">
              <label className="seg-label">Tipología</label>
              <select
                className="seg-select"
                value={tipologia}
                onChange={(e) => setTipologia(e.target.value)}
              >
                <option value="">— Seleccione tipo —</option>
                {TIPOLOGIA_INCIDENCIA_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* ¿Procedente? */}
            <div className="seg-form-field">
              <label className="seg-label">¿Procedente?</label>
              <select
                className="seg-select"
                value={procIncidencia}
                onChange={(e) => setProcIncidencia(e.target.value)}
              >
                <option value="">— ¿Es Procedente? —</option>
                {PROC_INCIDENCIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Nivel RGA */}
            <div className="seg-form-field">
              <label className="seg-label">Nivel RGA</label>
              <input
                type="text"
                className="seg-input"
                value={nivelRga}
                onChange={(e) => setNivelRga(e.target.value)}
              />
            </div>

            {/* Texto */}
            <div className="seg-form-field seg-form-field--full">
              <label className="seg-label">Descripción <span className="req">*</span></label>
              <textarea
                className="seg-textarea"
                rows={3}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Descripción de la incidencia…"
              />
            </div>

            {/* Interna */}
            <div className="seg-form-field">
              <label className="seg-check">
                <input
                  type="checkbox"
                  checked={interna}
                  onChange={(e) => setInterna(e.target.checked)}
                />
                Incidencia interna (no visible al exterior)
              </label>
            </div>
          </div>
          <div className="seg-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!texto.trim() || crearMut.isPending}
              onClick={handleCrear}
            >
              {crearMut.isPending ? 'Guardando…' : 'Insertar incidencia'}
            </button>
          </div>
        </div>
      )}

      {incidencias.length === 0 ? (
        <p className="seg-vacio">No hay incidencias registradas.</p>
      ) : (
        <table className="seg-tabla">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Tipología</th><th>Descripción</th>
              <th>¿Proc.?</th><th>Interna</th><th>Nivel RGA</th><th></th>
            </tr>
          </thead>
          <tbody>
            {incidencias.map((inc) => (
              <tr key={inc.id}>
                <td className="td-fecha">{fmtDatetime(inc.fecha)}</td>
                <td>{inc.tipo_incidencia ?? inc.origen ?? '—'}</td>
                <td>{inc.tipologia ?? '—'}</td>
                <td className="td-texto">{inc.texto}</td>
                <td className="td-centro">{inc.proc_incidencia ?? (inc.procedente ? 'Procedente' : '—')}</td>
                <td className="td-centro">{inc.interna ? '🔒' : '—'}</td>
                <td>{inc.nivel_rga ?? '—'}</td>
                <td className="td-accion td-centro">
                  <button
                    type="button"
                    className="btn-eliminar"
                    onClick={() => handleEliminar(inc.id)}
                    disabled={elimMut.isPending}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── S12: Encuesta de satisfacción ────────────────────────────────────────────

function SeccionEncuesta({
  expedienteId,
  visitas,
}: {
  expedienteId: string;
  visitas: SeguimientoVisita[];
}) {
  const enviarMut   = useEnviarEncuesta();
  const generarMut  = useGenerarDocumentoExpediente();
  const { data: plantillasRes } = usePlantillasExpediente(expedienteId);
  const plantillas = (plantillasRes as any)?.data ?? [];

  const [visitaSel, setVisitaSel]     = useState('');
  const [tipoEnc, setTipoEnc]         = useState('');
  const [plantillaSel, setPlantillaSel] = useState('');
  const [enviado, setEnviado]          = useState(false);
  const [generado, setGenerado]        = useState(false);

  const handleEnviar = async () => {
    if (!tipoEnc) return;
    await enviarMut.mutateAsync({
      expedienteId,
      visita_id: visitaSel || null,
      tipo_encuesta: tipoEnc,
    });
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3000);
  };

  const handleGenerar = async () => {
    if (!plantillaSel) return;
    await generarMut.mutateAsync({
      expedienteId,
      plantilla_id: plantillaSel,
      visita_id: visitaSel || null,
    });
    setGenerado(true);
    setTimeout(() => setGenerado(false), 3000);
  };

  return (
    <div className="seg-encuesta">
      <div className="seg-form-grid">
        <div className="seg-form-field">
          <label className="seg-label">Visita</label>
          <select
            className="seg-select"
            value={visitaSel}
            onChange={(e) => setVisitaSel(e.target.value)}
          >
            <option value="">General (sin visita específica)</option>
            {visitas.map((v) => (
              <option key={v.id} value={v.id}>
                {fmtDatetime(v.fecha_hora)}{v.operario ? ` — ${v.operario.nombre} ${v.operario.apellidos}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="seg-form-field">
          <label className="seg-label">Tipo encuesta</label>
          <select
            className="seg-select"
            value={tipoEnc}
            onChange={(e) => setTipoEnc(e.target.value)}
          >
            <option value="">— Seleccione tipo —</option>
            {TIPO_ENCUESTA_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* G3: Plantilla de documento */}
        {plantillas.length > 0 && (
          <div className="seg-form-field">
            <label className="seg-label">Documento a generar</label>
            <select
              className="seg-select"
              value={plantillaSel}
              onChange={(e) => setPlantillaSel(e.target.value)}
            >
              <option value="">— Seleccione documento —</option>
              {(plantillas as { id: string; nombre: string }[]).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="seg-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!tipoEnc || enviarMut.isPending}
          onClick={handleEnviar}
        >
          {enviado ? '✅ Enviado' : enviarMut.isPending ? 'Enviando…' : '✉ Envío Email'}
        </button>
        {plantillas.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!plantillaSel || generarMut.isPending}
            onClick={handleGenerar}
          >
            {generado ? '✅ Generado' : generarMut.isPending ? 'Generando…' : 'Generar'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── S13: Informe fotográfico / Gestión DOC ───────────────────────────────────

function ModalDatosAdicionales({
  expedienteId,
  campos,
  onClose,
}: {
  expedienteId: string;
  campos: CamposAdicionalesExpediente | null | undefined;
  onClose: () => void;
}) {
  const guardarMut = useGuardarCamposAdicionales();
  const [c82, setC82] = useState(campos?.campo_82 ?? '');
  const [c83, setC83] = useState(campos?.campo_83 ?? '');
  const [c84, setC84] = useState(campos?.campo_84 ?? '');
  const [c85, setC85] = useState(campos?.campo_85 ?? '');
  const [c86, setC86] = useState(campos?.campo_86 ?? '');
  const [c87, setC87] = useState(campos?.campo_87 ?? '');
  const [c88, setC88] = useState(campos?.campo_88 ?? '');
  const [c89, setC89] = useState(campos?.campo_89 ?? '');

  const handleGuardar = async () => {
    await guardarMut.mutateAsync({
      expedienteId,
      campo_82: c82 || null,
      campo_83: c83 || null,
      campo_84: c84 || null,
      campo_85: c85 || null,
      campo_86: c86 || null,
      campo_87: c87 || null,
      campo_88: c88 || null,
      campo_89: c89 || null,
    });
    onClose();
  };

  const campos_def = [
    { label: 'Material solicitado', val: c82, set: setC82 },
    { label: 'Marca / Modelo', val: c83, set: setC83 },
    { label: 'Medidas', val: c84, set: setC84 },
    { label: 'Entrada', val: c85, set: setC85 },
    { label: 'Salida', val: c86, set: setC86 },
    { label: 'Nombre quien recoge', val: c87, set: setC87 },
    { label: 'DNI / Fecha recogida', val: c88, set: setC88 },
    { label: 'Delegación a suministrar', val: c89, set: setC89 },
  ];

  return (
    <div className="seg-modal-overlay" onClick={onClose}>
      <div className="seg-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="seg-modal-header">
          <h3>Datos adicionales</h3>
          <button type="button" className="seg-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="seg-modal-body">
          {campos_def.map(({ label, val, set }) => (
            <div key={label} className="seg-form-field">
              <label className="seg-label">{label}</label>
              <input
                type="text"
                className="seg-input"
                value={val}
                onChange={(e) => set(e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="seg-modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGuardar}
            disabled={guardarMut.isPending}
          >
            {guardarMut.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SeccionInformeFotografico({
  expedienteId,
  visitas,
}: {
  expedienteId: string;
  visitas: SeguimientoVisita[];
}) {
  const { data: camposRes } = useCamposAdicionales(expedienteId);
  const campos = (camposRes as any)?.data as CamposAdicionalesExpediente | null;

  const [showModal, setShowModal]       = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  // Todas las fotos de todas las visitas
  const todasFotos = visitas.flatMap((v) => [
    ...v.fotos_antes.map((f) => ({ ...f, visita_id: v.id, tipo: 'antes' as const })),
    ...v.fotos_despues.map((f) => ({ ...f, visita_id: v.id, tipo: 'despues' as const })),
  ]);

  const toggleFoto = (id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    if (seleccionadas.size === todasFotos.length) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(todasFotos.map((f) => f.id)));
    }
  };

  return (
    <div className="seg-gestion-doc">
      <div className="seg-form-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTodas}>
          {seleccionadas.size === todasFotos.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={seleccionadas.size === 0}
          onClick={() => alert(`Generando informe con ${seleccionadas.size} foto(s)… (pendiente integración)`)}
        >
          Generar informe ({seleccionadas.size})
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowModal(true)}
        >
          Datos adicionales
        </button>
      </div>

      {todasFotos.length === 0 ? (
        <p className="seg-vacio">No hay fotos disponibles en este expediente.</p>
      ) : (
        <div className="seg-fotos-gestiondoc">
          {visitas.map((v) => {
            const fotosVisita = [
              ...v.fotos_antes.map((f) => ({ ...f, tipo: 'antes' as const })),
              ...v.fotos_despues.map((f) => ({ ...f, tipo: 'despues' as const })),
            ];
            if (fotosVisita.length === 0) return null;
            return (
              <div key={v.id} className="seg-fotos-visita-bloque">
                <h4 className="seg-fotos-visita-titulo">
                  {fmtDatetime(v.fecha_hora)}
                  {v.operario ? ` — ${v.operario.nombre} ${v.operario.apellidos}` : ''}
                </h4>
                <div className="seg-fotos-grid">
                  {fotosVisita.map((f) => (
                    <label key={f.id} className="seg-foto-item">
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(f.id)}
                        onChange={() => toggleFoto(f.id)}
                      />
                      <span className="seg-foto-nombre" title={f.descripcion ?? f.archivo}>
                        {f.tipo === 'antes' ? '📷 ' : '✅ '}
                        {f.descripcion ?? f.archivo.split('/').pop() ?? f.archivo}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalDatosAdicionales
          expedienteId={expedienteId}
          campos={campos}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── S14: Adjuntos y Email (enhanced) ────────────────────────────────────────

function SeccionAdjuntos({
  expedienteId,
  documentos,
  asegurado,
  visitas,
}: {
  expedienteId: string;
  documentos: SeguimientoExpediente['documentos'];
  asegurado: SeguimientoExpediente['asegurado'];
  visitas: SeguimientoVisita[];
}) {
  const initUploadMut   = useIniciarSubidaAdjunto();
  const registrarMut    = useRegistrarAdjunto();
  const eliminarMut     = useEliminarAdjunto();
  const enviarEmailMut  = useEnviarEmailAdjuntos();

  const [uploadDesc, setUploadDesc]   = useState('');
  const [emailDest, setEmailDest]     = useState('');
  const [emailLibre, setEmailLibre]   = useState('');
  const [asunto, setAsunto]           = useState('');
  const [cuerpo, setCuerpo]           = useState('');
  const [adjSel, setAdjSel]           = useState<Set<string>>(new Set());
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [uploadOk, setUploadOk]       = useState(false);

  const operariosExpediente = Array.from(
    new Map(
      visitas.filter((v) => v.operario).map((v) => [v.operario!.id, v.operario!])
    ).values()
  );

  const destinatariosEmail = [
    ...(asegurado.email ? [{ label: `Asegurado — ${asegurado.email}`, value: asegurado.email }] : []),
    ...operariosExpediente.map((op) => ({
      label: `${op.nombre} ${op.apellidos}`,
      value: '',  // operario email not in type, user fills libre
    })),
  ];

  const toggleAdj = (id: string) => {
    setAdjSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const initRes = await initUploadMut.mutateAsync({
        expedienteId,
        nombre_original: file.name,
        mime_type: file.type,
      });
      const { signed_url, storage_path } = (initRes as any).data;
      // Upload directly to Supabase Storage
      await fetch(signed_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      await registrarMut.mutateAsync({
        expedienteId,
        tipo_documento: 'adjunto',
        descripcion: uploadDesc || null,
        storage_path,
        nombre_original: file.name,
        mime_type: file.type,
      });
      setUploadDesc('');
      setUploadOk(true);
      setTimeout(() => setUploadOk(false), 3000);
      e.target.value = '';
    } catch {
      alert('Error al subir el archivo. Inténtalo de nuevo.');
    }
  };

  const handleEliminar = (id: string, nombre: string) => {
    if (window.confirm(`¿Eliminar "${nombre}"?`)) {
      eliminarMut.mutate({ expedienteId, adjuntoId: id });
    }
  };

  const handleEnviarEmail = async () => {
    const destino = emailLibre.trim() || emailDest;
    if (!destino || !asunto.trim()) {
      alert('Rellena el destinatario y el asunto');
      return;
    }
    await enviarEmailMut.mutateAsync({
      expedienteId,
      email_destino: destino,
      email_libre: emailLibre || null,
      asunto,
      cuerpo,
      adjunto_ids: [...adjSel],
    });
    setShowEmailForm(false);
    setAdjSel(new Set());
    setCuerpo(''); setAsunto(''); setEmailDest(''); setEmailLibre('');
  };

  return (
    <div className="seg-adjuntos">
      {/* Galería de documentos */}
      {documentos.length === 0 ? (
        <p className="seg-vacio">No hay documentos adjuntos.</p>
      ) : (
        <table className="seg-tabla">
          <thead>
            <tr><th></th><th>Tipo</th><th>Descripción</th><th>Fecha</th><th>Descargar</th><th></th></tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id}>
                <td className="td-centro">
                  <input
                    type="checkbox"
                    checked={adjSel.has(d.id)}
                    onChange={() => toggleAdj(d.id)}
                  />
                </td>
                <td>{d.tipo_documento}</td>
                <td>{d.descripcion ?? '—'}</td>
                <td className="td-fecha">{fmt(d.fecha_subida)}</td>
                <td className="td-accion td-centro">
                  {d.signed_url ? (
                    <a href={d.signed_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                      ⬇
                    </a>
                  ) : '—'}
                </td>
                <td className="td-accion td-centro">
                  <button
                    type="button"
                    className="btn-eliminar"
                    onClick={() => handleEliminar(d.id, d.descripcion ?? d.archivo)}
                    disabled={eliminarMut.isPending}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Upload nuevo adjunto */}
      <div className="seg-adjunto-upload">
        <h4 className="seg-subtitulo">Subir documento</h4>
        <div className="seg-form-grid">
          <div className="seg-form-field">
            <label className="seg-label">Descripción</label>
            <input
              type="text"
              className="seg-input"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Descripción del documento"
            />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Archivo</label>
            <input
              type="file"
              className="seg-input"
              onChange={handleUpload}
              disabled={initUploadMut.isPending || registrarMut.isPending}
            />
          </div>
        </div>
        {uploadOk && <p className="seg-ok">✅ Archivo subido correctamente.</p>}
      </div>

      {/* Email con adjuntos */}
      <div className="seg-adjunto-email">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowEmailForm((s) => !s)}
        >
          {showEmailForm ? 'Cerrar email' : `✉ Enviar por email (${adjSel.size} sel.)`}
        </button>

        {showEmailForm && (
          <div className="seg-email-form">
            <div className="seg-form-grid">
              <div className="seg-form-field">
                <label className="seg-label">Destinatario</label>
                <select
                  className="seg-select"
                  value={emailDest}
                  onChange={(e) => setEmailDest(e.target.value)}
                >
                  <option value="">— Seleccione —</option>
                  {destinatariosEmail.map((d) => (
                    <option key={d.label} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="seg-form-field">
                <label className="seg-label">Email libre</label>
                <input
                  type="email"
                  className="seg-input"
                  value={emailLibre}
                  onChange={(e) => setEmailLibre(e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div className="seg-form-field seg-form-field--full">
                <label className="seg-label">Asunto <span className="req">*</span></label>
                <input
                  type="text"
                  className="seg-input"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                />
              </div>
              <div className="seg-form-field seg-form-field--full">
                <label className="seg-label">Cuerpo</label>
                <textarea
                  className="seg-textarea"
                  rows={4}
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                />
              </div>
            </div>
            <div className="seg-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={enviarEmailMut.isPending}
                onClick={handleEnviarEmail}
              >
                {enviarEmailMut.isPending ? 'Enviando…' : '✉ Enviar email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── S15: SMS programado ──────────────────────────────────────────────────────

function SeccionSMS({
  expedienteId,
  asegurado,
  visitas,
}: {
  expedienteId: string;
  asegurado: SeguimientoExpediente['asegurado'];
  visitas: SeguimientoVisita[];
}) {
  const enviarMut = useEnviarSmsExpediente();

  const [destNombre, setDestNombre]   = useState('');
  const [numero, setNumero]           = useState('');
  const [texto, setTexto]             = useState('');
  const [fechaProg, setFechaProg]     = useState('');
  const [enviado, setEnviado]         = useState(false);

  const MAX_CHARS = 160;

  // Opciones de destinatario
  const destinatarios = [
    ...(asegurado.telefono
      ? [{ label: `Asegurado — ${asegurado.nombre} ${asegurado.apellidos}`, numero: asegurado.telefono, nombre: `${asegurado.nombre} ${asegurado.apellidos}` }]
      : []),
    ...Array.from(
      new Map(
        visitas.filter((v) => v.operario).map((v) => [v.operario!.id, v.operario!])
      ).values()
    ).map((op) => ({
      label: `${op.nombre} ${op.apellidos} — ${op.telefono}`,
      numero: op.telefono,
      nombre: `${op.nombre} ${op.apellidos}`,
    })),
  ];

  const handleDestinatarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    if (!isNaN(idx) && destinatarios[idx]) {
      setNumero(destinatarios[idx].numero);
      setDestNombre(destinatarios[idx].nombre);
    }
  };

  const handleEnviar = async () => {
    if (!numero.trim() || !texto.trim()) return;
    await enviarMut.mutateAsync({
      expedienteId,
      destinatario_nombre: destNombre || numero,
      numero,
      texto,
      fecha_programada: fechaProg || null,
    });
    setTexto(''); setNumero(''); setDestNombre(''); setFechaProg('');
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3000);
  };

  return (
    <div className="seg-sms">
      <div className="seg-form-grid">
        {/* Destinatario */}
        <div className="seg-form-field">
          <label className="seg-label">Destinatario</label>
          <select className="seg-select" onChange={handleDestinatarioChange} defaultValue="">
            <option value="" disabled>— Seleccione destinatario —</option>
            {destinatarios.map((d, i) => (
              <option key={i} value={i}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Número */}
        <div className="seg-form-field">
          <label className="seg-label">Número <span className="req">*</span></label>
          <input
            type="tel"
            className="seg-input"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="+34 6XX XXX XXX"
          />
        </div>

        {/* Texto SMS */}
        <div className="seg-form-field seg-form-field--full">
          <label className="seg-label">
            Texto <span className="req">*</span>
            <span className={`seg-char-counter ${texto.length > MAX_CHARS ? 'seg-char-counter--over' : ''}`}>
              {texto.length} / {MAX_CHARS}
            </span>
          </label>
          <textarea
            className="seg-textarea"
            rows={3}
            maxLength={MAX_CHARS}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Texto del SMS (máximo 160 caracteres)…"
          />
        </div>

        {/* Envío programado */}
        <div className="seg-form-field">
          <label className="seg-label">Fecha/hora programada (opcional)</label>
          <input
            type="datetime-local"
            className="seg-input"
            value={fechaProg}
            onChange={(e) => setFechaProg(e.target.value)}
          />
        </div>
      </div>

      <div className="seg-form-actions">
        {enviado && <span className="seg-ok">✅ SMS registrado correctamente.</span>}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!numero.trim() || !texto.trim() || texto.length > MAX_CHARS || enviarMut.isPending}
          onClick={handleEnviar}
        >
          {enviarMut.isPending ? 'Enviando…' : fechaProg ? '⏰ Programar SMS' : '📱 Enviar SMS'}
        </button>
      </div>
    </div>
  );
}

// ─── S10: Notas internas (tramitadores + operarios) ──────────────────────────

function ModalNuevaNota({
  expedienteId,
  tipo,
  onClose,
}: {
  expedienteId: string;
  tipo: 'tramitador' | 'operario';
  onClose: () => void;
}) {
  const crearMut = useCrearNota();
  const [texto, setTexto] = useState('');
  const [alarmaFecha, setAlarmaFecha] = useState('');

  const handleGuardar = async () => {
    if (!texto.trim()) return;
    await crearMut.mutateAsync({
      expedienteId,
      tipo,
      texto,
      alarma_fecha: alarmaFecha || null,
    });
    onClose();
  };

  return (
    <div className="seg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="seg-modal">
        <div className="seg-modal-header">
          <h3>Añadir nota — {tipo === 'tramitador' ? 'Tramitadores' : 'Operarios'}</h3>
          <button type="button" className="seg-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="seg-modal-body">
          <div className="seg-form-field">
            <label className="seg-label">Nota <span className="req">*</span></label>
            <textarea
              className="seg-textarea"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Texto de la nota…"
              autoFocus
            />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Alarma (opcional)</label>
            <input
              type="datetime-local"
              className="seg-input"
              value={alarmaFecha}
              onChange={(e) => setAlarmaFecha(e.target.value)}
            />
          </div>
        </div>
        <div className="seg-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!texto.trim() || crearMut.isPending}
            onClick={handleGuardar}
          >
            {crearMut.isPending ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnaNotas({
  expedienteId,
  titulo,
  tipo,
  notas,
}: {
  expedienteId: string;
  titulo: string;
  tipo: 'tramitador' | 'operario';
  notas: NotaInterna[];
}) {
  const realizadaMut  = useMarcarNotaRealizada();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="seg-notas-columna">
      <div className="seg-notas-col-header">
        <span className="seg-notas-col-titulo">{titulo}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowModal(true)}
        >
          + Añadir nota
        </button>
      </div>

      {notas.length === 0 ? (
        <p className="seg-vacio">No hay notas.</p>
      ) : (
        <div className="seg-notas-lista">
          {notas.map((nota) => (
            <div
              key={nota.id}
              className={`seg-nota-card${nota.realizado ? ' seg-nota-card--realizado' : ''}`}
            >
              <div className="seg-nota-fecha">{fmtDatetime(nota.created_at)}</div>
              <div className="seg-nota-texto">
                {nota.texto}
                <span className="seg-nota-autor"> [{nota.autor_nombre}]</span>
              </div>
              {nota.alarma_fecha && (
                <div className="seg-nota-alarma">
                  ⏰ {fmtDatetime(nota.alarma_fecha)}
                  {nota.alarma_usuario_nombre && ` para ${nota.alarma_usuario_nombre}`}
                  {nota.alarma_tipo && ` · ${nota.alarma_tipo}`}
                  <span className={`seg-nota-alarma-estado seg-nota-alarma--${nota.alarma_estado.toLowerCase()}`}>
                    {nota.alarma_estado}
                  </span>
                </div>
              )}
              <div className="seg-nota-acciones">
                <label className="seg-check seg-check--sm">
                  <input
                    type="checkbox"
                    checked={nota.realizado}
                    onChange={(e) =>
                      realizadaMut.mutate({
                        expedienteId,
                        notaId: nota.id,
                        realizado: e.target.checked,
                      })
                    }
                  />
                  Realizado
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalNuevaNota
          expedienteId={expedienteId}
          tipo={tipo}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function SeccionNotasInternas({
  expedienteId,
  notasTramitador,
  notasOperario,
}: {
  expedienteId: string;
  notasTramitador: NotaInterna[];
  notasOperario: NotaInterna[];
}) {
  return (
    <div className="seg-notas-grid">
      <ColumnaNotas
        expedienteId={expedienteId}
        titulo="Tramitadores"
        tipo="tramitador"
        notas={notasTramitador}
      />
      <ColumnaNotas
        expedienteId={expedienteId}
        titulo="Operarios"
        tipo="operario"
        notas={notasOperario}
      />
    </div>
  );
}

// ─── S8: Trabajos en curso ────────────────────────────────────────────────────

function TablaTrabajos({
  expedienteId,
  trabajos,
}: {
  expedienteId: string;
  trabajos: TrabajoExpediente[];
}) {
  const actualizarMut = useActualizarEstadoTrabajo();
  const eliminarMut   = useEliminarTrabajo();
  const crearMut      = useCrearTrabajo();

  const [showForm, setShowForm]           = useState(false);
  const [descripcion, setDescripcion]     = useState('');
  const [especialidad, setEspecialidad]   = useState('');
  const [operarioNombre, setOperarioNombre] = useState('');

  const handleCrear = async () => {
    if (!descripcion.trim()) return;
    await crearMut.mutateAsync({
      expedienteId,
      descripcion,
      especialidad: especialidad || null,
      operario_nombre: operarioNombre || null,
    });
    setDescripcion(''); setEspecialidad(''); setOperarioNombre('');
    setShowForm(false);
  };

  // Agrupar por operario
  const grupos = trabajos.reduce<Record<string, TrabajoExpediente[]>>((acc, t) => {
    const key = t.operario_nombre ?? 'Sin operario';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="seg-trabajos">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setShowForm((s) => !s)}
      >
        {showForm ? 'Cancelar' : '+ Añadir trabajo'}
      </button>

      {showForm && (
        <div className="seg-form-grid seg-trabajos-form">
          <div className="seg-form-field">
            <label className="seg-label">Operario</label>
            <input type="text" className="seg-input" value={operarioNombre}
              onChange={(e) => setOperarioNombre(e.target.value)} placeholder="Nombre del operario" />
          </div>
          <div className="seg-form-field">
            <label className="seg-label">Especialidad</label>
            <input type="text" className="seg-input" value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)} placeholder="Ej: Fontanería" />
          </div>
          <div className="seg-form-field seg-form-field--full">
            <label className="seg-label">Descripción <span className="req">*</span></label>
            <input type="text" className="seg-input" value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del trabajo" />
          </div>
          <div className="seg-form-actions">
            <button type="button" className="btn btn-primary"
              disabled={!descripcion.trim() || crearMut.isPending} onClick={handleCrear}>
              {crearMut.isPending ? 'Añadiendo…' : 'Añadir'}
            </button>
          </div>
        </div>
      )}

      {trabajos.length === 0 ? (
        <p className="seg-vacio">No hay trabajos registrados.</p>
      ) : (
        <table className="seg-tabla">
          <thead>
            <tr>
              <th>Operario / Trabajo</th>
              <th className="td-centro">No iniciado</th>
              <th className="td-centro">Subsanado</th>
              <th>F. Asignación</th>
              <th>F. Cita</th>
              <th>F. Fin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grupos).map(([operario, items]) => (
              <>
                <tr key={`op-${operario}`} className="seg-trabajos-operario-row">
                  <td colSpan={7}><strong>{operario}</strong></td>
                </tr>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.especialidad && <span className="seg-trabajo-esp">[{t.especialidad}]</span>}
                      {' '}{t.descripcion}
                    </td>
                    <td className="td-centro">
                      <input
                        type="radio"
                        name={`estado-${t.id}`}
                        value="No iniciado"
                        checked={t.estado === 'No iniciado'}
                        onChange={() =>
                          actualizarMut.mutate({ expedienteId, trabajoId: t.id, estado: 'No iniciado' })
                        }
                      />
                    </td>
                    <td className="td-centro">
                      <input
                        type="radio"
                        name={`estado-${t.id}`}
                        value="Subsanado"
                        checked={t.estado === 'Subsanado'}
                        onChange={() =>
                          actualizarMut.mutate({ expedienteId, trabajoId: t.id, estado: 'Subsanado' })
                        }
                      />
                    </td>
                    <td className="td-fecha">{fmt(t.fecha_asignacion)}</td>
                    <td className="td-fecha">{fmt(t.fecha_cita)}</td>
                    <td className="td-fecha">{fmt(t.fecha_finalizacion)}</td>
                    <td className="td-accion td-centro">
                      <button
                        type="button"
                        className="btn-eliminar"
                        onClick={() => {
                          if (window.confirm('¿Eliminar este trabajo?')) {
                            eliminarMut.mutate({ expedienteId, trabajoId: t.id });
                          }
                        }}
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SeccionTrabajosEnCurso({
  expedienteId,
  visitas,
  trabajos,
}: {
  expedienteId: string;
  visitas: SeguimientoVisita[];
  trabajos: TrabajoExpediente[];
}) {
  return (
    <div className="seg-trabajos-seccion">
      {/* 8.2 Visitas con fotos */}
      {visitas.length > 0 && (
        <div className="seg-visitas">
          {visitas.map((v, idx) => (
            <VisitaCard key={v.id} visita={v} idx={idx} expedienteId={expedienteId} />
          ))}
        </div>
      )}

      {/* 8.4 Tabla de trabajos por operario */}
      <div className="seg-section-subtitle">Seguimiento de trabajos</div>
      <TablaTrabajos expedienteId={expedienteId} trabajos={trabajos} />
    </div>
  );
}

// Photo slideshow within a visit
function VisitaCard({
  visita: v,
  idx,
  expedienteId,
}: {
  visita: SeguimientoVisita;
  idx: number;
  expedienteId: string;
}) {
  const fotos = [...v.fotos_antes, ...v.fotos_despues];
  const [slideIdx, setSlideIdx]       = useState(0);
  const [open, setOpen]               = useState(false);
  const [modalAdicional, setModalAdicional] = useState(false);
  const [campo2, setCampo2]           = useState(v.campo_2 ?? '');
  const [campo2Saved, setCampo2Saved] = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);

  const actualizarMut  = useActualizarCampoVisita();
  const firmaMut       = useEnviarFirmaEmailVisita();

  const handleGuardarCampo2 = async () => {
    await actualizarMut.mutateAsync({ expedienteId, visitaId: v.id, campo_2: campo2 || null });
    setCampo2Saved(true);
    setTimeout(() => { setCampo2Saved(false); setModalAdicional(false); }, 1500);
  };

  const handleFirmaEmail = async () => {
    setMenuOpen(false);
    if (!window.confirm('¿Enviar enlace de firma STE al asegurado para esta visita?')) return;
    await firmaMut.mutateAsync({ expedienteId, visitaId: v.id });
  };

  return (
    <div className="seg-visita-card">
      <div className="seg-visita-header">
        <span className="seg-visita-num">Visita {idx + 1}</span>
        <span className="seg-visita-fecha">{fmtDatetime(v.fecha_hora)}</span>
        <span className={`seg-visita-estado seg-visita-estado--${v.estado}`}>{v.estado}</span>
        {v.operario && (
          <span className="seg-visita-operario">
            🔧 {v.operario.nombre} {v.operario.apellidos} · {v.operario.telefono}
          </span>
        )}
        <div className="seg-visita-acciones">
          {fotos.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setOpen((s) => !s)}>
              📷 {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
            </button>
          )}
          {/* G2: Datos adicionales */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setModalAdicional(true)}
            title="Datos adicionales de la visita"
          >
            📋 Datos adicionales
          </button>
          {/* G4: Dropdown acciones */}
          <div className="seg-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setMenuOpen((s) => !s)}
              title="Más acciones"
            >
              ⬡ Acciones ▾
            </button>
            {menuOpen && (
              <div className="seg-dropdown-menu" style={{ position: 'absolute', right: 0, zIndex: 100, background: '#fff', border: '1px solid #ccc', borderRadius: 4, minWidth: 180 }}>
                <button
                  type="button"
                  className="seg-dropdown-item"
                  onClick={() => { setMenuOpen(false); handleFirmaEmail(); }}
                >
                  ✍ Firma STE Email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* G2: Modal datos adicionales visita */}
      {modalAdicional && (
        <div className="seg-modal-overlay" onClick={() => setModalAdicional(false)}>
          <div className="seg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seg-modal-header">
              <span>Datos adicionales — Visita {idx + 1}</span>
              <button type="button" className="seg-modal-close" onClick={() => setModalAdicional(false)}>✕</button>
            </div>
            <div className="seg-modal-body">
              <div className="seg-form-field">
                <label className="seg-label">Observaciones / Datos adicionales</label>
                <textarea
                  className="seg-textarea"
                  rows={4}
                  value={campo2}
                  onChange={(e) => setCampo2(e.target.value)}
                  placeholder="Material, marca, modelo, observaciones…"
                />
              </div>
            </div>
            <div className="seg-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGuardarCampo2}
                disabled={actualizarMut.isPending}
              >
                {campo2Saved ? '✅ Guardado' : actualizarMut.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {v.campo_2 && !modalAdicional && (
        <p className="seg-visita-campo2"><em>📋 {v.campo_2}</em></p>
      )}

      {v.notas && <p className="seg-visita-notas">{v.notas}</p>}

      {open && fotos.length > 0 && (
        <div className="seg-slideshow">
          <div className="seg-slideshow-counter">{slideIdx + 1} / {fotos.length}</div>
          <div className="seg-slideshow-img-wrap">
            <button
              type="button"
              className="seg-slideshow-nav seg-slideshow-nav--prev"
              onClick={() => setSlideIdx((i) => (i - 1 + fotos.length) % fotos.length)}
              disabled={fotos.length <= 1}
            >❮</button>
            <img
              src={fotos[slideIdx].archivo}
              alt={fotos[slideIdx].descripcion ?? `Foto ${slideIdx + 1}`}
              className="seg-slideshow-img"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <button
              type="button"
              className="seg-slideshow-nav seg-slideshow-nav--next"
              onClick={() => setSlideIdx((i) => (i + 1) % fotos.length)}
              disabled={fotos.length <= 1}
            >❯</button>
          </div>
          {fotos[slideIdx].descripcion && (
            <p className="seg-slideshow-desc">{fotos[slideIdx].descripcion}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── S9: Comunicaciones ASITUR ────────────────────────────────────────────────

function SeccionComunicacionesAsitur({
  expedienteId,
  comunicaciones,
}: {
  expedienteId: string;
  comunicaciones: ComunicacionAsitur[];
}) {
  const enviarMut = useEnviarMensajeAsitur();

  const [tipoMensaje, setTipoMensaje] = useState('');
  const [contenido, setContenido]     = useState('');
  const [enviando, setEnviando]       = useState(false);

  const handleEnviar = async () => {
    if (!tipoMensaje || !contenido.trim()) return;
    setEnviando(true);
    try {
      await enviarMut.mutateAsync({ expedienteId, tipo_mensaje: tipoMensaje as any, contenido });
      setTipoMensaje(''); setContenido('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="seg-asitur">
      {/* Formulario de envío */}
      <div className="seg-asitur-form">
        <div className="seg-section-subtitle">Envío de mensajes</div>
        <div className="seg-form-grid">
          <div className="seg-form-field">
            <label className="seg-label">Tipo de mensaje <span className="req">*</span></label>
            <select
              className="seg-select"
              value={tipoMensaje}
              onChange={(e) => setTipoMensaje(e.target.value)}
            >
              <option value="">Seleccione tipo</option>
              {TIPOS_MENSAJE_ASITUR.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="seg-form-field seg-form-field--full">
            <label className="seg-label">Texto del mensaje</label>
            <textarea
              className="seg-textarea"
              rows={4}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Escriba el mensaje…"
            />
          </div>
          <div className="seg-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!tipoMensaje || !contenido.trim() || enviando}
              onClick={handleEnviar}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="seg-asitur-historial">
        <div className="seg-section-subtitle">
          Historial
          {comunicaciones.some((c) => !c.leido && c.direccion === 'entrante') && (
            <span className="badge badge-nuevo"> nuevos</span>
          )}
        </div>
        {comunicaciones.length === 0 ? (
          <p className="seg-vacio">No hay comunicaciones ASITUR.</p>
        ) : (
          <div className="seg-asitur-lista">
            {comunicaciones.map((c) => (
              <div
                key={c.id}
                className={`seg-asitur-msg seg-asitur-msg--${c.direccion}${!c.leido && c.direccion === 'entrante' ? ' seg-asitur-msg--nuevo' : ''}`}
              >
                <div className="seg-asitur-msg-header">
                  <span className="seg-asitur-tipo">
                    {TIPOS_MENSAJE_ASITUR.find((t) => t.value === c.tipo_mensaje)?.label ?? c.tipo_mensaje}
                  </span>
                  <span className="seg-asitur-dir">{c.direccion === 'saliente' ? '↑ Enviado' : '↓ Recibido'}</span>
                  <span className="seg-asitur-fecha">{fmtDatetime(c.created_at)}</span>
                  <span className="seg-asitur-actor">{c.actor_nombre}</span>
                </div>
                <p className="seg-asitur-contenido">{c.contenido}</p>
                {c.adjunto_nombre && (
                  <div className="seg-asitur-adjunto">📎 {c.adjunto_nombre}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sección: Historial de comunicaciones ─────────────────────────────────────

function SeccionComunicaciones({ comunicaciones }: { comunicaciones: SeguimientoExpediente['comunicaciones'] }) {
  if (comunicaciones.length === 0) {
    return <p className="seg-vacio">No hay comunicaciones registradas.</p>;
  }

  const iconTipo: Record<string, string> = {
    sms: '📱', email: '📧', email_saliente: '📧', llamada: '📞',
    nota: '📝', nota_interna: '📝', sistema: '⚙️',
  };

  return (
    <div className="seg-comunicaciones">
      {comunicaciones.map((c) => (
        <div key={c.id} className={`seg-com-fila seg-com-${c.tipo}`}>
          <span className="seg-com-icono">{iconTipo[c.tipo] ?? '💬'}</span>
          <div className="seg-com-body">
            <div className="seg-com-meta">
              <span className="seg-com-tipo">{c.tipo.toUpperCase()}</span>
              {c.destinatario && <span className="seg-com-dest">{c.destinatario}</span>}
              <span className="seg-com-fecha">{fmtDatetime(c.fecha_envio)}</span>
            </div>
            <p className="seg-com-texto">{c.contenido}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sección: Presupuestos ────────────────────────────────────────────────────

function SeccionPresupuestos({
  presupuestos,
  expedienteId,
  navigate,
}: {
  presupuestos: SeguimientoExpediente['presupuestos'];
  expedienteId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (presupuestos.length === 0) {
    return (
      <div>
        <p className="seg-vacio">No hay presupuestos.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(`/expedientes/${expedienteId}`)}
        >
          Gestionar presupuestos
        </button>
      </div>
    );
  }

  return (
    <div className="seg-presupuestos">
      <table className="seg-tabla">
        <thead>
          <tr><th>Nº</th><th>Estado</th><th>Importe</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {presupuestos.map((p) => (
            <tr key={p.id}>
              <td>{p.numero ?? '—'}</td>
              <td><span className={`badge badge-pres-${p.estado}`}>{p.estado}</span></td>
              <td>{fmtEur(p.importe)}</td>
              <td>{fmt(p.fecha_creacion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => navigate(`/presupuestos/${presupuestos[0]?.id}`)}
      >
        Ver detalle presupuesto
      </button>
    </div>
  );
}

// ─── Sección: Facturas ────────────────────────────────────────────────────────

function SeccionFacturas({ facturas }: { facturas: SeguimientoExpediente['facturas'] }) {
  if (facturas.length === 0) {
    return <p className="seg-vacio">No hay facturas emitidas.</p>;
  }

  return (
    <table className="seg-tabla">
      <thead>
        <tr>
          <th>Factura</th><th>Tipo</th><th>Base</th><th>IVA</th>
          <th>Total</th><th>Emitida</th><th>Enviada</th><th>Cobrada</th>
        </tr>
      </thead>
      <tbody>
        {facturas.map((f) => (
          <tr key={f.id}>
            <td className="td-num-factura">{f.numero_factura}</td>
            <td>{f.tipo}</td>
            <td className="td-importe">{fmtEur(f.base_imponible)}</td>
            <td className="td-importe">{fmtEur(f.iva)}</td>
            <td className="td-importe td-total"><strong>{fmtEur(f.total)}</strong></td>
            <td className="td-fecha">{fmt(f.fecha_emision)}</td>
            <td className="td-centro">{f.enviada ? '✅' : '—'}</td>
            <td className="td-centro">{f.cobrada ? '✅' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── S16: Email al operario ───────────────────────────────────────────────────

function SeccionEmailOperario({
  expedienteId,
  asegurado,
  visitas,
}: {
  expedienteId: string;
  asegurado: SeguimientoExpediente['asegurado'];
  visitas: SeguimientoVisita[];
}) {
  const enviarMut = useEnviarEmailOperario();

  const [emailDestino, setEmailDestino] = useState('');
  const [emailLibre, setEmailLibre]     = useState('');
  const [destNombre, setDestNombre]     = useState('');
  const [cuerpo, setCuerpo]             = useState('');
  const [enviado, setEnviado]           = useState(false);

  // Opciones de destinatario con email como valor
  const destinatarios = [
    ...(asegurado.email
      ? [{ label: `Asegurado — ${asegurado.nombre} ${asegurado.apellidos} <${asegurado.email}>`, email: asegurado.email, nombre: `${asegurado.nombre} ${asegurado.apellidos}` }]
      : []),
    ...Array.from(
      new Map(
        visitas.filter((v) => v.operario && (v.operario as any).email).map((v) => [v.operario!.id, v.operario!])
      ).values()
    ).map((op) => ({
      label: `${op.nombre} ${op.apellidos} — ${(op as any).email}`,
      email: (op as any).email as string,
      nombre: `${op.nombre} ${op.apellidos}`,
    })),
  ];

  const handleDestinatarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    if (!isNaN(idx) && destinatarios[idx]) {
      setEmailDestino(destinatarios[idx].email);
      setDestNombre(destinatarios[idx].nombre);
    }
  };

  const handleEnviar = async () => {
    if (!emailDestino.trim() && !emailLibre.trim()) return;
    if (!cuerpo.trim()) return;
    await enviarMut.mutateAsync({
      expedienteId,
      email_destino:  emailDestino || emailLibre,
      email_libre:    emailLibre || null,
      nombre_destino: destNombre || null,
      cuerpo,
    });
    setCuerpo(''); setEmailDestino(''); setEmailLibre(''); setDestNombre('');
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3000);
  };

  return (
    <div className="seg-email-operario">
      <div className="seg-form-grid">
        {/* Destinatario predefinido */}
        <div className="seg-form-field">
          <label className="seg-label">Destinatario</label>
          <select className="seg-select" onChange={handleDestinatarioChange} defaultValue="">
            <option value="" disabled>— Seleccione destinatario —</option>
            {destinatarios.map((d, i) => (
              <option key={i} value={i}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Email destino (auto-rellenado o libre) */}
        <div className="seg-form-field">
          <label className="seg-label">Email <span className="req">*</span></label>
          <input
            type="email"
            className="seg-input"
            value={emailLibre || emailDestino}
            onChange={(e) => {
              setEmailLibre(e.target.value);
              setEmailDestino('');
              setDestNombre('');
            }}
            placeholder="email@ejemplo.com"
          />
        </div>

        {/* Cuerpo del email */}
        <div className="seg-form-field seg-form-field--full">
          <label className="seg-label">Mensaje <span className="req">*</span></label>
          <textarea
            className="seg-textarea"
            rows={3}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Texto del email…"
          />
        </div>
      </div>

      <div className="seg-actions">
        <button
          type="button"
          className="seg-btn seg-btn--primary"
          onClick={handleEnviar}
          disabled={enviarMut.isPending || (!emailDestino.trim() && !emailLibre.trim()) || !cuerpo.trim()}
        >
          {enviarMut.isPending ? 'Enviando…' : 'Enviar Email'}
        </button>
        {enviado && <span className="seg-ok">✓ Email enviado</span>}
        {enviarMut.isError && (
          <span className="seg-error">Error al enviar el email</span>
        )}
      </div>
    </div>
  );
}

// ─── Sección Placeholder ──────────────────────────────────────────────────────

function SeccionPendiente({ descripcion }: { descripcion: string }) {
  return (
    <div className="seg-pendiente">
      <span className="seg-pendiente-icono">🔲</span>
      <p className="seg-pendiente-desc">{descripcion}</p>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export function SiniestroSeguimientoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: res, isLoading, isError, refetch } = useSeguimiento(id ?? null);
  const updateMut = useUpdateSiniestro();

  const exp: SeguimientoExpediente | null = (res as any)?.data ?? null;

  // ID del usuario actual (en producción viene del contexto de auth)
  const userId: string | null = null; // TODO: conectar con useAuth cuando esté disponible

  const handleUpdate = async (data: UpdateSiniestroRequest) => {
    if (!id) return;
    await updateMut.mutateAsync({ id, ...data });
    await refetch();
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="page-seguimiento page-seguimiento--loading">
        <div className="seg-spinner">Cargando expediente…</div>
      </div>
    );
  }

  if (isError || !exp) {
    return (
      <div className="page-seguimiento page-seguimiento--error">
        <div className="error-msg">
          No se ha podido cargar el expediente.{' '}
          <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-seguimiento">

      {/* ── S1: Barra de presencia (fixed) ── */}
      {id && (
        <BarraPresencia expedienteId={id} userId={userId} />
      )}

      {/* ── Top bar de navegación ── */}
      <div className="seg-topbar">
        <button type="button" className="btn btn-sm" onClick={() => window.close()}>
          ✕ Cerrar
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(`/expedientes/${id}`)}
        >
          Ver expediente completo
        </button>
        {updateMut.isPending && <span className="seg-guardando">Guardando…</span>}
        {updateMut.isSuccess && <span className="seg-guardado">✅ Guardado</span>}
      </div>

      {/* ── S2+S3: Tramitador + Cabecera ── */}
      <CabeceraExpediente exp={exp} />

      {id && (
        <TramitadorSelector
          expedienteId={id}
          tramitadorActual={exp.tramitador}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECCIONES DEL EXPEDIENTE
          ════════════════════════════════════════════════════════════════════ */}

      {/* S3: Estado general + tipos compañía + eventos */}
      <Seccion titulo="Estado general del expediente" defaultOpen>
        <SeccionEstadoGeneral exp={exp} onSave={handleUpdate} />
      </Seccion>

      {/* S4: Notificación al asegurado */}
      <Seccion titulo="Notificación al asegurado" defaultOpen>
        <SeccionNotificarAsegurado exp={exp} />
      </Seccion>

      {/* S5: Comunicaciones asegurado/perjudicado */}
      <Seccion titulo="Comunicaciones asegurado/perjudicado" defaultOpen>
        <SeccionComunicacionesAsegurado exp={exp} />
      </Seccion>

      {/* Datos del asegurado (lectura) */}
      <Seccion titulo="Datos del asegurado" defaultOpen>
        <SeccionAsegurado exp={exp} />
      </Seccion>

      {/* S6: Planning */}
      <Seccion titulo="Planning / Calendario de citas" defaultOpen={false} badge={exp.visitas.length}>
        <div className="seg-planning">
          <p className="seg-planning-info">
            Vista de planificación de citas. Aquí se gestiona el calendario del expediente.
          </p>
          {exp.visitas.length > 0 ? (
            <table className="seg-tabla">
              <thead>
                <tr><th>Fecha/Hora</th><th>Operario</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {exp.visitas.map((v) => (
                  <tr key={v.id}>
                    <td className="td-fecha">{fmtDatetime(v.fecha_hora)}</td>
                    <td>{v.operario ? `${v.operario.nombre} ${v.operario.apellidos}` : '—'}</td>
                    <td><span className={`seg-visita-estado seg-visita-estado--${v.estado}`}>{v.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="seg-vacio">No hay citas programadas.</p>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/planning?expediente=${id}`)}
          >
            Ir a Planning completo →
          </button>
        </div>
      </Seccion>

      {/* S7: Pedidos de material */}
      <Seccion
        titulo="Pedidos de material"
        defaultOpen={false}
        badge={exp.pedidos.length}
      >
        <SeccionPedidos expedienteId={exp.id} pedidos={exp.pedidos} />
      </Seccion>

      {/* S8: Trabajos en curso */}
      <Seccion
        titulo="Trabajos en curso"
        defaultOpen={exp.visitas.length > 0}
        badge={exp.visitas.length}
      >
        <SeccionTrabajosEnCurso
          expedienteId={exp.id}
          visitas={exp.visitas}
          trabajos={exp.trabajos ?? []}
        />
      </Seccion>

      {/* Incidencias */}
      <Seccion
        titulo="Incidencias"
        defaultOpen={false}
        badge={exp.incidencias.length}
      >
        <SeccionIncidencias
          expedienteId={exp.id}
          incidencias={exp.incidencias}
          visitas={exp.visitas}
        />
      </Seccion>

      {/* S10: Notas internas (tramitadores + operarios) */}
      <Seccion
        titulo="Notas"
        defaultOpen={(exp.notas_tramitador?.length ?? 0) > 0 || (exp.notas_operario?.length ?? 0) > 0}
        badge={(exp.notas_tramitador?.length ?? 0) + (exp.notas_operario?.length ?? 0)}
      >
        <SeccionNotasInternas
          expedienteId={exp.id}
          notasTramitador={exp.notas_tramitador ?? []}
          notasOperario={exp.notas_operario ?? []}
        />
      </Seccion>

      {/* S9: Comunicaciones ASITUR / INTERPWGS */}
      <Seccion
        titulo="Comunicaciones ASITUR / INTERPWGS"
        defaultOpen={(exp.comunicaciones_asitur?.length ?? 0) > 0}
        badge={exp.comunicaciones_asitur?.filter((c) => !c.leido && c.direccion === 'entrante').length}
      >
        <SeccionComunicacionesAsitur
          expedienteId={exp.id}
          comunicaciones={exp.comunicaciones_asitur ?? []}
        />
      </Seccion>

      {/* Historial de comunicaciones */}
      <Seccion
        titulo="Comunicaciones (historial)"
        defaultOpen={false}
        badge={exp.comunicaciones.length}
      >
        <SeccionComunicaciones comunicaciones={exp.comunicaciones} />
      </Seccion>

      {/* Presupuestos */}
      <Seccion
        titulo="Presupuestos"
        defaultOpen={false}
        badge={exp.presupuestos.length}
      >
        <SeccionPresupuestos
          presupuestos={exp.presupuestos}
          expedienteId={exp.id}
          navigate={navigate}
        />
      </Seccion>

      {/* Facturas */}
      <Seccion
        titulo="Facturas"
        defaultOpen={exp.facturas.length > 0}
        badge={exp.facturas.length}
      >
        <SeccionFacturas facturas={exp.facturas} />
      </Seccion>

      {/* S12: Encuesta de satisfacción */}
      <Seccion titulo="Encuesta de satisfacción" defaultOpen={false}>
        <SeccionEncuesta expedienteId={exp.id} visitas={exp.visitas} />
      </Seccion>

      {/* S13: Informe fotográfico / Gestión DOC */}
      <Seccion
        titulo="Informe fotográfico / Gestión DOC"
        defaultOpen={false}
        badge={exp.visitas.reduce((n, v) => n + v.fotos_antes.length + v.fotos_despues.length, 0) || undefined}
      >
        <SeccionInformeFotografico expedienteId={exp.id} visitas={exp.visitas} />
      </Seccion>

      {/* S14: Adjuntos y Email */}
      <Seccion
        titulo="Documentos adjuntos"
        defaultOpen={false}
        badge={exp.documentos.length}
      >
        <SeccionAdjuntos
          expedienteId={exp.id}
          documentos={exp.documentos}
          asegurado={exp.asegurado}
          visitas={exp.visitas}
        />
      </Seccion>

      {/* S15: SMS */}
      <Seccion titulo="SMS" defaultOpen={false}>
        <SeccionSMS
          expedienteId={exp.id}
          asegurado={exp.asegurado}
          visitas={exp.visitas}
        />
      </Seccion>

      {/* S16: EMAIL al operario */}
      <Seccion titulo="EMAIL" defaultOpen={false}>
        <SeccionEmailOperario
          expedienteId={exp.id}
          asegurado={exp.asegurado}
          visitas={exp.visitas}
        />
      </Seccion>

      {/* ── Secciones pendientes (bloques futuros) ── */}

      <Seccion titulo="Firma electrónica" defaultOpen={false}>
        <SeccionPendiente descripcion="Módulo de firma electrónica de documentos y partes de trabajo por parte del asegurado (digital/presencial)." />
      </Seccion>

      <Seccion titulo="Sigue Tu Expediente — Portal asegurado" defaultOpen={false}>
        <SeccionPendiente descripcion="Panel de gestión del tracking link del asegurado: generar enlace, revocar, reenviar. Conectar con customer-tracking-links." />
      </Seccion>
    </div>
  );
}
