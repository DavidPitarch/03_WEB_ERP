import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeritosExpedientes } from '@/hooks/usePeritos';

export function PeritosExpedientesPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [companiaId, setCompaniaId] = useState('');
  const [tipoSiniestro, setTipoSiniestro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const { data, isLoading } = usePeritosExpedientes({
    estado: estado || undefined,
    compania_id: companiaId || undefined,
    tipo_siniestro: tipoSiniestro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  return (
    <div className="page-peritos-expedientes">
      <div className="page-header">
        <h2>Mis expedientes</h2>
      </div>

      <div className="filters-bar">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="filter-select">
          <option value="">Todos los estados</option>
          <option value="EN_CURSO">En curso</option>
          <option value="PENDIENTE_PERITO">Pendiente perito</option>
          <option value="FINALIZADO">Finalizado</option>
        </select>
        <input
          type="text"
          placeholder="Compania ID..."
          value={companiaId}
          onChange={(e) => setCompaniaId(e.target.value)}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Tipo siniestro..."
          value={tipoSiniestro}
          onChange={(e) => setTipoSiniestro(e.target.value)}
          className="search-input"
        />
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="filter-date" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="filter-date" />
      </div>

      {isLoading ? (
        <div className="loading">Cargando expedientes...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron expedientes asignados</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>N. Expediente</th>
              <th>Tipo siniestro</th>
              <th>Compania</th>
              <th>Asegurado</th>
              <th>Estado</th>
              <th>Fecha encargo</th>
              <th>Dictamen</th>
            </tr>
          </thead>
          <tbody>
            {items.map((exp: any) => (
              <tr key={exp.id} onClick={() => navigate(`/expedientes/${exp.id}`)} className="clickable-row">
                <td>{exp.numero_expediente}</td>
                <td>{exp.tipo_siniestro}</td>
                <td>{exp.compania_nombre}</td>
                <td>{exp.asegurado_nombre} {exp.asegurado_apellidos}</td>
                <td><span className={`badge badge-${exp.estado?.toLowerCase()}`}>{exp.estado}</span></td>
                <td>{exp.fecha_encargo ? new Date(exp.fecha_encargo).toLocaleDateString('es-ES') : '-'}</td>
                <td>{exp.has_dictamen ? <span className="badge badge-success">Si</span> : <span className="badge badge-muted">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result && result.total_pages > 1 && (
        <div className="pagination-info">
          Pagina {result.page} de {result.total_pages} ({result.total} resultados)
        </div>
      )}
    </div>
  );
}
