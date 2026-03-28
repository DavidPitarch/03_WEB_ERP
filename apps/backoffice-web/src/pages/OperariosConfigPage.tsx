import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  useOperariosLista,
  useDeleteOperario,
  useOperarioEspecialidades,
  useAddOperarioEspecialidad,
  useUpdateOperarioEspecialidad,
  useRemoveOperarioEspecialidad,
  type OperariosFilters,
} from '@/hooks/useOperarios';
import { useEspecialidades } from '@/hooks/useEspecialidades';

const PER_PAGE = 10;

// ─── Sub-vista inline de especialidades ──────────────────────────────────────

function EspecialidadesRow({ operarioId }: { operarioId: string }) {
  const { data: espRes, isLoading } = useOperarioEspecialidades(operarioId);
  const { data: catRes } = useEspecialidades(true);
  const especialidades = espRes && 'data' in espRes ? ((espRes.data as unknown) as any[]) ?? [] : [];
  const catalogo: any[] = catRes && 'data' in catRes ? (catRes.data as any[]) ?? [] : [];

  const addMut    = useAddOperarioEspecialidad();
  const updateMut = useUpdateOperarioEspecialidad();
  const removeMut = useRemoveOperarioEspecialidad();

  const [selectedEsp, setSelectedEsp] = useState('');

  const asignadasIds = new Set(especialidades.map((e: any) => e.especialidad_id));
  const disponibles  = catalogo.filter((c) => !asignadasIds.has(c.id));

  async function handleAdd() {
    if (!selectedEsp) return;
    await addMut.mutateAsync({ operarioId, especialidadId: selectedEsp });
    setSelectedEsp('');
  }

  return (
    <tr>
      <td colSpan={5} style={{ background: 'var(--color-bg-subtle)', padding: '12px 24px', borderBottom: '1px solid var(--color-border-default)' }}>
        {isLoading ? (
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Cargando...</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Selector añadir */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-control"
                style={{ width: 280, fontSize: 13 }}
                value={selectedEsp}
                onChange={(e) => setSelectedEsp(e.target.value)}
              >
                <option value="">Especialidades...</option>
                {disponibles.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '4px 12px' }}
                disabled={!selectedEsp || addMut.isPending}
                onClick={handleAdd}
              >
                Añadir
              </button>
            </div>

            {/* Lista de especialidades asignadas */}
            {especialidades.length > 0 && (
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {especialidades.map((rel: any) => (
                    <tr key={rel.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '6px 0', fontWeight: 500 }}>
                        {rel.especialidades?.nombre ?? '—'}
                      </td>
                      <td style={{ padding: '6px 8px', width: 200 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={rel.es_principal}
                            onChange={(e) =>
                              updateMut.mutate({ operarioId, espRelId: rel.id, esPrincipal: e.target.checked })
                            }
                            style={{ width: 13, height: 13 }}
                          />
                          Operario principal
                        </label>
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 8px', color: 'var(--color-danger)' }}
                          onClick={() => removeMut.mutate({ operarioId, espRelId: rel.id })}
                          disabled={removeMut.isPending}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {especialidades.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Sin especialidades asignadas</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function OperariosConfigPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<OperariosFilters>({
    estado: 'activos',
    page: 1,
    per_page: PER_PAGE,
  });
  const [searchInput, setSearchInput]   = useState('');
  const [cpInput, setCpInput]           = useState('');
  const [espInput, setEspInput]         = useState('');
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const { data: res, isLoading } = useOperariosLista(filters);
  const { data: catRes }         = useEspecialidades(true);
  const deleteMut                = useDeleteOperario();

  const result    = res && 'data' in res ? res.data as any : null;
  const items     = result?.items ?? [];
  const total     = result?.total ?? 0;
  const totalPages = result?.total_pages ?? 0;
  const catalogo: any[] = catRes && 'data' in catRes ? (catRes.data as any[]) ?? [] : [];

  function applyFilters() {
    setFilters((f) => ({
      ...f,
      search: searchInput || undefined,
      cp: cpInput || undefined,
      especialidad_id: espInput || undefined,
      page: 1,
    }));
  }

  function setPage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  function setEstado(estado: 'activos' | 'eliminados') {
    setFilters((f) => ({ ...f, estado, page: 1 }));
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleDelete(id: string, nombre: string) {
    if (!window.confirm(`¿Dar de baja al operario "${nombre}"?`)) return;
    await deleteMut.mutateAsync(id);
  }

  // Paginación: renderiza botones
  function renderPagination() {
    if (totalPages <= 1) return null;
    const buttons = [];
    for (let p = 1; p <= totalPages; p++) {
      buttons.push(
        <button
          key={p}
          className={`btn ${filters.page === p ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minWidth: 32, padding: '3px 8px', fontSize: 12 }}
          onClick={() => setPage(p)}
        >
          {p}
        </button>
      );
    }
    if (totalPages > 1) {
      buttons.push(
        <button
          key="end"
          className="btn btn-secondary"
          style={{ minWidth: 32, padding: '3px 8px', fontSize: 12 }}
          onClick={() => setPage(totalPages)}
        >
          {'>>'}
        </button>
      );
    }
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {buttons}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          Página {filters.page} de {totalPages} — {total} operario{total !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="page-stub">
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardHat size={20} /> Listado de Operarios
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {total} operario{total !== 1 ? 's' : ''} · Gestión de especialidades y configuración
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => navigate('/operarios-config/nuevo')}
        >
          <Plus size={15} /> Añadir Operario
        </button>
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--color-bg-subtle)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-default)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 28, width: 200, fontSize: 13 }}
            placeholder="Buscar por nombre..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>CP:</label>
          <input
            className="form-control"
            type="number"
            style={{ width: 90, fontSize: 13 }}
            placeholder="00000"
            value={cpInput}
            onChange={(e) => setCpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Especialidad:</label>
          <select
            className="form-control"
            style={{ width: 200, fontSize: 13 }}
            value={espInput}
            onChange={(e) => setEspInput(e.target.value)}
          >
            <option value="">Todas</option>
            {catalogo.map((e: any) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={applyFilters}>
          Buscar
        </button>
        <select
          className="form-control"
          style={{ width: 130, fontSize: 13 }}
          value={filters.estado ?? 'activos'}
          onChange={(e) => setEstado(e.target.value as 'activos' | 'eliminados')}
        >
          <option value="activos">Activos</option>
          <option value="eliminados">Eliminados</option>
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="loading">Cargando operarios...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ background: '#000', color: '#fff' }} colSpan={5}>Listado de Operarios</th>
              </tr>
              <tr>
                <th>Operario</th>
                <th>Especialidades</th>
                <th>Editar</th>
                <th>Borrar</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                    Sin operarios
                  </td>
                </tr>
              )}
              {items.map((o: any) => (
                <>
                  <tr
                    key={o.id}
                    style={{ opacity: o.activo ? 1 : 0.55, background: expandedId === o.id ? 'var(--color-bg-subtle)' : undefined }}
                  >
                    <td>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}
                        onClick={() => toggleExpand(o.id)}
                      >
                        {expandedId === o.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span style={{ color: o.activo ? 'var(--color-success)' : 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 700 }}>
                          ({o.activo ? 'A' : 'N'})
                        </span>
                        {o.nombre} {o.apellidos}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => toggleExpand(o.id)}
                      >
                        Especialidades
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => navigate(`/operarios-config/${o.id}`)}
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '2px 8px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleDelete(o.id, `${o.nombre} ${o.apellidos}`)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={12} /> Borrar
                      </button>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 16 }}>
                      {o.bloqueado && (
                        <span title="Bloqueado" style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: 18 }}>⊘</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === o.id && (
                    <EspecialidadesRow key={`esp-${o.id}`} operarioId={o.id} />
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {renderPagination()}
    </div>
  );
}
