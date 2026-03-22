/**
 * SmartDispatchDrawer — panel deslizante que muestra las sugerencias
 * del algoritmo de Smart Dispatch y permite aceptarlas
 * individualmente o en bloque.
 */

import { useState } from 'react';
import { X, Zap, CheckCheck, AlertTriangle } from 'lucide-react';
import type { DispatchSuggestion } from '@erp/types';
import { useSmartDispatchSuggest, useSmartDispatchAccept } from '@/hooks/geo/useSmartDispatch';

interface SmartDispatchDrawerProps {
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_FRANJA = { franja_inicio: '09:00', franja_fin: '14:00' };
const TODAY = new Date().toISOString().substring(0, 10);

export function SmartDispatchDrawer({ onClose, onSuccess }: SmartDispatchDrawerProps) {
  const suggest = useSmartDispatchSuggest();
  const accept  = useSmartDispatchAccept();
  const [suggestions, setSuggestions] = useState<DispatchSuggestion[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [fecha, setFecha]             = useState(TODAY);
  const [error, setError]             = useState<string | null>(null);

  async function handleSuggest() {
    setError(null);
    try {
      const res = await suggest.mutateAsync({ fecha });
      setSuggestions(res.data.suggestions);
      setSelected(new Set(res.data.suggestions.map((s) => s.expediente_id)));
    } catch {
      setError('Error al generar sugerencias. Inténtalo de nuevo.');
    }
  }

  async function handleAccept() {
    const toAccept = suggestions.filter((s) => selected.has(s.expediente_id));
    if (!toAccept.length) return;

    try {
      await accept.mutateAsync({
        assignments: toAccept.map((s) => ({
          expediente_id: s.expediente_id,
          operario_id:   s.operario_id,
          fecha,
          ...DEFAULT_FRANJA,
        })),
      });
      onSuccess();
      onClose();
    } catch {
      setError('Error al crear las citas. Verifica los datos e inténtalo de nuevo.');
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasConflicts = (s: DispatchSuggestion) => s.conflicts.length > 0;

  return (
    <div className="geo-dispatch-drawer">
      <div className="geo-dispatch-drawer__overlay" onClick={onClose} />

      <aside className="geo-dispatch-drawer__panel">
        {/* Header */}
        <div className="geo-dispatch-drawer__header">
          <div className="geo-dispatch-drawer__title">
            <Zap size={16} />
            Smart Dispatch
          </div>
          <button onClick={onClose} type="button" className="geo-detail-panel__close">
            <X size={14} />
          </button>
        </div>

        {/* Controles */}
        <div className="geo-dispatch-drawer__controls">
          <div className="geo-filter-panel__section-label">Fecha de cita</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              className="geo-filter-date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              min={TODAY}
            />
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSuggest}
              disabled={suggest.isPending}
              type="button"
            >
              {suggest.isPending ? 'Calculando...' : 'Generar sugerencias'}
            </button>
          </div>
          <p className="geo-dispatch-drawer__hint">
            El algoritmo asigna cada expediente sin operario al técnico más cercano
            con disponibilidad y especialidad compatible.
          </p>
        </div>

        {error && (
          <div className="geo-dispatch-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Lista de sugerencias */}
        {suggestions.length > 0 && (
          <>
            <div className="geo-dispatch-drawer__list-header">
              <span>{suggestions.length} sugerencias · {selected.size} seleccionadas</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() =>
                  setSelected(
                    selected.size === suggestions.length
                      ? new Set()
                      : new Set(suggestions.map((s) => s.expediente_id))
                  )
                }
              >
                {selected.size === suggestions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            </div>

            <div className="geo-dispatch-drawer__list">
              {suggestions.map((s) => (
                <label key={s.expediente_id} className={`geo-dispatch-item ${hasConflicts(s) ? 'geo-dispatch-item--warning' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(s.expediente_id)}
                    onChange={() => toggleSelected(s.expediente_id)}
                  />
                  <div className="geo-dispatch-item__body">
                    <div className="geo-dispatch-item__title">
                      {s.expediente_num}
                      <span className="geo-dispatch-item__dist">{s.distance_km} km</span>
                    </div>
                    <div className="geo-dispatch-item__dir">{s.expediente_dir}</div>
                    <div className="geo-dispatch-item__op">
                      → {s.operario_nombre} ({s.citas_hoy} citas hoy)
                    </div>
                    {hasConflicts(s) && (
                      <div className="geo-dispatch-item__conflicts">
                        <AlertTriangle size={11} />
                        {s.conflicts.join(' · ')}
                      </div>
                    )}
                    <div className="geo-dispatch-item__reason">{s.reason}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="geo-dispatch-drawer__footer">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={handleAccept}
                disabled={selected.size === 0 || accept.isPending}
              >
                <CheckCheck size={14} />
                {accept.isPending
                  ? 'Creando citas...'
                  : `Confirmar ${selected.size} asignación${selected.size !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </>
        )}

        {suggestions.length === 0 && !suggest.isPending && suggest.isSuccess && (
          <div className="geo-dispatch-empty">
            No hay expedientes sin asignar con geolocalización disponible.
          </div>
        )}
      </aside>
    </div>
  );
}
