import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePartesPendientes, useValidarParte, useRechazarParte } from '@/hooks/usePartes';

export function PartesValidacionPage() {
  const { data: res, isLoading, refetch } = usePartesPendientes();
  const validar = useValidarParte();
  const rechazar = useRechazarParte();
  const [motivoRechazo, setMotivoRechazo] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // IDs de partes recién validados — muestran el aviso de PDF pendiente
  const [pdfPendingIds, setPdfPendingIds] = useState<Set<string>>(new Set());

  const items = res && 'data' in res ? (res.data ?? []) as any[] : [];

  async function handleValidar(id: string) {
    await validar.mutateAsync(id);
    // El PDF se encola pero no se genera en este momento (stub activo).
    // Marcar este parte para mostrar el aviso informativo.
    setPdfPendingIds((prev) => new Set([...prev, id]));
    refetch();
  }

  async function handleRechazar(id: string) {
    const motivo = motivoRechazo[id]?.trim();
    if (!motivo) return;
    await rechazar.mutateAsync({ id, motivo });
    setMotivoRechazo((prev) => ({ ...prev, [id]: '' }));
    setExpandedId(null);
    refetch();
  }

  return (
    <div className="page-partes-validacion">
      <h2>Partes pendientes de validación</h2>
      <p className="text-muted">Partes enviados por operarios que requieren revisión técnica.</p>

      {/* ── Aviso de PDF pendiente — stub activo hasta P3.1 ────────────── */}
      <div style={{
        background: '#fff8e1',
        border: '1px solid #f59e0b',
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 16,
        fontSize: 13,
        color: '#92400e',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <span style={{ flexShrink: 0, fontWeight: 700 }}>⚠</span>
        <span>
          <strong>Generación de PDF pendiente de activación.</strong>{' '}
          Al validar un parte, el sistema registra el documento pero <strong>no genera el PDF todavía</strong>.
          Los partes validados quedan en estado <em>pendiente</em> hasta que el procesador de documentos esté activo.
          No hay enlace de descarga disponible en esta fase.
        </span>
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay partes pendientes de validación</div>
      ) : (
        <div className="partes-list">
          {items.map((parte) => (
            <div key={parte.id} className="parte-card">
              <div className="parte-card-header">
                <div>
                  <Link to={`/expedientes/${parte.expediente_id}`} className="link">
                    {parte.numero_expediente ?? parte.expedientes?.numero_expediente ?? '—'}
                  </Link>
                  <span className="parte-operario">
                    {parte.operario_nombre ?? parte.operarios?.nombre}{' '}
                    {parte.operario_apellidos ?? parte.operarios?.apellidos}
                  </span>
                </div>
                <div className="parte-meta">
                  <span className={`badge badge-${parte.resultado}`}>{parte.resultado}</span>
                  <span className="parte-date">{new Date(parte.created_at).toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              <div className="parte-card-body">
                <p><strong>Trabajos:</strong> {parte.trabajos_realizados}</p>
                {parte.trabajos_pendientes && <p><strong>Pendientes:</strong> {parte.trabajos_pendientes}</p>}
                {parte.materiales_utilizados && <p><strong>Materiales:</strong> {parte.materiales_utilizados}</p>}
                {parte.motivo_resultado && <p><strong>Motivo:</strong> {parte.motivo_resultado}</p>}
                {parte.observaciones && <p><strong>Obs:</strong> {parte.observaciones}</p>}
                <div className="parte-indicators">
                  {parte.tiene_firma && <span className="badge badge-firma">✓ Firma</span>}
                  {(parte.num_evidencias ?? 0) > 0 && (
                    <span className="badge badge-evidencias">{parte.num_evidencias} evidencias</span>
                  )}
                </div>
              </div>

              {/* Indicador por parte — visible tras validar en esta sesión */}
              {pdfPendingIds.has(parte.id) && (
                <div style={{ fontSize: 12, color: '#92400e', background: '#fff3cd', padding: '4px 8px', borderRadius: 4, marginBottom: 6 }}>
                  ⚠ PDF en cola — pendiente de procesador. Sin enlace de descarga disponible.
                </div>
              )}

              <div className="parte-card-actions">
                <button
                  className="btn btn-success"
                  onClick={() => handleValidar(parte.id)}
                  disabled={validar.isPending}
                >
                  Validar
                </button>
                {expandedId === parte.id ? (
                  <div className="rechazo-form">
                    <input
                      type="text"
                      placeholder="Motivo del rechazo..."
                      value={motivoRechazo[parte.id] ?? ''}
                      onChange={(e) => setMotivoRechazo((prev) => ({ ...prev, [parte.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRechazar(parte.id)}
                      disabled={rechazar.isPending || !motivoRechazo[parte.id]?.trim()}
                    >
                      Confirmar rechazo
                    </button>
                    <button className="btn btn-secondary" onClick={() => setExpandedId(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-outline-danger" onClick={() => setExpandedId(parte.id)}>
                    Rechazar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
