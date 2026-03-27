import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle, Search } from 'lucide-react';
import { useAsegurados, useAllCompanias } from '@/hooks/useMasters';

export function ClientesPage() {
  const [search, setSearch] = useState('');
  const [companiaFiltro, setCompaniaFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  const { data: resAsegurados, isLoading } = useAsegurados(search.length >= 2 ? search : undefined);
  const { data: resCompanias } = useAllCompanias();

  const asegurados: any[] = resAsegurados?.data ?? [];
  const companias: any[] = resCompanias?.data ?? [];

  const filtered = companiaFiltro
    ? asegurados.filter((a) => a.compania_id === companiaFiltro)
    : asegurados;

  const total = filtered.length;
  const paginas = Math.ceil(total / POR_PAGINA) || 1;
  const slice = filtered.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="page-stub">
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><UserCircle size={20} /> Clientes / Intervinientes</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Asegurados y terceros intervinientes registrados en el sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32, width: 260 }}
            placeholder="Buscar por nombre, NIF, teléfono..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagina(1); }}
          />
        </div>
        <select className="form-control" style={{ width: 200 }} value={companiaFiltro} onChange={(e) => { setCompaniaFiltro(e.target.value); setPagina(1); }}>
          <option value="">Todas las compañías</option>
          {companias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13, marginLeft: 'auto' }}>
          {total} cliente{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      {isLoading ? <div className="loading">Cargando clientes...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIF</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Localidad</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
                  {search.length > 0 && search.length < 2 ? 'Introduce al menos 2 caracteres para buscar' : 'Sin resultados'}
                </td></tr>
              )}
              {slice.map((a: any) => (
                <tr key={a.id}>
                  <td><div style={{ fontWeight: 600 }}>{a.nombre} {a.apellidos}</div></td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{a.nif ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{a.telefono ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{a.email ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>{a.localidad ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Link to={`/expedientes?asegurado_id=${a.id}`} className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 12 }}>
                      Ver expedientes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {paginas > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹ Anterior</button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>Pág. {pagina} de {paginas}</span>
          <button className="btn btn-secondary" disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)}>Siguiente ›</button>
        </div>
      )}
    </div>
  );
}
