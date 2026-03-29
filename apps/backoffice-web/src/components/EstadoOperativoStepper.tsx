import { useState } from 'react';
import {
  ESTADO_OPERATIVO_ORDER,
  ESTADO_OPERATIVO_LABELS,
  ESTADO_OPERATIVO_COLORS,
} from '@erp/types';
import type { EstadoOperativo } from '@erp/types';

interface EstadoOperativoStepperProps {
  currentEstado: EstadoOperativo;
  onChangeEstado: (estado: EstadoOperativo, mensaje: string) => void;
  isPending?: boolean;
  disabled?: boolean;
}

/**
 * Stepper visual de fases operativas del expediente.
 * Muestra todas las fases en línea con colores.
 * Click en una fase abre un mini-formulario para cambiar estado con mensaje obligatorio.
 */
export function EstadoOperativoStepper({
  currentEstado,
  onChangeEstado,
  isPending,
  disabled,
}: EstadoOperativoStepperProps) {
  const [selectedEstado, setSelectedEstado] = useState<EstadoOperativo | null>(null);
  const [mensaje, setMensaje] = useState('');

  const currentIndex = ESTADO_OPERATIVO_ORDER.indexOf(currentEstado);
  const isReapertura = currentEstado === 'REAPERTURA';

  const handleStepClick = (estado: EstadoOperativo) => {
    if (disabled || isPending) return;
    if (estado === currentEstado) return;
    setSelectedEstado(estado);
    setMensaje('');
  };

  const handleConfirm = () => {
    if (!selectedEstado || !mensaje.trim()) return;
    onChangeEstado(selectedEstado, mensaje.trim());
    setSelectedEstado(null);
    setMensaje('');
  };

  const handleCancel = () => {
    setSelectedEstado(null);
    setMensaje('');
  };

  return (
    <div className="eo-stepper">
      <div className="eo-stepper__label">Estado operativo</div>

      <div className="eo-stepper__track">
        {ESTADO_OPERATIVO_ORDER.map((estado, idx) => {
          const isCurrent = estado === currentEstado;
          const isCompleted = !isReapertura && idx < currentIndex;
          const isFuture = !isReapertura && idx > currentIndex;
          const color = ESTADO_OPERATIVO_COLORS[estado];

          return (
            <button
              key={estado}
              type="button"
              className={[
                'eo-step',
                isCurrent && 'eo-step--current',
                isCompleted && 'eo-step--completed',
                isFuture && 'eo-step--future',
                selectedEstado === estado && 'eo-step--selected',
              ].filter(Boolean).join(' ')}
              style={{
                '--step-color': color,
                '--step-bg': isCompleted || isCurrent ? color : undefined,
              } as React.CSSProperties}
              onClick={() => handleStepClick(estado)}
              disabled={disabled || isPending}
              title={ESTADO_OPERATIVO_LABELS[estado]}
            >
              <span className="eo-step__dot" />
              <span className="eo-step__label">{ESTADO_OPERATIVO_LABELS[estado]}</span>
            </button>
          );
        })}

        {/* Reapertura como estado especial al final */}
        <button
          type="button"
          className={[
            'eo-step eo-step--reapertura',
            isReapertura && 'eo-step--current',
            selectedEstado === 'REAPERTURA' && 'eo-step--selected',
          ].filter(Boolean).join(' ')}
          style={{ '--step-color': ESTADO_OPERATIVO_COLORS.REAPERTURA } as React.CSSProperties}
          onClick={() => handleStepClick('REAPERTURA')}
          disabled={disabled || isPending}
          title="Reapertura"
        >
          <span className="eo-step__dot" />
          <span className="eo-step__label">Reapertura</span>
        </button>
      </div>

      {/* Mini-formulario de cambio de estado */}
      {selectedEstado && (
        <div className="eo-change-form">
          <div className="eo-change-form__header">
            <span>Cambiar a: <strong>{ESTADO_OPERATIVO_LABELS[selectedEstado]}</strong></span>
          </div>
          <textarea
            className="eo-change-form__textarea"
            placeholder="Mensaje obligatorio (describe el motivo del cambio)..."
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={2}
            maxLength={500}
            autoFocus
          />
          <div className="eo-change-form__actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleConfirm}
              disabled={!mensaje.trim() || isPending}
            >
              {isPending ? 'Guardando...' : 'Confirmar cambio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
