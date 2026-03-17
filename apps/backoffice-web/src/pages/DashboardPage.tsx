import { useState } from 'react';
import { useDashboardKpis, useRentabilidadPorCompania, useProductividad } from '@/hooks/useDashboard';

export function DashboardPage() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [companiaFilter, setCompaniaFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');

  const filters: Record<string, any> = {
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    compania_id: companiaFilter || undefined,
    empresa_id: empresaFilter || undefined,
  };

  const { data: kpiData, isLoading: kpiLoading } = useDashboardKpis(filters);
  const kpis: any = kpiData && 'data' in kpiData ? kpiData.data : null;

  const { data: rentData } = useRentabilidadPorCompania();
  const rentItems: any[] = rentData && 'data' in rentData ? (rentData.data as any[]) ?? [] : [];

  const { data: prodData } = useProductividad();
  const prodItems: any[] = prodData && 'data' in prodData ? (prodData.data as any[]) ?? [] : [];

  const fmt = (v: any) => Number(v ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const fmtNum = (v: any) => Number(v ?? 0).toLocaleString('es-ES');
  const fmtPct = (v: any) => `${Number(v ?? 0).toFixed(1)}%`;

  const kpiCards = kpis
    ? [
        { label: 'Total expedientes', value: fmtNum(kpis.total_expedientes) },
        { label: 'En curso', value: fmtNum(kpis.en_curso) },
        { label: 'Pendientes', value: fmtNum(kpis.pendientes) },
        { label: 'Finalizados sin factura', value: fmtNum(kpis.finalizados_sin_factura) },
        { label: 'Total facturado', value: fmt(kpis.total_facturado) },
        { label: 'Total cobrado', value: fmt(kpis.total_cobrado) },
        { label: 'Pendiente cobro', value: fmt(kpis.pendiente_cobro) },
        { label: 'Facturas vencidas', value: fmtNum(kpis.facturas_vencidas), warning: Number(kpis.facturas_vencidas) > 0 },
        { label: 'Pedidos caducados', value: fmtNum(kpis.pedidos_caducados), warning: Number(kpis.pedidos_caducados) > 0 },
        { label: 'Informes caducados', value: fmtNum(kpis.informes_caducados), warning: Number(kpis.informes_caducados) > 0 },
        { label: 'Sin presupuesto', value: fmtNum(kpis.sin_presupuesto), warning: Number(kpis.sin_presupuesto) > 0 },
        { label: '—', value: '—' },
      ]
    : [];

  return (
    <div className="page-dashboard">
      <div className="page-header">
        <h2>Cuadro de mando</h2>
      </div>

      <div className="filters-bar">
        <div className="form-group">
          <label>Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Compañía</label>
          <input type="text" placeholder="ID compañía" value={companiaFilter} onChange={(e) => setCompaniaFilter(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Empresa</label>
          <input type="text" placeholder="ID empresa" value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)} />
        </div>
      </div>

      {kpiLoading ? (
        <div className="loading">Cargando indicadores...</div>
      ) : (
        <div className="dashboard-grid">
          {kpiCards.map((card, i) => (
            <div key={i} className={`kpi-card${card.warning ? ' kpi-warning' : ''}`}>
              <div className="kpi-value">{card.value}</div>
              <div className="kpi-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-tables">
        <div>
          <h3>Rentabilidad por compañía</h3>
          {rentItems.length === 0 ? (
            <div className="empty-state">Sin datos</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Compañía</th>
                  <th>Nº Exp.</th>
                  <th>Margen total</th>
                  <th>Margen %</th>
                  <th>Deficitarios</th>
                </tr>
              </thead>
              <tbody>
                {rentItems.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.compania_nombre}</td>
                    <td>{fmtNum(r.num_expedientes)}</td>
                    <td>{fmt(r.margen_total)}</td>
                    <td>{fmtPct(r.margen_porcentaje)}</td>
                    <td>{fmtNum(r.deficitarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3>Productividad operarios</h3>
          {prodItems.length === 0 ? (
            <div className="empty-state">Sin datos</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th>Citas</th>
                  <th>Partes</th>
                  <th>Tasa validación</th>
                  <th>Caducados</th>
                </tr>
              </thead>
              <tbody>
                {prodItems.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.operario_nombre}</td>
                    <td>{fmtNum(r.citas)}</td>
                    <td>{fmtNum(r.partes)}</td>
                    <td>{fmtPct(r.tasa_validacion)}</td>
                    <td>{fmtNum(r.caducados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
