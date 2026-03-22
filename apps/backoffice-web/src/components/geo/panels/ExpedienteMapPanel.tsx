/**
 * Panel lateral — detalle de un expediente seleccionado en el mapa.
 * Muestra info del expediente y los operarios más cercanos para asignación.
 */

import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, UserPlus, AlertTriangle } from 'lucide-react';
import type { GeoExpediente, GeoOperario } from '@erp/types';
import { sortByDistance, estadoLabel, cargaClass } from '@/lib/geo-utils';

interface ExpedienteMapPanelProps {
  expediente: GeoExpediente;
  operarios: GeoOperario[];
  onClose: () => void;
  onCreateCita: (exp: GeoExpediente, operario: GeoOperario) => void;
}

export function ExpedienteMapPanel({
  expediente: exp,
  operarios,
  onClose,
  onCreateCita,
}: ExpedienteMapPanelProps) {
  const navigate = useNavigate();

  const candidates = sortByDistance(operarios, exp.lat, exp.lng).slice(0, 5);

  const slaColor =
    exp.sla_status === 'vencido' ? '#dc2626' :
    exp.sla_status === 'urgente' ? '#f59e0b' : '#22c55e';

  return (
    <aside className="geo-detail-panel">
      <div className="geo-detail-panel__header">
        <div>
          <div className="geo-detail-panel__num">{exp.numero_expediente}</div>
          <div className="geo-detail-panel__sub">{exp.localidad}, {exp.provincia}</div>
        </div>
        <button className="geo-detail-panel__close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>

      <div className="geo-detail-panel__body">
        {/* Estado + SLA */}
        <div className="geo-detail-row">
          <span className="geo-detail-label">Estado</span>
          <span className="geo-detail-value">{estadoLabel(exp.estado)}</span>
        </div>
        <div className="geo-detail-row">
          <span className="geo-detail-label">Prioridad</span>
          <span className="geo-detail-value" style={{ textTransform: 'capitalize' }}>{exp.prioridad}</span>
        </div>
        {exp.fecha_limite_sla && (
          <div className="geo-detail-row">
            <span className="geo-detail-label">SLA</span>
            <span className="geo-detail-value" style={{ color: slaColor, fontWeight: 600 }}>
              {exp.sla_status === 'vencido' && <AlertTriangle size={12} style={{ marginRight: 4 }} />}
              {new Date(exp.fecha_limite_sla).toLocaleDateString('es-ES')}
            </span>
          </div>
        )}
        <div className="geo-detail-row">
          <span className="geo-detail-label">Operario</span>
          <span className="geo-detail-value">
            {exp.operario_nombre ?? <em style={{ color: '#94a3b8' }}>Sin asignar</em>}
          </span>
        </div>
        <div className="geo-detail-row">
          <span className="geo-detail-label">Dirección</span>
          <span className="geo-detail-value geo-detail-value--wrap">{exp.direccion_siniestro}</span>
        </div>
        <div className="geo-detail-row">
          <span className="geo-detail-label">Tipo</span>
          <span className="geo-detail-value">{exp.tipo_siniestro}</span>
        </div>

        {/* Acción: abrir expediente */}
        <button
          className="btn btn--ghost btn--sm geo-detail-panel__open-btn"
          type="button"
          onClick={() => navigate(`/expedientes/${exp.id}`)}
        >
          <ExternalLink size={13} />
          Abrir expediente
        </button>

        {/* Operarios sugeridos */}
        <div className="geo-detail-panel__section-title">
          Operarios más cercanos
        </div>
        {candidates.length === 0 && (
          <p className="geo-detail-empty">No hay operarios con base geolocalizadas</p>
        )}
        {candidates.map((op) => (
          <div key={op.id} className="geo-operario-candidate">
            <div className="geo-operario-candidate__info">
              <span className="geo-operario-candidate__name">
                {op.nombre} {op.apellidos}
              </span>
              <span className="geo-operario-candidate__dist">
                {op.distance_km.toFixed(1)} km
              </span>
            </div>
            <div className="geo-operario-candidate__meta">
              <div className={`geo-carga-bar ${cargaClass(op.carga_pct)}`}>
                <div
                  className="geo-carga-bar__fill"
                  style={{ width: `${op.carga_pct}%` }}
                />
              </div>
              <span className="geo-operario-candidate__citas">
                {op.citas_hoy} citas hoy
                {op.overloaded && <span className="geo-overload-badge"> ⚠</span>}
              </span>
            </div>
            <button
              className="btn btn--primary btn--sm"
              type="button"
              onClick={() => onCreateCita(exp, op)}
              disabled={op.overloaded}
              title={op.overloaded ? 'Operario sobrecargado' : 'Asignar y crear cita'}
            >
              <UserPlus size={12} />
              Asignar
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
