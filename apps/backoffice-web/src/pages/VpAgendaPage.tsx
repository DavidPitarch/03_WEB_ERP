import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVpAgenda, useEnviarLinkVp, useReprogramarVp } from '@/hooks/useVideoperitaciones';

export function VpAgendaPage() {
  const navigate = useNavigate();
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const { data, isLoading } = useVpAgenda({
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  const enviarLinkMut = useEnviarLinkVp();
  const reprogramarMut = useReprogramarVp();

  const [showReprogramar, setShowReprogramar] = useState(false);
  const [reprogVpId, setReprogVpId] = useState('');
  const [reprogFecha, setReprogFecha] = useState('');
  const [reprogHoraInicio, setReprogHoraInicio] = useState('');
  const [reprogHoraFin, setReprogHoraFin] = useState('');
  const [reprogNotas, setReprogNotas] = useState('');

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  function openReprogramar(vpId: string) {
    setReprogVpId(vpId);
    setShowReprogramar(true);
  }

  return (
    <div className="page-vp-agenda">
      <div className="page-header">
        <h2>VP Agenda</h2>
      </div>

      <div className="filters-bar">
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="filter-date" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="filter-date" />
      </div>

      {isLoading ? (
        <div className="loading">Cargando agenda...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay citas de videoperitacion agendadas</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>N. Caso</th>
              <th>Perito</th>
              <th>Asegurado</th>
              <th>Estado agenda</th>
              <th>Link enviado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td>{new Date(item.fecha).toLocaleDateString('es-ES')}</td>
                <td>{item.hora_inicio} — {item.hora_fin}</td>
                <td className="clickable-row" onClick={() => navigate(`/videoperitaciones/${item.videoperitacion_id}`)}>{item.numero_caso}</td>
                <td>{item.perito_nombre ?? '-'}</td>
                <td>{item.asegurado_nombre ?? '-'}</td>
                <td><span className={`badge badge-vp-${item.estado_agenda === 'programada' ? 'sesion_programada' : item.estado_agenda === 'confirmada' ? 'contactado' : 'cancelado'}`}>{item.estado_agenda}</span></td>
                <td>{item.link_enviado_at ? new Date(item.link_enviado_at).toLocaleString('es-ES') : 'No'}</td>
                <td style={{ display: 'flex', gap: '0.25rem' }}>
                  {!item.link_enviado_at && (
                    <button className="btn btn-sm" onClick={() => enviarLinkMut.mutate({ id: item.videoperitacion_id })} disabled={enviarLinkMut.isPending}>
                      Enviar link
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => openReprogramar(item.videoperitacion_id)}>
                    Reprogramar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showReprogramar && (
        <div className="modal-overlay" onClick={() => setShowReprogramar(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reprogramar videoperitacion</h3>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={reprogFecha} onChange={(e) => setReprogFecha(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>Hora inicio</label>
              <input type="time" value={reprogHoraInicio} onChange={(e) => setReprogHoraInicio(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>Hora fin</label>
              <input type="time" value={reprogHoraFin} onChange={(e) => setReprogHoraFin(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea value={reprogNotas} onChange={(e) => setReprogNotas(e.target.value)} className="form-input" rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowReprogramar(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                reprogramarMut.mutate({ id: reprogVpId, fecha: reprogFecha, hora_inicio: reprogHoraInicio, hora_fin: reprogHoraFin, notas: reprogNotas || undefined }, {
                  onSuccess: () => { setShowReprogramar(false); setReprogFecha(''); setReprogHoraInicio(''); setReprogHoraFin(''); setReprogNotas(''); },
                });
              }} disabled={reprogramarMut.isPending || !reprogFecha || !reprogHoraInicio || !reprogHoraFin}>
                {reprogramarMut.isPending ? 'Guardando...' : 'Reprogramar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
