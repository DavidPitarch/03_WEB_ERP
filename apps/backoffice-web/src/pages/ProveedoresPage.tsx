import { useState, type FormEvent } from 'react';
import { useProveedores, useCrearProveedor, useUpdateProveedor } from '@/hooks/useProveedores';

export function ProveedoresPage() {
  const [search, setSearch] = useState('');
  const [activoFilter, setActivoFilter] = useState<'' | 'true' | 'false'>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);

  const { data, isLoading } = useProveedores({
    search: search || undefined,
    activo: activoFilter === '' ? undefined : activoFilter === 'true',
  });

  const items: any[] = data && 'data' in data ? (data.data as any[]) ?? [] : [];

  return (
    <div className="page-proveedores">
      <div className="page-header">
        <h2>Proveedores</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nuevo proveedor</button>
      </div>

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Buscar por nombre, CIF, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={activoFilter}
          onChange={(e) => setActivoFilter(e.target.value as '' | 'true' | 'false')}
          className="filter-select"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando proveedores...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron proveedores</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Canal preferido</th>
              <th>Especialidades</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id} onClick={() => setEditRow(p)} style={{ cursor: 'pointer' }}>
                <td><strong>{p.nombre}</strong></td>
                <td>{p.email ?? '—'}</td>
                <td>{p.telefono ?? '—'}</td>
                <td>{p.canal_preferido ?? '—'}</td>
                <td>
                  {(p.especialidades ?? []).map((esp: string) => (
                    <span key={esp} className="badge" style={{ backgroundColor: '#6366f1', marginRight: 4 }}>{esp}</span>
                  ))}
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: p.activo ? '#22c55e' : '#9ca3af' }}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && <CreateProveedorModal onClose={() => setShowCreate(false)} />}
      {editRow && <EditProveedorModal proveedor={editRow} onClose={() => setEditRow(null)} />}
    </div>
  );
}

function CreateProveedorModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearProveedor();
  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [cp, setCp] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [canalPreferido, setCanalPreferido] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [notas, setNotas] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    crear.mutate(
      {
        nombre,
        cif: cif || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        direccion: direccion || undefined,
        cp: cp || undefined,
        localidad: localidad || undefined,
        provincia: provincia || undefined,
        canal_preferido: canalPreferido || undefined,
        especialidades: especialidades ? especialidades.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        notas: notas || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo proveedor</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>CIF</label>
            <input type="text" value={cif} onChange={(e) => setCif(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Código postal</label>
            <input type="text" value={cp} onChange={(e) => setCp(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Localidad</label>
            <input type="text" value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Provincia</label>
            <input type="text" value={provincia} onChange={(e) => setProvincia(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Canal preferido</label>
            <select value={canalPreferido} onChange={(e) => setCanalPreferido(e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="email">Email</option>
              <option value="telefono">Teléfono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="portal">Portal</option>
            </select>
          </div>
          <div className="form-group">
            <label>Especialidades (separadas por coma)</label>
            <input type="text" value={especialidades} onChange={(e) => setEspecialidades(e.target.value)} placeholder="fontanería, electricidad, pintura" />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando...' : 'Crear proveedor'}
            </button>
          </div>
          {crear.isError && <div className="form-error">Error al crear el proveedor</div>}
        </form>
      </div>
    </div>
  );
}

function EditProveedorModal({ proveedor, onClose }: { proveedor: any; onClose: () => void }) {
  const update = useUpdateProveedor();
  const [nombre, setNombre] = useState(proveedor.nombre ?? '');
  const [cif, setCif] = useState(proveedor.cif ?? '');
  const [telefono, setTelefono] = useState(proveedor.telefono ?? '');
  const [email, setEmail] = useState(proveedor.email ?? '');
  const [direccion, setDireccion] = useState(proveedor.direccion ?? '');
  const [cp, setCp] = useState(proveedor.cp ?? '');
  const [localidad, setLocalidad] = useState(proveedor.localidad ?? '');
  const [provincia, setProvincia] = useState(proveedor.provincia ?? '');
  const [canalPreferido, setCanalPreferido] = useState(proveedor.canal_preferido ?? '');
  const [especialidades, setEspecialidades] = useState((proveedor.especialidades ?? []).join(', '));
  const [notas, setNotas] = useState(proveedor.notas ?? '');
  const [activo, setActivo] = useState(proveedor.activo ?? true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        id: proveedor.id,
        nombre,
        cif: cif || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        direccion: direccion || undefined,
        cp: cp || undefined,
        localidad: localidad || undefined,
        provincia: provincia || undefined,
        canal_preferido: canalPreferido || undefined,
        especialidades: especialidades ? especialidades.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        notas: notas || undefined,
        activo,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Editar proveedor</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>CIF</label>
            <input type="text" value={cif} onChange={(e) => setCif(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Código postal</label>
            <input type="text" value={cp} onChange={(e) => setCp(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Localidad</label>
            <input type="text" value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Provincia</label>
            <input type="text" value={provincia} onChange={(e) => setProvincia(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Canal preferido</label>
            <select value={canalPreferido} onChange={(e) => setCanalPreferido(e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="email">Email</option>
              <option value="telefono">Teléfono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="portal">Portal</option>
            </select>
          </div>
          <div className="form-group">
            <label>Especialidades (separadas por coma)</label>
            <input type="text" value={especialidades} onChange={(e) => setEspecialidades(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              {' '}Activo
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={update.isPending}>
              {update.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
          {update.isError && <div className="form-error">Error al actualizar el proveedor</div>}
        </form>
      </div>
    </div>
  );
}
