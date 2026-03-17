import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVpPendientesContacto, useRegistrarIntentoContacto } from '@/hooks/useVideoperitaciones';

export function VpPendientesContactoPage() {
  const navigate = useNavigate();
  const [prioridad, setPrioridad] = useState('');
  const { data, isLoading } = useVpPendientesContacto({ prioridad: prioridad || undefined });

  const registrarIntento = useRegistrarIntentoContacto();

  const [showIntento, setShowIntento] = useState(false);
  const [intentoVpId, setIntentoVpId] = useState('');
  const [intentoCanal, setIntentoCanal] = useState<'telefono' | 'email' | 'sms'>('telefono');
  const [intentoResultado, setIntentoResultado] = useState('');
  const [intentoNotas, setIntentoNotas] = useState('');

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  function openIntento(vpId: string) {
    setIntentoVpId(vpId);
    setShowIntento(true);
  }

  return (
    <div className="page-vp-pendientes">
      <div className="page-header">
        <h2>VP Pendientes de contacto</h2>
      </div>

      <div className="filters-bar">
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="filter-select">
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando pendientes...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay videoperitaciones pendientes de contacto</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>N. Caso</th>
              <th>Expediente</th>
              <th>Asegurado</th>
              <th>Prioridad</th>
              <th>Deadline</th>
              <th>Dias sin contacto</th>
              <th>Ultimo intento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((vp: any) => (
              <tr key={vp.id}>
                <td className="clickable-row" onClick={() => navigate(`/videoperitaciones/${vp.id}`)}>{vp.numero_caso}</td>
                <td>{vp.expedientes?.numero_expediente ?? '-'}</td>
                <td>{vp.asegurado_nombre ?? '-'}</td>
                <td><span className={`badge badge-prioridad-${vp.prioridad}`}>{vp.prioridad}</span></td>
                <td>{vp.deadline ? new Date(vp.deadline).toLocaleDateString('es-ES') : '-'}</td>
                <td>{vp.dias_sin_contacto ?? '-'}</td>
                <td>{vp.ultimo_intento ? new Date(vp.ultimo_intento).toLocaleDateString('es-ES') : 'Nunca'}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => openIntento(vp.id)}>Registrar intento</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showIntento && (
        <div className="modal-overlay" onClick={() => setShowIntento(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Registrar intento de contacto</h3>
            <div className="form-group">
              <label>Canal</label>
              <select value={intentoCanal} onChange={(e) => setIntentoCanal(e.target.value as any)} className="form-input">
                <option value="telefono">Telefono</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className="form-group">
              <label>Resultado</label>
              <input type="text" value={intentoResultado} onChange={(e) => setIntentoResultado(e.target.value)} className="form-input" placeholder="ej: contactado, no_contesta, buzon_voz" />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea value={intentoNotas} onChange={(e) => setIntentoNotas(e.target.value)} className="form-input" rows={2} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowIntento(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                registrarIntento.mutate({ id: intentoVpId, canal: intentoCanal, resultado: intentoResultado, notas: intentoNotas || null }, {
                  onSuccess: () => { setShowIntento(false); setIntentoResultado(''); setIntentoNotas(''); },
                });
              }} disabled={registrarIntento.isPending || !intentoResultado}>
                {registrarIntento.isPending ? 'Registrando...' : 'Registrar intento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
