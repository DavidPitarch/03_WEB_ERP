import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SiniestrosActivosFilters, SiniestroActivoRow } from '@erp/types';
import {
  useSiniestrosActivos,
  useSiniestrosActivosStats,
  useSiniestrosTramitadoresList,
  useSiniestrosOperariosList,
} from '@/hooks/useSiniestros';
import { TIPOS_DANO } from '@erp/types';

const PER_PAGE = 50;

// ─── Constantes de filtro ─────────────────────────────────────────────────────

const TIPOS_FILTRO = [
  '--Seleccionar Tipo--', '+30 dias', '+60 dias', '+90 dias', '+de 6000',
  'Allianz', 'Calidad', 'Cliente conflictivo', 'COMERCIAL', 'DANA VALENCIA',
  'Datos incorrectos', 'Franquicia', 'FRAUDE', 'Ilocalizable', 'Indemnizado',
  'rev economica', 'Urgente', 'VIP',
];

const ESTADOS_ACTIVOS = [
  'Todos', 'NUEVO', 'NO_ASIGNADO', 'EN_PLANIFICACION', 'EN_CURSO',
  'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE',
];

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EstadoBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    NUEVO: 'badge-info',
    NO_ASIGNADO: 'badge-warning',
    EN_PLANIFICACION: 'badge-info',
    EN_CURSO: 'badge-success',
    PENDIENTE: 'badge-warning',
    PENDIENTE_MATERIAL: 'badge-warning',
    PENDIENTE_PERITO: 'badge-warning',
    PENDIENTE_CLIENTE: 'badge-warning',
  };
  return (
    <span className={`badge ${colores[estado] ?? 'badge-default'}`}>
      {estado.replace('_', ' ')}
    </span>
  );
}

// ─── Leyenda de indicadores de color ─────────────────────────────────────────

function LeyendaIndicadores() {
  return (
    <div className="siniestros-leyenda">
      <div className="leyenda-grupo">
        <span className="leyenda-titulo">Facturas:</span>
        <span className="ind-bloque" style={{ background: '#999' }} title="Sin factura" />
        <span className="ind-bloque" style={{ background: '#F00' }} title="Factura vencida" />
        <span className="ind-bloque" style={{ background: '#0C0' }} title="Factura cobrada" />
      </div>
      <div className="leyenda-grupo">
        <span className="leyenda-titulo">Presupuestos:</span>
        <span className="ind-bloque" style={{ background: '#999' }} title="Sin presupuesto" />
        <span className="ind-bloque" style={{ background: '#F00' }} title="Rechazado" />
        <span className="ind-bloque" style={{ background: '#FDA24F' }} title="Pendiente" />
        <span className="ind-bloque" style={{ background: '#0C0' }} title="Aprobado" />
      </div>
    </div>
  );
}

// ─── Fila de la tabla ─────────────────────────────────────────────────────────

function FilaActivo({ row, onEliminar }: { row: SiniestroActivoRow; onEliminar: (id: string) => void }) {
  const navigate = useNavigate();

  const abrirSeguimiento = () => {
    window.open(`/servicios/${row.id}/seguimiento`, '_blank', 'noopener,noreferrer');
  };

  const fechaEsperaStyle: React.CSSProperties = row.fecha_espera
    ? { background: row.fecha_espera_vencida ? '#ffd7d7' : '#d7ffd7', padding: '2px 6px', borderRadius: 3 }
    : {};

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
          {row.pausado && <span className="tag tag-pausado">PAUSADO</span>}
          {row.etiquetas.map((et) => (
            <span key={et} className="tag tag-tipo">{et}</span>
          ))}
        </div>
      </td>

      {/* 2. Estado */}
      <td><EstadoBadge estado={row.estado} /></td>

      {/* 3. Tramitador */}
      <td className="td-tramitador">
        {row.tramitador
          ? `${row.tramitador.nombre} ${row.tramitador.apellidos ?? ''}`.trim()
          : <span className="sin-asignar">Sin tramitador</span>}
      </td>

      {/* 4. Tipo de servicio / daño */}
      <td>{row.tipo_dano || '—'}</td>

      {/* 5. Fecha alta asegurado */}
      <td className="td-fecha">{formatFecha(row.fecha_alta_asegurado)}</td>

      {/* 6. Nº días apertura */}
      <td className="td-numero td-centro">
        <strong>{row.dias_apertura}</strong>
        <span className="dias-label"> d</span>
      </td>

      {/* 7. Fecha espera */}
      <td className="td-fecha">
        <span style={fechaEsperaStyle}>
          {formatFecha(row.fecha_espera)}
        </span>
      </td>

      {/* 8. Días sin actualizar */}
      <td className="td-numero td-centro">
        <span className={row.dias_sin_actualizar > 30 ? 'dias-alerta' : ''}>
          {row.dias_sin_actualizar}
        </span>
      </td>

      {/* 9. Perito */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className={`icono-accion ${row.perito_asignado ? 'perito-activo' : 'perito-sin'}`}
          title={row.perito_asignado ? 'Perito asignado' : 'Sin perito'}
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          {row.perito_asignado ? '🔵' : '⚪'}
        </button>
      </td>

      {/* 10. Trabajos realizados */}
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

      {/* 11. Trabajos reclamados */}
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

      {/* 12. Modificar servicio */}
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

      {/* 13. Presupuesto */}
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

      {/* 14. Factura */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className={`icono-accion ${row.tiene_factura ? 'factura-si' : ''}`}
          title="Factura"
          onClick={() => navigate(`/expedientes/${row.id}`)}
        >
          🧾
        </button>
      </td>

      {/* 15. Eliminar */}
      <td className="td-accion td-centro">
        <button
          type="button"
          className="btn-eliminar"
          title="Eliminar expediente"
          onClick={() => {
            if (window.confirm(`¿Eliminar el expediente ${row.numero_expediente}?`)) {
              onEliminar(row.id);
            }
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function SiniestrosActivosPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<SiniestrosActivosFilters>({
    page: 1,
    per_page: PER_PAGE,
  });

  // Valores de los inputs de filtro (controlados separadamente para evitar
  // disparar la query en cada keystroke)
  const [searchInput, setSearchInput]     = useState('');
  const [tipoInput, setTipoInput]         = useState('');
  const [urgente, setUrgente]             = useState(false);
  const [vip, setVip]                     = useState(false);
  const [tipoDanoInput, setTipoDanoInput] = useState('');
  const [estadoInput, setEstadoInput]     = useState('');
  const [tramitadorInput, setTramitadorInput] = useState('');
  const [operarioInput, setOperarioInput] = useState('');
  const [busquedaExtra, setBusquedaExtra] = useState('');

  const { data: activosRes, isLoading, isError } = useSiniestrosActivos(filters);
  const { data: statsRes } = useSiniestrosActivosStats();
  const { data: tramitadoresRes } = useSiniestrosTramitadoresList();
  const { data: operariosRes } = useSiniestrosOperariosList();

  const items = activosRes?.data?.items ?? [];
  const total = activosRes?.data?.total ?? 0;
  const totalPages = activosRes?.data?.total_pages ?? 1;
  const statsMap: Record<string, number> = {};
  for (const s of statsRes?.data ?? []) statsMap[s.estado] = s.total;

  const tramitadores = tramitadoresRes?.data ?? [];
  const operarios    = operariosRes?.data ?? [];

  // ── Buscar ────────────────────────────────────────────────────────────────
  const handleBuscar = useCallback(() => {
    setFilters({
      search: searchInput || undefined,
      tipo: tipoInput || undefined,
      urgente: urgente || undefined,
      vip: vip || undefined,
      tipo_dano: tipoDanoInput || undefined,
      estado: estadoInput || undefined,
      tramitador_id: tramitadorInput || undefined,
      operario_id: operarioInput || undefined,
      page: 1,
      per_page: PER_PAGE,
    });
  }, [
    searchInput, tipoInput, urgente, vip,
    tipoDanoInput, estadoInput, tramitadorInput, operarioInput,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBuscar();
  };

  const handleEliminar = (_id: string) => {
    // TODO: conectar con ruta DELETE /expedientes/:id cuando el módulo lo exponga
    alert('Eliminación de expedientes: requiere confirmación adicional de supervisor.');
  };

  // ── Paginación ────────────────────────────────────────────────────────────
  const goPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="page-siniestros-activos">
      {/* ── Cabecera ── */}
      <div className="page-header">
        <h1 className="page-title">Expedientes activos</h1>
        <LeyendaIndicadores />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/expedientes/nuevo')}
        >
          + Nuevo expediente
        </button>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="filtros-bar">
        {/* 1. Buscador general */}
        <input
          type="text"
          className="filtro-input"
          placeholder="Buscar expediente…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* 3. Filtro de tipos */}
        <select
          className="filtro-select"
          value={tipoInput}
          onChange={(e) => setTipoInput(e.target.value)}
        >
          {TIPOS_FILTRO.map((t) => (
            <option key={t} value={t === '--Seleccionar Tipo--' ? '' : t}>{t}</option>
          ))}
        </select>

        {/* 4. Urgente */}
        <label className="filtro-check">
          <input
            type="checkbox"
            checked={urgente}
            onChange={(e) => setUrgente(e.target.checked)}
          />
          Urgente
        </label>

        {/* 5. VIP */}
        <label className="filtro-check">
          <input
            type="checkbox"
            checked={vip}
            onChange={(e) => setVip(e.target.checked)}
          />
          VIP
        </label>

        {/* 6. Tipo de daño */}
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

        {/* 7. Estado pendiente (con contadores) */}
        <select
          className="filtro-select"
          value={estadoInput}
          onChange={(e) => setEstadoInput(e.target.value)}
        >
          {ESTADOS_ACTIVOS.map((e) => (
            <option key={e} value={e === 'Todos' ? '' : e}>
              {e}{statsMap[e] !== undefined ? ` (${statsMap[e]})` : ''}
            </option>
          ))}
        </select>

        {/* 8. Tramitador */}
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

        {/* 9. Operario */}
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

        {/* 10. Búsqueda adicional */}
        <input
          type="text"
          className="filtro-input"
          placeholder="Exp. activos…"
          value={busquedaExtra}
          onChange={(e) => setBusquedaExtra(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* 11. Buscar */}
        <button type="button" className="btn btn-primary" onClick={handleBuscar}>
          Buscar
        </button>
      </div>

      {/* ── Resumen ── */}
      <div className="tabla-resumen">
        Nº de siniestros: <strong>{total}</strong>
        {isLoading && <span className="cargando">  Cargando…</span>}
      </div>

      {/* ── Tabla de activos ── */}
      {isError ? (
        <div className="error-msg">Error al cargar los expedientes. Inténtalo de nuevo.</div>
      ) : (
        <div className="tabla-wrapper">
          <table className="tabla-siniestros">
            <thead>
              <tr>
                <th>Nº Expediente</th>
                <th>Estado</th>
                <th>Tramitador</th>
                <th>Tipo daño</th>
                <th>Fecha alta aseg.</th>
                <th>Días apertura</th>
                <th>Fecha espera</th>
                <th>Días sin act.</th>
                <th title="Perito">Per.</th>
                <th title="Trabajos realizados">Trab.</th>
                <th title="Trabajos reclamados">Recl.</th>
                <th title="Modificar">Mod.</th>
                <th title="Presupuesto">Pres.</th>
                <th title="Factura">Fact.</th>
                <th title="Eliminar">Elim.</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 15 }).map((__, j) => (
                      <td key={j}><div className="skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={15} className="sin-resultados">
                    No hay expedientes activos con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <FilaActivo key={row.id} row={row} onEliminar={handleEliminar} />
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
