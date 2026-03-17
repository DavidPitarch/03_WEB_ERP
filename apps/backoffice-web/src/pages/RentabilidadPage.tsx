import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRentabilidad } from '@/hooks/useDashboard';

export function RentabilidadPage() {
  const [companiaFilter, setCompaniaFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [soloDeficitarios, setSoloDeficitarios] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, any> = {
    compania_id: companiaFilter || undefined,
    tipo_siniestro: tipoFilter || undefined,
    solo_deficitarios: soloDeficitarios || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    page,
  };

  const { data, isLoading } = useRentabilidad(filters);
  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];
  const meta: any = data && 'meta' in data ? data.meta : null;

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  return (
    <div className="page-rentabilidad">
      <div className="page-header">
        <h2>Análisis de rentabilidad</h2>
      </div>

      <div className="filters-bar">
        <input type="text" placeholder="Compañía ID" value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} />
        <input type="text" placeholder="Tipo siniestro" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} />
        <label className="filter-checkbox">
          <input type="checkbox" checked={soloDeficitarios} onChange={(e) => setSoloDeficitarios(e.target.checked)} />
          Solo deficitarios
        </label>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="loading">Cargando rentabilidad...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron expedientes</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Compañía</th>
                <th>Tipo</th>
                <th>Ingreso estimado</th>
                <th>Coste estimado</th>
                <th>Margen previsto</th>
                <th>Facturado</th>
                <th>Cobrado</th>
                <th>Margen real</th>
                <th>Desviación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r: any) => (
                <tr key={r.id} style={Number(r.margen_previsto) < 0 ? { backgroundColor: '#fef2f2' } : undefined}>
                  <td>
                    <Link to={`/expedientes/${r.expediente_id}`} className="link">
                      {r.numero_expediente}
                    </Link>
                  </td>
                  <td>{r.compania_nombre}</td>
                  <td>{r.tipo_siniestro}</td>
                  <td>{fmt(r.ingreso_estimado)}</td>
                  <td>{fmt(r.coste_estimado)}</td>
                  <td>{fmt(r.margen_previsto)}</td>
                  <td>{fmt(r.facturado)}</td>
                  <td>{fmt(r.cobrado)}</td>
                  <td>{fmt(r.margen_real)}</td>
                  <td style={Number(r.desviacion) < 0 ? { color: '#ef4444' } : undefined}>
                    {fmt(r.desviacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta && (
            <div className="pagination">
              <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {page}{meta.total_pages ? ` de ${meta.total_pages}` : ''}</span>
              <button className="btn" disabled={meta.total_pages && page >= meta.total_pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
