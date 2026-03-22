import { useNavigate } from 'react-router-dom';
import {
  X, ExternalLink, Calendar, MapPin, Building2, User,
  Zap, Clock, CheckCircle, AlertTriangle,
} from 'lucide-react';
import type { GeoExpediente, GeoOperario } from '@/hooks/usePlanningGeo';

interface GeoInfoPanelProps {
  selectedExpediente: GeoExpediente | null;
  selectedOperario: GeoOperario | null;
  onClose: () => void;
  onCreateCita: (expediente: GeoExpediente) => void;
}

export function GeoInfoPanel({
  selectedExpediente,
  selectedOperario,
  onClose,
  onCreateCita,
}: GeoInfoPanelProps) {
  const navigate = useNavigate();

  if (!selectedExpediente && !selectedOperario) {
    return (
      <aside className="geo-info-panel geo-info-panel--empty">
        <div className="geo-info-panel__empty-hint">
          <MapPin size={28} />
          <p>Haz clic en un expediente o en un operario en el mapa para ver los detalles.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="geo-info-panel">
      <div className="geo-info-panel__header">
        <span className="geo-info-panel__title">
          {selectedExpediente ? 'Expediente' : 'Operario'}
        </span>
        <button className="geo-info-panel__close" onClick={onClose} title="Cerrar">
          <X size={14} />
        </button>
      </div>

      {selectedExpediente && <ExpedienteCard exp={selectedExpediente} onNavigate={() => navigate(`/expedientes/${selectedExpediente.id}`)} onCreateCita={() => onCreateCita(selectedExpediente)} />}
      {selectedOperario && <OperarioCard op={selectedOperario} />}
    </aside>
  );
}

// ── ExpedienteCard ───────────────────────────────────────────────

function slaLabel(s: string) {
  if (s === 'vencido') return 'Vencido';
  if (s === 'urgente') return 'Urgente';
  if (s === 'ok')      return 'En plazo';
  return 'Sin SLA';
}

function prioLabel(p: string) {
  const map: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
  return map[p] ?? p;
}

interface ExpedienteCardProps {
  exp: GeoExpediente;
  onNavigate: () => void;
  onCreateCita: () => void;
}

function ExpedienteCard({ exp, onNavigate, onCreateCita }: ExpedienteCardProps) {
  return (
    <div className="geo-exp-card">
      <div className="geo-exp-card__num">{exp.numero_expediente}</div>
      <div className={`geo-exp-card__sla geo-exp-card__sla--${exp.sla_status}`}>
        <span className="geo-exp-card__sla-dot" />
        {slaLabel(exp.sla_status)}
      </div>

      <div className="geo-exp-card__rows">
        <Row icon={<Building2 size={12} />} label="Compañía" value={exp.compania_nombre ?? '—'} />
        <Row icon={<Zap size={12} />}       label="Tipo"     value={exp.tipo_siniestro} />
        <Row icon={<MapPin size={12} />}    label="Dirección" value={`${exp.direccion_siniestro}, ${exp.localidad}`} />
        <Row icon={<User size={12} />}      label="Operario" value={exp.operario_nombre ?? 'Sin asignar'} />
        <Row
          icon={<AlertTriangle size={12} />}
          label="Prioridad"
          value={prioLabel(exp.prioridad)}
        />
        {exp.citas_hoy > 0 && (
          <Row icon={<Clock size={12} />} label="Citas hoy" value={String(exp.citas_hoy)} />
        )}
        {exp.fecha_limite_sla && (
          <Row
            icon={<CheckCircle size={12} />}
            label="Límite SLA"
            value={new Date(exp.fecha_limite_sla).toLocaleDateString('es-ES')}
          />
        )}
      </div>

      <div className="geo-exp-card__actions">
        <button className="geo-btn geo-btn--primary" onClick={onCreateCita}>
          <Calendar size={13} /> Nueva cita
        </button>
        <button className="geo-btn geo-btn--ghost" onClick={onNavigate}>
          <ExternalLink size={13} /> Ver expediente
        </button>
      </div>
    </div>
  );
}

// ── OperarioCard ────────────────────────────────────────────────

function OperarioCard({ op }: { op: GeoOperario }) {
  const cargaPct = Math.min(100, op.carga_pct);
  const barColor = cargaPct >= 100 ? '#ef4444' : cargaPct >= 70 ? '#f59e0b' : '#22c55e';

  return (
    <div className="geo-op-card">
      <div className="geo-op-card__avatar">
        {op.nombre[0]}{op.apellidos[0]}
      </div>
      <div className="geo-op-card__name">{op.nombre} {op.apellidos}</div>
      {op.overloaded && (
        <div className="geo-op-card__badge geo-op-card__badge--overloaded">
          <AlertTriangle size={11} /> Sobrecarga
        </div>
      )}

      <div className="geo-op-card__carga-bar">
        <div className="geo-op-card__carga-fill" style={{ width: `${cargaPct}%`, background: barColor }} />
      </div>
      <div className="geo-op-card__carga-label">{op.citas_hoy} citas hoy · {op.citas_semana} esta semana</div>

      <div className="geo-op-card__rows">
        {op.gremios.length > 0 && (
          <Row icon={<Zap size={12} />} label="Especialidades" value={op.gremios.join(', ')} />
        )}
        {op.zonas_cp.length > 0 && (
          <Row icon={<MapPin size={12} />} label="Zonas CP" value={op.zonas_cp.slice(0, 5).join(', ') + (op.zonas_cp.length > 5 ? '…' : '')} />
        )}
      </div>
    </div>
  );
}

// ── Shared ──────────────────────────────────────────────────────

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="geo-info-row">
      <span className="geo-info-row__icon">{icon}</span>
      <span className="geo-info-row__label">{label}</span>
      <span className="geo-info-row__value">{value}</span>
    </div>
  );
}
