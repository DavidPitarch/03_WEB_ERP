import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInformesCaducados } from '@/hooks/useBandejas';

export function InformesCaducadosPage() {
  const { data: res, isLoading } = useInformesCaducados();
  const allItems = res && 'data' in res ? (res.data ?? []) as any[] : [];

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDiasMin, setFiltroDiasMin] = useState('');

  const tiposSiniestro = useMemo(
    () => [...new Set(allItems.map((i) => i.tipo_siniestro).filter(Boolean))],
    [allItems]
  );

  const items = useMemo(() => {
    let filtered = allItems;
    if (filtroTipo) filtered = filtered.filter((i) => i.tipo_siniestro === filtroTipo);
    if (filtroDiasMin) filtered = filtered.filter((i) => (i.dias_retraso ?? 0) >= Number(filtroDiasMin));
    return filtered;
  }, [allItems, filtroTipo, filtroDiasMin]);

  return (
    <div className="page-informes-caducados">
      <h2>Informes caducados ({items.length})</h2>
      <p className="text-muted">Citas pasadas sin parte de operario recibido.</p>

      <div className="filters-bar">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tiposSiniestro.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="number"
          placeholder="Dias retraso min."
          value={filtroDiasMin}
          onChange={(e) => setFiltroDiasMin(e.target.value)}
          min={0}
          style={{ width: 140 }}
        />
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay informes caducados</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Operario</th>
              <th>Fecha cita</th>
              <th>Franja</th>
              <th>Dias retraso</th>
              <th>Tipo siniestro</th>
              <th>Estado exp.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.cita_id ?? item.id} className={item.dias_retraso > 7 ? 'row-danger' : ''}>
                <td>
                  <Link to={`/expedientes/${item.expediente_id}`} className="link">
                    {item.numero_expediente ?? item.expedientes?.numero_expediente ?? item.expediente_id?.substring(0, 8)}
                  </Link>
                </td>
                <td>{item.operario_nombre ?? item.operarios?.nombre} {item.operario_apellidos ?? item.operarios?.apellidos}</td>
                <td>{item.fecha}</td>
                <td>{item.franja_inicio}–{item.franja_fin}</td>
                <td><strong>{item.dias_retraso ?? '—'}</strong></td>
                <td>{item.tipo_siniestro ?? '—'}</td>
                <td>{item.estado_expediente ?? item.expedientes?.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
