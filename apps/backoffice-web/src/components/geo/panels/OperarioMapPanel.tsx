/**
 * Panel lateral — detalle de un operario seleccionado en el mapa.
 */

import { X } from 'lucide-react';
import type { GeoOperario } from '@erp/types';
import { cargaClass } from '@/lib/geo-utils';

interface OperarioMapPanelProps {
  operario: GeoOperario;
  onClose: () => void;
}

export function OperarioMapPanel({ operario: op, onClose }: OperarioMapPanelProps) {
  return (
    <aside className="geo-detail-panel">
      <div className="geo-detail-panel__header">
        <div>
          <div className="geo-detail-panel__num">{op.nombre} {op.apellidos}</div>
          <div className="geo-detail-panel__sub">{op.email}</div>
        </div>
        <button className="geo-detail-panel__close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>

      <div className="geo-detail-panel__body">
        <div className="geo-detail-row">
          <span className="geo-detail-label">Teléfono</span>
          <span className="geo-detail-value">{op.telefono || '—'}</span>
        </div>

        <div className="geo-detail-row">
          <span className="geo-detail-label">Especialidades</span>
          <span className="geo-detail-value">
            {op.gremios?.length > 0 ? op.gremios.join(', ') : '—'}
          </span>
        </div>

        <div className="geo-detail-row">
          <span className="geo-detail-label">Zonas (CP)</span>
          <span className="geo-detail-value geo-detail-value--wrap">
            {op.zonas_cp?.length > 0 ? op.zonas_cp.join(', ') : 'Sin zonas definidas'}
          </span>
        </div>

        <div className="geo-detail-panel__section-title">Carga actual</div>

        <div className="geo-detail-row">
          <span className="geo-detail-label">Hoy</span>
          <span className="geo-detail-value">
            {op.citas_hoy} citas
            {op.overloaded && (
              <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>⚠ Sobrecargado</span>
            )}
          </span>
        </div>

        <div className="geo-detail-row">
          <span className="geo-detail-label">Esta semana</span>
          <span className="geo-detail-value">{op.citas_semana} citas</span>
        </div>

        <div style={{ margin: '8px 0' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--color-text-muted)',
              marginBottom: 4,
            }}
          >
            <span>Carga</span>
            <span>{op.carga_pct}%</span>
          </div>
          <div className={`geo-carga-bar ${cargaClass(op.carga_pct)}`} style={{ height: 10 }}>
            <div className="geo-carga-bar__fill" style={{ width: `${op.carga_pct}%` }} />
          </div>
        </div>

        {op.ultima_cita_fecha && (
          <div className="geo-detail-row">
            <span className="geo-detail-label">Última cita</span>
            <span className="geo-detail-value">
              {new Date(op.ultima_cita_fecha).toLocaleDateString('es-ES')}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
