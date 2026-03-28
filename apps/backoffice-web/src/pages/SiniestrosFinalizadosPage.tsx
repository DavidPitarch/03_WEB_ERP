import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  SiniestrosFinalizadosFilters,
  SiniestroFinalizadoRow,
  SiniestroFacturaRow,
} from '@erp/types';
import { TIPOS_DANO, ESTADOS_FINALIZADOS } from '@erp/types';
import {
  useSiniestrosFinalizados,
  useSiniestrosTramitadoresList,
  useSiniestrosOperariosList,
  useUpdateFacturaSiniestro,
} from '@/hooks/useSiniestros';

const PER_PAGE = 50;

const TIPOS_FILTRO = [
  '--Seleccionar Tipo--', '+30 dias', '+60 dias', '+90 dias', '+de 6000',
  'Allianz', 'Calidad', 'Cliente conflictivo', 'COMERCIAL', 'DANA VALENCIA',
  'Datos incorrectos', 'Franquicia', 'FRAUDE', 'Ilocalizable', 'Indemnizado',
  'rev economica', 'Urgente', 'VIP',
];

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatEuro(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
}

function EstadoBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    FINALIZADO: 'badge-info',
    FACTURADO: 'badge-success',
    COBRADO: 'badge-success',
    CERRADO: 'badge-default',
  };
  return (
    <span className={`badge ${colores[estado] ?? 'badge-default'}`}>
      {estado.replace(/_/g, ' ')}
    </span>
  );
}

function SubTablaFacturas({
  facturas,
  expedienteId: _expedienteId,
  onUpdate,
}: {
  facturas: SiniestroFacturaRow[];
  expedienteId: string;
  onUpdate: (facturaId: string, data: { enviada?: boolean; cobrada?: boolean }) => void;
}) {
  if (facturas.length === 0) {
    return <span className="sin-facturas">Sin facturas</span>;
  }
  return (
    <table className="tabla-facturas-sub">
      <thead>
        <tr>
          <th>Nº Factura</th>
          <th>Base</th>
          <th>IVA</th>
          <th>Total</th>
          <th>Enviada</th>
          <th>F. Autorización</th>
          <th>Cobrada</th>
        </tr>
      </thead>
      <tbody>
        {facturas.map((f) => (
          <tr key={f.id}>
            <td className="td-numero-factura">{f.numero_factura || '—'}</td>
            <td className="td-importe">{formatEuro(f.base_imponible)}</td>
            <td className="td-importe">{formatEuro(f.iva)}</td>
            <td className="td-importe td-total">{formatEuro(f.total)}</td>
            <td className="td-centro">
              <input
                type="checkbox"
                checked={f.enviada ?? false}
                onChange={(e) => onUpdate(f.id, { enviada: e.target.checked })}
              />
            </td>
            <td className="td-fecha">{formatFecha(f.fecha_autorizacion)}</td>
            <td className="td-centro">
              <input
                type="checkbox"
                checked={f.cobrada ?? false}
                onChange={(e) => onUpdate(f.id, { cobrada: e.target.checked })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FilaFinalizado({
  row,
  onRecuperar,
  onUpdateFactura,
}: {
  row: SiniestroFinalizadoRow;
  onRecuperar: (id: string) => void;
  onUpdateFactura: (
    expedienteId: string,
    facturaId: string,
    data: { enviada?: boolean; cobrada?: boolean },
  ) => void;
}) {
  const navigate = useNavigate();

  const abrirSeguimiento = () => {
    window.open(`/servicios/${row.id}/seguimiento`, '_blank', 'noopener,noreferrer');
  };

  return (
    <tr className={row.urgente ? 'fila-urgente' : row.vip ? 'fila-vip' : ''}>
      {/* 1. Nº Expediente */}
      <td className="td-expediente">
        <button type="button" className="link-expediente" onClick={abrirSeguimiento}>
          {row.numero_expediente}
        </button>
        <div className="exp-compania">{row.compania.nombre}</div>
        <div className="exp-etiquetas">
          {row.urgente && <span className="tag tag-urgente">URG</span>}
          {row.vip && <span className="tag tag-vip">VIP</span>}
          {row.etiquetas.map((et) => (
            <span key={et} className="tag tag-tipo">{et}</span>
          ))}
        </div>
        <EstadoBadge estado={row.estado} />
      </td>

      {/* 2. Fecha alta asegurado */}
      <td className="td-fecha">{formatFecha(row.fecha_alta_asegurado)}</td>

      {/* 3. Trabajos realizados */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className="icono-accion"
          title="Trabajos realizados"
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          📁
        </button>
      </td>

      {/* 4. Trabajos reclamados */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className={`icono-accion ${row.tiene_trabajos_reclamados ? 'trab-reclamado' : ''}`}
          title="Trabajos reclamados"
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          📂
        </button>
      </td>

      {/* 5. Modificar */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className="icono-accion"
          title="Modificar expediente"
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          ✏️
        </button>
      </td>

      {/* 6. Presupuesto */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className={`icono-accion ${row.tiene_presupuesto ? 'presup-si' : ''}`}
          title="Presupuesto"
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          📋
        </button>
      </td>

      {/* 7. Fecha emisión factura */}
      <td className="td-fecha">{formatFecha(row.fecha_emision_factura)}</td>

      {/* 8. Fecha factura */}
      <td className="td-fecha">{formatFecha(row.fecha_factura)}</td>

      {/* 9. Facturación — sub-tabla inline */}
      <td className="td-facturas">
        <SubTablaFacturas
          facturas={row.facturas ?? []}
          expedienteId={row.id}
          onUpdate={(facturaId, data) => onUpdateFactura(row.id, facturaId, data)}
        />
      </td>

      {/* 10. Recuperar */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className="btn btn-sm btn-recuperar"
          title="Recuperar expediente (reactivar)"
          onClick={() => onRecuperar(row.id)}
        >
          ↩
        </button>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function SiniestrosFinalizadosPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<SiniestrosFinalizadosFilters>({
    page: 1,
    per_page: PER_PAGE,
  });

  // Filtros principales
  const [searchInput, setSearchInput]         = useState('');
  const [tipoInput, setTipoInput]             = useState('');
  const [pendientesCobrar, setPendientesCobrar] = useState(false);
  const [tipoDanoInput, setTipoDanoInput]     = useState('');
  const [estadoInput, setEstadoInput]         = useState('');
  const [tramitadorInput, setTramitadorInput] = useState('');
  const [operarioInput, setOperarioInput]     = useState('');

  // Filtros de factura
  const [tipoFactura, setTipoFactura]   = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [anyoFactura, setAnyoFactura]   = useState('');
  const [importeDesde, setImporteDesde] = useState('');
  const [importeHasta, setImporteHasta] = useState('');

  const { data: finRes, isLoading, isError } = useSiniestrosFinalizados(filters);
  const { data: tramitadoresRes }            = useSiniestrosTramitadoresList();
  const { data: operariosRes }               = useSiniestrosOperariosList();
  const updateFactura                        = useUpdateFacturaSiniestro();

  const items      = finRes?.data?.items ?? [];
  const total      = finRes?.data?.total ?? 0;
  const totalPages = finRes?.data?.total_pages ?? 1;
  const tramitadores = tramitadoresRes?.data ?? [];
  const operarios    = operariosRes?.data ?? [];

  const handleBuscar = useCallback(() => {
    setFilters({
      search:           searchInput || undefined,
      tipo:             tipoInput || undefined,
      pendientes_cobrar: pendientesCobrar || undefined,
      tipo_dano:        tipoDanoInput || undefined,
      estado:           estadoInput || undefined,
      tramitador_id:    tramitadorInput || undefined,
      operario_id:      operarioInput || undefined,
      tipo_factura:     tipoFactura ? (tipoFactura as 'Factura' | 'Abono' | 'Albarán' | 'Presupuesto') : undefined,
      numero_factura:   numeroFactura || undefined,
      anyo_factura:     anyoFactura || undefined,
      importe_desde:    importeDesde ? Number(importeDesde) : undefined,
      importe_hasta:    importeHasta ? Number(importeHasta) : undefined,
      page:             1,
      per_page:         PER_PAGE,
    });
  }, [
    searchInput, tipoInput, pendientesCobrar, tipoDanoInput,
    estadoInput, tramitadorInput, operarioInput,
    tipoFactura, numeroFactura, anyoFactura, importeDesde, importeHasta,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBuscar();
  };

  const handleRecuperar = (_id: string) => {
    alert('Recuperar expediente: requiere confirmación de supervisor.');
  };

  const handleUpdateFactura = (
    expedienteId: string,
    facturaId: string,
    data: { enviada?: boolean; cobrada?: boolean },
  ) => {
    updateFactura.mutate({ expedienteId, factura_id: facturaId, ...data });
  };

  const goPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="page-siniestros-finalizados">
      {/* ── Cabecera ── */}
      <div className="page-header">
        <h1 className="page-title">Expedientes finalizados</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/expedientes/nuevo')}
        >
          + Nuevo expediente
        </button>
      </div>

      {/* ── Barra de filtros principal ── */}
      <div className="filtros-bar">
        <input
          type="text"
          className="filtro-input"
          placeholder="Buscar expediente…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <select
          className="filtro-select"
          value={tipoInput}
          onChange={(e) => setTipoInput(e.target.value)}
        >
          {TIPOS_FILTRO.map((t) => (
            <option key={t} value={t === '--Seleccionar Tipo--' ? '' : t}>{t}</option>
          ))}
        </select>

        <label className="filtro-check">
          <input
            type="checkbox"
            checked={pendientesCobrar}
            onChange={(e) => setPendientesCobrar(e.target.checked)}
          />
          Pendientes cobrar
        </label>

        <select
          className="filtro-select"
          value={tipoDanoInput}
          onChange={(e) => setTipoDanoInput(e.target.value)}
        >
          <option value="">Todos los daños</option>
          {TIPOS_DANO.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="filtro-select"
          value={estadoInput}
          onChange={(e) => setEstadoInput(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_FINALIZADOS.map((e) => (
            <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <select
          className="filtro-select"
          value={tramitadorInput}
          onChange={(e) => setTramitadorInput(e.target.value)}
        >
          <option value="">Todos los tramitadores</option>
          <option value="sin_tramitador">Sin tramitador</option>
          {tramitadores.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.nombre} {t.apellidos ?? ''}
            </option>
          ))}
        </select>

        <select
          className="filtro-select"
          value={operarioInput}
          onChange={(e) => setOperarioInput(e.target.value)}
        >
          <option value="">Todos los operarios</option>
          <option value="sin_operario">Sin operario</option>
          {operarios.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre} {o.apellidos ?? ''}{o.activo ? '' : ' (N)'}
            </option>
          ))}
        </select>

        <button type="button" className="btn btn-primary" onClick={handleBuscar}>
          Buscar
        </button>
      </div>

      {/* ── Barra de búsqueda de facturas ── */}
      <div className="filtros-bar filtros-facturas">
        <span className="filtros-label">Facturas:</span>

        <select
          className="filtro-select filtro-sm"
          value={tipoFactura}
          onChange={(e) => setTipoFactura(e.target.value)}
        >
          <option value="">--Tipo--</option>
          <option value="Factura">Factura</option>
          <option value="Abono">Abono</option>
          <option value="Albarán">Albarán</option>
          <option value="Presupuesto">Presupuesto</option>
        </select>

        <input
          type="text"
          className="filtro-input filtro-sm"
          placeholder="Nº factura"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <input
          type="text"
          className="filtro-input filtro-sm"
          placeholder="Año"
          value={anyoFactura}
          onChange={(e) => setAnyoFactura(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <input
          type="number"
          className="filtro-input filtro-sm"
          placeholder="Desde €"
          value={importeDesde}
          onChange={(e) => setImporteDesde(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <input
          type="number"
          className="filtro-input filtro-sm"
          placeholder="Hasta €"
          value={importeHasta}
          onChange={(e) => setImporteHasta(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button type="button" className="btn btn-sm btn-secondary" onClick={handleBuscar}>
          Filtrar facturas
        </button>
      </div>

      {/* ── Resumen ── */}
      <div className="tabla-resumen">
        Nº de siniestros: <strong>{total}</strong>
        {isLoading && <span className="cargando">  Cargando…</span>}
      </div>

      {/* ── Tabla ── */}
      {isError ? (
        <div className="error-msg">Error al cargar los expedientes. Inténtalo de nuevo.</div>
      ) : (
        <div className="tabla-wrapper">
          <table className="tabla-siniestros tabla-finalizados">
            <thead>
              <tr>
                <th>Nº Expediente</th>
                <th>Fecha alta aseg.</th>
                <th title="Trabajos realizados">Trab.</th>
                <th title="Trabajos reclamados">Recl.</th>
                <th title="Modificar">Mod.</th>
                <th title="Presupuesto">Pres.</th>
                <th>F. Emisión Fact.</th>
                <th>Fecha Factura</th>
                <th>Facturación</th>
                <th>Recuperar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j}><div className="skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="sin-resultados">
                    No hay expedientes finalizados con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <FilaFinalizado
                    key={row.id}
                    row={row}
                    onRecuperar={handleRecuperar}
                    onUpdateFactura={handleUpdateFactura}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="paginacion">
          <button
            type="button"
            className="btn btn-sm"
            disabled={filters.page === 1}
            onClick={() => goPage((filters.page ?? 1) - 1)}
          >
            ← Anterior
          </button>
          <span className="pag-info">
            Página {filters.page ?? 1} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={(filters.page ?? 1) >= totalPages}
            onClick={() => goPage((filters.page ?? 1) + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
