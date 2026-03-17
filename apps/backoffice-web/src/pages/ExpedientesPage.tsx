import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useExpedientes } from '@/hooks/useExpedientes';
import { useRealtimeExpedientes } from '@/hooks/useRealtime';
import { BandejaContadores } from '@/components/BandejaContadores';
import type { ExpedienteEstado } from '@erp/types';

const ESTADO_COLORS: Record<string, string> = {
  NUEVO: '#3b82f6', NO_ASIGNADO: '#f59e0b', EN_PLANIFICACION: '#8b5cf6',
  EN_CURSO: '#10b981', PENDIENTE: '#ef4444', PENDIENTE_MATERIAL: '#f97316',
  PENDIENTE_PERITO: '#f97316', PENDIENTE_CLIENTE: '#f97316', FINALIZADO: '#06b6d4',
  FACTURADO: '#6366f1', COBRADO: '#22c55e', CERRADO: '#6b7280', CANCELADO: '#9ca3af',
};

export function ExpedientesPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<ExpedienteEstado | ''>(
    (searchParams.get('estado') as ExpedienteEstado) || ''
  );

  useRealtimeExpedientes();

  useEffect(() => {
    const e = searchParams.get('estado') as ExpedienteEstado | null;
    if (e) { setEstadoFilter(e); setPage(1); }
  }, [searchParams]);

  const { data, isLoading } = useExpedientes({
    page, per_page: 20,
    search: search || undefined,
    estado: estadoFilter || undefined,
  });

  const result = data && 'data' in data && data.data ? data.data : null;

  return (
    <div className="page-expedientes">
      <div className="page-header">
        <h2>Expedientes</h2>
        <Link to="/expedientes/nuevo" className="btn-primary">Nuevo expediente</Link>
      </div>

      <BandejaContadores />

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Buscar por nº expediente, descripción..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="search-input"
        />
        <select
          value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value as ExpedienteEstado | ''); setPage(1); }}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="NUEVO">Nuevo</option>
          <option value="NO_ASIGNADO">No asignado</option>
          <option value="EN_PLANIFICACION">En planificación</option>
          <option value="EN_CURSO">En curso</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PENDIENTE_MATERIAL">Pdte. material</option>
          <option value="PENDIENTE_PERITO">Pdte. perito</option>
          <option value="PENDIENTE_CLIENTE">Pdte. cliente</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="FACTURADO">Facturado</option>
          <option value="COBRADO">Cobrado</option>
          <option value="CERRADO">Cerrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando expedientes...</div>
      ) : !result ? (
        <div className="error">Error al cargar expedientes</div>
      ) : result.items.length === 0 ? (
        <div className="empty-state">No se encontraron expedientes</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nº Expediente</th>
                <th>Estado</th>
                <th>Tipo</th>
                <th>Asegurado</th>
                <th>Compañía</th>
                <th>Prioridad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((exp: any) => (
                <tr key={exp.id}>
                  <td><Link to={`/expedientes/${exp.id}`} className="link">{exp.numero_expediente}</Link></td>
                  <td><span className="badge" style={{ backgroundColor: ESTADO_COLORS[exp.estado] ?? '#6b7280' }}>{exp.estado.replace(/_/g, ' ')}</span></td>
                  <td>{exp.tipo_siniestro}</td>
                  <td>{exp.asegurados?.nombre} {exp.asegurados?.apellidos}</td>
                  <td>{exp.companias?.nombre}</td>
                  <td className={`prioridad-${exp.prioridad}`}>{exp.prioridad}</td>
                  <td>{new Date(exp.created_at).toLocaleDateString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.total_pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {page} de {result.total_pages} ({result.total} registros)</span>
              <button disabled={page >= result.total_pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
