import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type {
  AutocitaConfirmarResponse,
  AutocitaSeleccionarRequest,
  AutocitaSeleccionarResponse,
  AutocitaSlot,
  AutocitaSlotsResponse,
  AutocitaView,
} from '@erp/types';
import { CustomerPortalShell } from '@/components/CustomerPortalShell';
import { publicApi } from '@/lib/public-api';

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtTime(value: string) {
  return value.slice(0, 5);
}

type Phase = 'view' | 'selecting' | 'done_confirm' | 'done_select' | 'error';

export function AutocitaPublicPage() {
  const { token = '' } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('view');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AutocitaSlot | null>(null);
  const [doneInfo, setDoneInfo] = useState<string | null>(null);

  // Initial view query
  const viewQuery = useQuery({
    queryKey: ['autocita-view', token],
    queryFn: () => publicApi.get<AutocitaView>(`/public/autocita/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  // Slots query — only fetched when client enters selection phase
  const slotsQuery = useQuery({
    queryKey: ['autocita-slots', token],
    queryFn: () => publicApi.get<AutocitaSlotsResponse>(`/public/autocita/${token}/slots`),
    enabled: phase === 'selecting',
    retry: false,
  });

  // Confirm proposed cita
  const confirmMutation = useMutation({
    mutationFn: () =>
      publicApi.post<AutocitaConfirmarResponse>(`/public/autocita/${token}/confirmar`, {}),
    onSuccess: (result) => {
      if ('data' in result && result.data) {
        setDoneInfo('Tu cita ha quedado confirmada. Te avisaremos 24h antes.');
        setPhase('done_confirm');
        queryClient.invalidateQueries({ queryKey: ['autocita-view', token] });
      } else if ('error' in result && result.error) {
        setErrorMsg(result.error.message);
      }
    },
    onError: () => setErrorMsg('Error al confirmar la cita. Por favor, inténtalo de nuevo.'),
  });

  // Select alternative slot
  const selectMutation = useMutation({
    mutationFn: (payload: AutocitaSeleccionarRequest) =>
      publicApi.post<AutocitaSeleccionarResponse>(`/public/autocita/${token}/seleccionar`, payload),
    onSuccess: (result) => {
      if ('data' in result && result.data) {
        const { nueva_fecha, nueva_franja_inicio, nueva_franja_fin } = result.data;
        setDoneInfo(`Tu nueva cita ha sido registrada: ${fmtDate(nueva_fecha)}, ${fmtTime(nueva_franja_inicio)}–${fmtTime(nueva_franja_fin)}.`);
        setPhase('done_select');
        queryClient.invalidateQueries({ queryKey: ['autocita-view', token] });
      } else if ('error' in result && result.error) {
        const code = result.error.code;
        if (code === 'SLOT_NO_DISPONIBLE') {
          setErrorMsg('Ese hueco ya no está disponible. Por favor, elige otro.');
          setSelectedSlot(null);
          queryClient.invalidateQueries({ queryKey: ['autocita-slots', token] });
        } else {
          setErrorMsg(result.error.message);
        }
      }
    },
    onError: () => setErrorMsg('Error al seleccionar el hueco. Por favor, inténtalo de nuevo.'),
  });

  // ── Resolved data ──
  const viewResult = viewQuery.data;
  const viewError = viewResult && 'error' in viewResult && viewResult.error ? viewResult.error : null;
  const view = viewResult && 'data' in viewResult ? viewResult.data : null;

  const slotsResult = slotsQuery.data;
  const slotsData = slotsResult && 'data' in slotsResult ? slotsResult.data : null;

  // ── Done screens ──
  if (phase === 'done_confirm' || phase === 'done_select') {
    return (
      <CustomerPortalShell title="Autocita" subtitle="">
        <div className="customer-card customer-card--success">
          <h2>{phase === 'done_confirm' ? '¡Cita confirmada!' : '¡Cambio registrado!'}</h2>
          <p>{doneInfo}</p>
        </div>
      </CustomerPortalShell>
    );
  }

  // ── Slot selection screen ──
  if (phase === 'selecting') {
    const groupedByDate = (slotsData?.slots ?? []).reduce<Record<string, AutocitaSlot[]>>((acc, slot) => {
      if (!acc[slot.fecha]) acc[slot.fecha] = [];
      acc[slot.fecha].push(slot);
      return acc;
    }, {});

    return (
      <CustomerPortalShell
        title="Elige una nueva franja"
        subtitle="Selecciona el horario que mejor se adapte a ti."
      >
        {slotsQuery.isLoading && <div className="customer-card">Buscando franjas disponibles...</div>}

        {slotsData?.mensaje_sin_huecos && (
          <div className="customer-card customer-card--warning">
            <p>{slotsData.mensaje_sin_huecos}</p>
          </div>
        )}

        {errorMsg && (
          <div className="customer-card customer-card--error">
            <p>{errorMsg}</p>
            <button className="btn-secondary" onClick={() => setErrorMsg(null)}>Cerrar</button>
          </div>
        )}

        {Object.entries(groupedByDate).map(([fecha, slots]) => (
          <div key={fecha} className="customer-card">
            <p className="customer-card__label">{fmtDate(fecha)}</p>
            <div className="autocita-slots-grid">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  className={`autocita-slot-btn${selectedSlot?.id === slot.id ? ' autocita-slot-btn--selected' : ''}${slot.alerta_sla ? ' autocita-slot-btn--sla-alert' : ''}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {fmtTime(slot.franja_inicio)}–{fmtTime(slot.franja_fin)}
                  {slot.alerta_sla && <span className="autocita-slot-sla-badge">⚠ SLA</span>}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="autocita-selection-actions">
          <button
            className="btn-ghost"
            onClick={() => { setPhase('view'); setSelectedSlot(null); setErrorMsg(null); }}
            disabled={selectMutation.isPending}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!selectedSlot || selectMutation.isPending}
            onClick={() => {
              if (!selectedSlot) return;
              selectMutation.mutate({ slot_id: selectedSlot.id });
            }}
          >
            {selectMutation.isPending ? 'Confirmando...' : 'Confirmar franja'}
          </button>
        </div>
      </CustomerPortalShell>
    );
  }

  // ── Main view ──
  return (
    <CustomerPortalShell
      title="Tu cita"
      subtitle="Gestiona tu visita sin necesidad de llamar."
    >
      {viewQuery.isLoading && (
        <div className="customer-card">Cargando información de tu cita...</div>
      )}

      {viewError && (
        <div className="customer-card customer-card--error">
          <h2>Enlace no disponible</h2>
          <p>
            {viewError.code === 'TOKEN_EXPIRADO'
              ? 'Este enlace ha caducado. Solicita uno nuevo a tu gestor.'
              : viewError.code === 'TOKEN_AGOTADO'
              ? 'Este enlace ya fue utilizado el número máximo de veces.'
              : viewError.code === 'TOKEN_REVOCADO'
              ? 'El enlace ha sido cancelado. Contacta con la oficina.'
              : 'El enlace no es válido. Verifica que la URL es correcta.'}
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="customer-card customer-card--error">
          <p>{errorMsg}</p>
          <button className="btn-secondary" onClick={() => setErrorMsg(null)}>Cerrar</button>
        </div>
      )}

      {view && (
        <div className="customer-grid">
          {/* Estado del expediente */}
          <section className="customer-card customer-card--primary">
            <p className="customer-card__label">Tu expediente</p>
            <h2>{view.expediente.estado_label}</h2>
            <p className="customer-card__meta">{view.expediente.tipo_siniestro}</p>
          </section>

          {/* SLA badge */}
          {view.sla && (
            <section className="customer-card">
              <p className="customer-card__label">Plazo de gestión</p>
              <span className={`badge badge-${view.sla.estado === 'ok' ? 'success' : 'danger'}`}>
                {view.sla.estado === 'ok' ? 'En plazo' : 'Plazo ajustado'}
              </span>
            </section>
          )}

          {/* Cita propuesta */}
          {view.cita_propuesta ? (
            <section className="customer-card">
              <p className="customer-card__label">Tu visita programada</p>
              <h3>{fmtDate(view.cita_propuesta.fecha)}</h3>
              <p>{fmtTime(view.cita_propuesta.franja_inicio)}–{fmtTime(view.cita_propuesta.franja_fin)}</p>
              {view.cita_propuesta.tecnico && (
                <p className="customer-card__meta">Técnico: {view.cita_propuesta.tecnico}</p>
              )}

              {confirmMutation.isError && (
                <p className="form-error">Error al confirmar. Inténtalo de nuevo.</p>
              )}

              <div className="autocita-cita-actions">
                {view.cita_propuesta.can_confirm && (
                  <button
                    className="btn-primary"
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar esta cita'}
                  </button>
                )}
                {view.cita_propuesta.can_request_change && (
                  <button
                    className="btn-secondary"
                    onClick={() => setPhase('selecting')}
                    disabled={confirmMutation.isPending}
                  >
                    Pedir cambio de franja ({view.cita_propuesta.cambios_restantes} restante{view.cita_propuesta.cambios_restantes !== 1 ? 's' : ''})
                  </button>
                )}
                {!view.cita_propuesta.can_confirm && !view.cita_propuesta.can_request_change && (
                  <p className="text-muted">
                    La cita ya está confirmada o no puede modificarse en este momento.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className="customer-card">
              <p className="customer-card__label">Próxima visita</p>
              <p>No tienes ninguna visita programada actualmente. Te avisaremos cuando se asigne una fecha.</p>
            </section>
          )}
        </div>
      )}
    </CustomerPortalShell>
  );
}
