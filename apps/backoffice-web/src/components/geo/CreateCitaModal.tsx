/**
 * Modal de creación rápida de cita desde el mapa.
 * Prerrellena el expediente y el operario seleccionados.
 * Llama directamente al endpoint POST /citas existente.
 */

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GeoExpediente, GeoOperario } from '@erp/types';
import { supabase } from '@/lib/supabase';

interface CreateCitaModalProps {
  expediente: GeoExpediente;
  operario: GeoOperario;
  onClose: () => void;
  onSuccess: () => void;
}

interface CitaPayload {
  expediente_id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  notas: string | null;
}

function useCreateCita() {
  return useMutation<unknown, Error, CitaPayload>({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/citas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? 'Error al crear la cita');
      }
      return res.json();
    },
  });
}

export function CreateCitaModal({ expediente, operario, onClose, onSuccess }: CreateCitaModalProps) {
  const qc = useQueryClient();
  const createCita = useCreateCita();

  const today = new Date().toISOString().substring(0, 10);
  const [fecha,         setFecha]         = useState(today);
  const [franjaInicio,  setFranjaInicio]  = useState('09:00');
  const [franjaFin,     setFranjaFin]     = useState('14:00');
  const [notas,         setNotas]         = useState('');
  const [formError,     setFormError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!fecha || !franjaInicio || !franjaFin) {
      setFormError('Fecha y franja horaria son obligatorias.');
      return;
    }

    try {
      await createCita.mutateAsync({
        expediente_id: expediente.id,
        operario_id:   operario.id,
        fecha,
        franja_inicio: franjaInicio,
        franja_fin:    franjaFin,
        notas:         notas || null,
      });
      qc.invalidateQueries({ queryKey: ['geo-expedientes'] });
      qc.invalidateQueries({ queryKey: ['geo-operarios'] });
      onSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear la cita.');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 className="modal-title">Crear cita</h3>
          <button onClick={onClose} type="button" className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Resumen */}
          <div className="geo-citamodal-summary">
            <div className="geo-citamodal-row">
              <span className="geo-detail-label">Expediente</span>
              <span className="geo-detail-value">{expediente.numero_expediente}</span>
            </div>
            <div className="geo-citamodal-row">
              <span className="geo-detail-label">Dirección</span>
              <span className="geo-detail-value">{expediente.direccion_siniestro}, {expediente.localidad}</span>
            </div>
            <div className="geo-citamodal-row">
              <span className="geo-detail-label">Operario</span>
              <span className="geo-detail-value">{operario.nombre} {operario.apellidos}</span>
            </div>
          </div>

          {formError && (
            <div className="alert alert--error" style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={14} />
              {formError}
            </div>
          )}

          <form id="create-cita-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="cita-fecha">Fecha *</label>
              <input
                id="cita-fecha"
                type="date"
                className="form-input"
                value={fecha}
                min={today}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-field">
                <label className="form-label" htmlFor="cita-inicio">Hora inicio *</label>
                <input
                  id="cita-inicio"
                  type="time"
                  className="form-input"
                  value={franjaInicio}
                  onChange={(e) => setFranjaInicio(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="cita-fin">Hora fin *</label>
                <input
                  id="cita-fin"
                  type="time"
                  className="form-input"
                  value={franjaFin}
                  onChange={(e) => setFranjaFin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="cita-notas">Notas</label>
              <textarea
                id="cita-notas"
                className="form-input"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Instrucciones adicionales para el operario..."
              />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} type="button" className="btn btn--ghost btn--sm">
            Cancelar
          </button>
          <button
            form="create-cita-form"
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={createCita.isPending}
          >
            {createCita.isPending ? 'Creando...' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
