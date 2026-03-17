import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOperarios } from '@/hooks/useMasters';

interface Props {
  expedienteId: string;
  onClose: () => void;
}

export function NuevaCitaModal({ expedienteId, onClose }: Props) {
  const qc = useQueryClient();
  const { data: operariosRes } = useOperarios({ activo: true });
  const operarios = operariosRes && 'data' in operariosRes ? operariosRes.data ?? [] : [];
  const [operarioId, setOperarioId] = useState('');
  const [fecha, setFecha] = useState('');
  const [franjaInicio, setFranjaInicio] = useState('09:00');
  const [franjaFin, setFranjaFin] = useState('11:00');
  const [notas, setNotas] = useState('');

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.post('/citas', data),
    onSuccess: (result) => {
      if (result && 'data' in result && result.data) {
        qc.invalidateQueries({ queryKey: ['expediente-timeline', expedienteId] });
        onClose();
      }
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      expediente_id: expedienteId,
      operario_id: operarioId,
      fecha,
      franja_inicio: franjaInicio,
      franja_fin: franjaFin,
      notas: notas || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nueva cita</h3>
          <button onClick={onClose} className="btn-close">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="operario">Operario</label>
            <select id="operario" value={operarioId} onChange={(e) => setOperarioId(e.target.value)} required>
              <option value="">Seleccionar operario...</option>
              {(operarios as any[]).map((o) => (
                <option key={o.id} value={o.id}>{o.nombre} {o.apellidos} — {(o.gremios || []).join(', ')}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fecha">Fecha</label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="inicio">Desde</label>
              <input
                id="inicio"
                type="time"
                value={franjaInicio}
                onChange={(e) => setFranjaInicio(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="fin">Hasta</label>
              <input
                id="fin"
                type="time"
                value={franjaFin}
                onChange={(e) => setFranjaFin(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="notas">Notas</label>
            <textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>
          {mutation.isError && <div className="form-error">Error al crear la cita</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
