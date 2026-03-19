import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type {
  CustomerTrackingConfirmCitaResponse,
  CustomerTrackingSolicitarCambioRequest,
  CustomerTrackingSolicitarCambioResponse,
  CustomerTrackingView,
} from '@erp/types';
import { CustomerPortalShell } from '@/components/CustomerPortalShell';
import { publicApi } from '@/lib/public-api';

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtTime(value: string) {
  return value.slice(0, 5);
}

export function CustomerTrackingPage() {
  const { token = '' } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [franjaSolicitada, setFranjaSolicitada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const tracking = useQuery({
    queryKey: ['customer-tracking', token],
    queryFn: () => publicApi.get<CustomerTrackingView>(`/public/customer-tracking/${token}`),
    refetchInterval: 30_000,
    enabled: Boolean(token),
  });

  const confirmMutation = useMutation({
    mutationFn: () => publicApi.post<CustomerTrackingConfirmCitaResponse>(`/public/customer-tracking/${token}/confirmar-cita`, {}),
    onSuccess: () => {
      setFeedback('La cita ha quedado confirmada.');
      queryClient.invalidateQueries({ queryKey: ['customer-tracking', token] });
    },
  });

  const changeMutation = useMutation({
    mutationFn: (payload: CustomerTrackingSolicitarCambioRequest) =>
      publicApi.post<CustomerTrackingSolicitarCambioResponse>(`/public/customer-tracking/${token}/solicitar-cambio`, payload),
    onSuccess: () => {
      setFeedback('Tu solicitud de cambio ha quedado registrada.');
      setFranjaSolicitada('');
      setMotivo('');
      queryClient.invalidateQueries({ queryKey: ['customer-tracking', token] });
    },
  });

  const result = tracking.data;
  const isError = result && 'error' in result && result.error;
  const data = result && 'data' in result ? result.data : null;

  return (
    <CustomerPortalShell
      title="Seguimiento de tu expediente"
      subtitle="Consulta el estado general, la cita actual y comunicate con la oficina sin acceder a informacion interna."
    >
      {tracking.isLoading && <div className="customer-card">Cargando seguimiento...</div>}

      {isError && (
        <div className="customer-card customer-card--error">
          <h2>Enlace no disponible</h2>
          <p>{result.error.message}</p>
        </div>
      )}

      {data && (
        <div className="customer-grid">
          <section className="customer-card customer-card--primary">
            <p className="customer-card__label">Estado general</p>
            <h2>{data.expediente.estado_label}</h2>
            <p className="customer-card__meta">Expediente {data.expediente.numero_expediente}</p>
            <p>{data.expediente.estado_resumen}</p>
          </section>

          <section className="customer-card">
            <p className="customer-card__label">Cita actual</p>
            {data.cita ? (
              <>
                <h2>{fmtDate(data.cita.fecha)}</h2>
                <p className="customer-card__meta">
                  {fmtTime(data.cita.franja_inicio)} - {fmtTime(data.cita.franja_fin)} · {data.cita.estado_label}
                </p>
                <p>
                  Tecnico autorizado:{' '}
                  <strong>{data.cita.tecnico?.identificacion ?? 'Pendiente de asignacion'}</strong>
                </p>
                {data.cita.customer_confirmed_at && (
                  <p className="customer-inline-ok">Confirmada por ti el {new Date(data.cita.customer_confirmed_at).toLocaleString('es-ES')}</p>
                )}
                {data.cita.customer_reschedule_status === 'pendiente' && (
                  <p className="customer-inline-note">
                    Solicitud de cambio pendiente para la franja "{data.cita.customer_reschedule_requested_slot}".
                  </p>
                )}
              </>
            ) : (
              <p>No hay una cita activa asociada a este expediente.</p>
            )}
          </section>

          <section className="customer-card">
            <p className="customer-card__label">Contacto</p>
            {data.contacto ? (
              <>
                <h2>{data.contacto.label}</h2>
                <p>{data.contacto.telefono ?? 'Telefono no disponible'}</p>
                <p>{data.contacto.email ?? 'Email no disponible'}</p>
              </>
            ) : (
              <p>La oficina compartira contigo el canal de contacto cuando sea necesario.</p>
            )}
          </section>

          <section className="customer-card customer-card--wide">
            <div className="customer-card__header">
              <div>
                <p className="customer-card__label">Timeline B2C</p>
                <h2>Evolucion resumida</h2>
              </div>
              <p className="customer-card__meta">Actualizacion automatica cada 30 segundos</p>
            </div>

            {data.timeline.length === 0 ? (
              <p>Sin hitos visibles por el momento.</p>
            ) : (
              <ul className="customer-timeline">
                {data.timeline.map((item) => (
                  <li key={item.id} className={`customer-timeline__item customer-timeline__item--${item.type}`}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.detail && <p>{item.detail}</p>}
                    </div>
                    <time>{new Date(item.created_at).toLocaleString('es-ES')}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="customer-card customer-card--wide">
            <div className="customer-card__header">
              <div>
                <p className="customer-card__label">Acciones</p>
                <h2>Gestion basica de cita</h2>
              </div>
            </div>

            {feedback && <div className="customer-feedback">{feedback}</div>}

            <div className="customer-actions">
              <div className="customer-action">
                <h3>Confirmar cita</h3>
                <p>Confirma tu asistencia para que la oficina mantenga la franja actual.</p>
                <button
                  className="btn-primary"
                  disabled={!data.cita?.can_confirm || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                >
                  {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar cita'}
                </button>
              </div>

              <form
                className="customer-action customer-action--form"
                onSubmit={(event) => {
                  event.preventDefault();
                  changeMutation.mutate({ franja_solicitada: franjaSolicitada, motivo });
                }}
              >
                <h3>Solicitar cambio</h3>
                <p>Indica una nueva franja deseada y el motivo para que la oficina la revise.</p>
                <label>
                  Nueva franja deseada
                  <input value={franjaSolicitada} onChange={(event) => setFranjaSolicitada(event.target.value)} placeholder="Ej. manana 16:00-18:00" />
                </label>
                <label>
                  Motivo
                  <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} rows={3} placeholder="Describe brevemente el motivo del cambio" />
                </label>
                <button
                  className="btn-secondary"
                  disabled={!data.cita?.can_request_change || changeMutation.isPending || !franjaSolicitada.trim() || !motivo.trim()}
                  type="submit"
                >
                  {changeMutation.isPending ? 'Enviando...' : 'Solicitar cambio'}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </CustomerPortalShell>
  );
}
