import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProveedores, useDeleteProveedor, type ProveedoresFilters } from '@/hooks/useProveedores';

const PER_PAGE = 10;

export function ProveedoresPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ProveedoresFilters>({
    page: 1,
    per_page: PER_PAGE,
  });

  const { data: res, isLoading } = useProveedores(filters);
  const deleteMut = useDeleteProveedor();

  const result = res && 'data' in res ? (res.data as any) : null;
  const items: any[] = result?.items ?? [];
  const totalPages: number = result?.total_pages ?? 0;

  function applySearch() {
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  function setPage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  async function handleDelete(id: string, nombre: string) {
    if (!window.confirm(`¿Desea borrar este PROVEEDOR?\n\n"${nombre}"`)) return;
    await deleteMut.mutateAsync(id);
  }

  function renderPagination() {
    if (totalPages <= 1) return null;
    const currentPage = filters.page ?? 1;
    const buttons = [];
    for (let p = 1; p <= totalPages; p++) {
      buttons.push(
        <a
          key={p}
          href="#"
          onClick={(e) => { e.preventDefault(); setPage(p); }}
          style={{
            marginRight: 4,
            fontWeight: currentPage === p ? 'bold' : 'normal',
            color: '#333',
            textDecoration: currentPage === p ? 'none' : 'underline',
          }}
        >
          {p}
        </a>
      );
    }
    if (currentPage < totalPages) {
      buttons.push(
        <a
          key="next"
          href="#"
          onClick={(e) => { e.preventDefault(); setPage(currentPage + 1); }}
          style={{ marginRight: 4, color: '#333', textDecoration: 'underline' }}
        >
          &gt;&gt;
        </a>
      );
    }
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {buttons}
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
          Página {currentPage} de {totalPages}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Verdana, Arial, Helvetica, sans-serif', background: '#fff', padding: 16 }}>
      {/* Tabla contenedora principal */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {/* Cabecera / Título */}
        <thead>
          <tr>
            <td
              colSpan={3}
              style={{
                backgroundColor: '#333',
                color: '#f4fcc0',
                fontSize: 14,
                fontWeight: 700,
                padding: '6px 10px',
              }}
            >
              Listado de Proveedores
            </td>
          </tr>
        </thead>
        <tbody>
          {/* Barra de búsqueda */}
          <tr>
            <td colSpan={3} style={{ padding: '8px 0' }}>
              <form
                onSubmit={(e) => { e.preventDefault(); applySearch(); }}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <input
                  type="text"
                  name="busca_proveedor"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar proveedor..."
                  style={{
                    width: 166,
                    background: '#f9f9f9',
                    border: '1px solid #999',
                    fontSize: 12,
                    padding: 2,
                    color: '#333',
                  }}
                />
                <input
                  type="submit"
                  value="Buscar"
                  style={{ fontSize: 12, cursor: 'pointer', padding: '2px 8px' }}
                />
              </form>
            </td>
          </tr>

          {/* Botón alta */}
          <tr>
            <td colSpan={3} style={{ textAlign: 'center', padding: '6px 0' }}>
              <input
                type="button"
                name="anyadir_proveedor"
                value="Añadir Proveedor"
                onClick={() => navigate('/proveedores/nuevo')}
                style={{ fontSize: 12, cursor: 'pointer', padding: '3px 12px' }}
              />
            </td>
          </tr>

          {/* Filas de datos */}
          {isLoading ? (
            <tr>
              <td colSpan={3} style={{ padding: 16, fontSize: 12 }}>Cargando proveedores...</td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 16, fontSize: 12, color: '#666' }}>No se encontraron proveedores</td>
            </tr>
          ) : (
            items.map((p: any) => (
              <tr key={p.id} style={{ backgroundColor: '#DBDBDB' }}>
                <td
                  style={{
                    width: 378,
                    padding: '4px 6px',
                    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
                    fontSize: 12,
                    color: '#333',
                  }}
                >
                  {p.nombre}
                </td>
                <td
                  style={{
                    width: 60,
                    textAlign: 'center',
                    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
                    fontSize: 12,
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); navigate(`/proveedores/${p.id}`); }}
                    style={{ color: '#333' }}
                  >
                    Editar
                  </a>
                </td>
                <td
                  style={{
                    width: 60,
                    textAlign: 'center',
                    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
                    fontSize: 12,
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); handleDelete(p.id, p.nombre); }}
                    style={{ color: '#333' }}
                  >
                    Borrar
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Paginación */}
      {renderPagination()}
    </div>
  );
}
