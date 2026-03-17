import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFacturacionReporting } from '@/hooks/useDashboard';

export function ReportingFacturasPage() {
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [companiaFilter, setCompaniaFilter] = useState('');
  const [serieFilter, setSerieFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [cobroFilter, setCobroFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const filters: Record<string, any> = {
    empresa_id: empresaFilter || undefined,
    compania_id: companiaFilter || undefined,
    serie: serieFilter || undefined,
    estado: estadoFilter || undefined,
    estado_cobro: cobroFilter || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  };

  const { data, isLoading } = useFacturacionReporting(filters);
  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const totals = useMemo(() => {
    let base = 0, total = 0, cobrado = 0, pendiente = 0;
    items.forEach((f: any) => {
      base += Number(f.base ?? 0);
      total += Number(f.total ?? 0);
      cobrado += Number(f.cobrado ?? 0);
      pendiente += Number(f.pendiente ?? 0);
    });
    return { base, total, cobrado, pendiente };
  }, [items]);

  const handleExport = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    window.open(`/api/v1/dashboard/facturacion/export${qs ? `?${qs}` : ''}`, '_blank');
  };

  return (
    <div className="page-reporting-facturas">
      <div className="page-header">
        <h2>Reporting de facturación</h2>
        <button className="btn btn-secondary" onClick={handleExport}>Exportar CSV</button>
      </div>

      <div className="filters-bar">
        <input type="text" placeholder="Empresa ID" value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)} />
        <input type="text" placeholder="Compañía ID" value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} />
        <input type="text" placeholder="Serie" value={serieFilter} onChange={(e) => setSerieFilter(e.target.value)} />
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="filter-select">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="emitida">Emitida</option>
          <option value="enviada">Enviada</option>
          <option value="cobrada">Cobrada</option>
          <option value="anulada">Anulada</option>
        </select>
        <select value={cobroFilter} onChange={(e) => setCobroFilter(e.target.value)} className="filter-select">
          <option value="">Todos los cobros</option>
          <option value="pendiente">Pendiente</option>
          <option value="reclamada">Reclamada</option>
          <option value="cobrada">Cobrada</option>
          <option value="vencida">Vencida</option>
          <option value="incobrable">Incobrable</option>
        </select>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="loading">Cargando reporting...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron facturas</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº Factura</th>
              <th>Expediente</th>
              <th>Compañía</th>
              <th>Empresa</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Base</th>
              <th>IVA</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Cobro</th>
              <th>Cobrado</th>
              <th>Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f: any) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/facturas/${f.id}`} className="link">
                    <strong>{f.numero_factura}</strong>
                  </Link>
                </td>
                <td>
                  <Link to={`/expedientes/${f.expediente_id}`} className="link">
                    {f.numero_expediente}
                  </Link>
                </td>
                <td>{f.compania_nombre}</td>
                <td>{f.empresa_nombre}</td>
                <td>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-ES') : '—'}</td>
                <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}</td>
                <td>{fmt(f.base)}</td>
                <td>{fmt(f.iva)}</td>
                <td>{fmt(f.total)}</td>
                <td><span className="badge">{f.estado?.replace(/_/g, ' ')}</span></td>
                <td><span className="badge">{f.estado_cobro?.replace(/_/g, ' ')}</span></td>
                <td>{fmt(f.cobrado)}</td>
                <td>{fmt(f.pendiente)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}><strong>Totales</strong></td>
              <td><strong>{fmt(totals.base)}</strong></td>
              <td></td>
              <td><strong>{fmt(totals.total)}</strong></td>
              <td></td>
              <td></td>
              <td><strong>{fmt(totals.cobrado)}</strong></td>
              <td><strong>{fmt(totals.pendiente)}</strong></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
