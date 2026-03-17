import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OperatorClaimDetail } from '@erp/types';

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: res, isLoading, isError, refetch } = useQuery({
    queryKey: ['operator-claim', id],
    queryFn: () => api.get<OperatorClaimDetail>(`/claims/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div className="op-loading">Cargando...</div>;

  const apiError = res && 'error' in res && res.error ? res.error : null;
  const claim = res && 'data' in res ? res.data : null;

  if (isError || apiError || !claim) {
    return (
      <div className="op-error">
        {apiError?.message ?? 'Expediente no encontrado o no asignado'}
        <button onClick={() => refetch()} className="op-btn-secondary" style={{ marginLeft: '0.5rem' }}>Reintentar</button>
      </div>
    );
  }

  const c = claim as OperatorClaimDetail;
  const address = `${c.direccion_siniestro}, ${c.codigo_postal} ${c.localidad}`;
  const phone = c.asegurado?.telefono;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  const citaActiva = (c.citas ?? []).find(
    (ci) => ci.estado === 'programada' || ci.estado === 'confirmada'
  );
  const tieneParte = (ci: { id: string }) => (c.partes ?? []).some((p) => p.cita_id === ci.id);

  return (
    <div className="op-claim-detail">
      <div className="op-claim-header">
        <h2>{c.numero_expediente}</h2>
        <span className="op-badge">{c.tipo_siniestro}</span>
        <span className="op-badge">{c.prioridad}</span>
      </div>

      <section className="op-section">
        <p className="op-desc">{c.descripcion}</p>
      </section>

      <section className="op-section">
        <h3>Asegurado</h3>
        {c.asegurado && (
          <>
            <p className="op-client-name">{c.asegurado.nombre} {c.asegurado.apellidos}</p>
            <div className="op-quick-actions">
              {phone && (
                <a href={`tel:${phone}`} className="op-action-btn">Llamar {phone}</a>
              )}
              {c.asegurado.telefono2 && (
                <a href={`tel:${c.asegurado.telefono2}`} className="op-action-btn">Tel. 2: {c.asegurado.telefono2}</a>
              )}
            </div>
          </>
        )}
      </section>

      <section className="op-section">
        <h3>Dirección</h3>
        <p>{address}</p>
        <div className="op-quick-actions">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="op-action-btn">Navegar</a>
          <button className="op-action-btn" onClick={() => navigator.clipboard.writeText(address)}>Copiar dirección</button>
        </div>
      </section>

      <section className="op-section">
        <h3>Citas</h3>
        {(c.citas ?? []).length === 0 ? (
          <p className="op-muted">Sin citas</p>
        ) : (
          c.citas.map((ci) => (
            <div key={ci.id} className="op-cita-mini">
              <div>
                <strong>{ci.fecha}</strong> {ci.franja_inicio}–{ci.franja_fin}
                <span className={`op-badge op-badge-${ci.estado}`}>{ci.estado}</span>
              </div>
              {ci.notas && <p className="op-muted">{ci.notas}</p>}
              {!tieneParte(ci) && (ci.estado === 'programada' || ci.estado === 'confirmada') && (
                <Link to={`/claim/${id}/parte/${ci.id}`} className="op-btn-primary op-btn-sm">Crear parte</Link>
              )}
              {tieneParte(ci) && <span className="op-badge-done">Parte enviado</span>}
            </div>
          ))
        )}
      </section>

      {(c.partes ?? []).length > 0 && (
        <section className="op-section">
          <h3>Partes enviados</h3>
          {c.partes.map((p) => (
            <div key={p.id} className="op-parte-mini">
              <div><strong>Resultado:</strong> {p.resultado ?? 'Sin resultado'}</div>
              <div className="op-muted">{p.trabajos_realizados?.substring(0, 100)}</div>
              {p.firma_cliente_url && <div className="op-muted">Firma recogida</div>}
              <div className="op-muted">{new Date(p.created_at).toLocaleString('es-ES')}</div>
            </div>
          ))}
        </section>
      )}

      {citaActiva && !tieneParte(citaActiva) && (
        <div className="op-bottom-action">
          <Link to={`/claim/${id}/parte/${citaActiva.id}`} className="op-btn-primary op-btn-full">
            Crear parte de intervención
          </Link>
        </div>
      )}
    </div>
  );
}
