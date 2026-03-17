import { useState, type FormEvent } from 'react';
import { usePeritosAdmin, useCrearPerito, useUpdatePerito, useAsignarPeritoExpediente } from '@/hooks/usePeritos';

export function PeritosAdminPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [asignarForm, setAsignarForm] = useState({ expedienteId: '', perito_id: '' });
  const [showAsignar, setShowAsignar] = useState(false);

  const { data, isLoading } = usePeritosAdmin({ search: search || undefined });
  const crearMut = useCrearPerito();
  const updateMut = useUpdatePerito();
  const asignarMut = useAsignarPeritoExpediente();

  const result: any = data && 'data' in data ? data.data : null;
  const items: any[] = result?.items ?? [];

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj: Record<string, any> = {};
    fd.forEach((v, k) => { if (v) obj[k] = v; });
    if (obj.especialidades) obj.especialidades = (obj.especialidades as string).split(',').map((s: string) => s.trim());
    crearMut.mutate(obj, { onSuccess: () => setShowCreate(false) });
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj: { id: string } & Record<string, any> = { id: editRow.id };
    fd.forEach((v, k) => { if (v) obj[k] = v; });
    if (obj.especialidades) obj.especialidades = (obj.especialidades as string).split(',').map((s: string) => s.trim());
    obj.activo = fd.get('activo') === 'true';
    updateMut.mutate(obj, { onSuccess: () => setEditRow(null) });
  }

  function handleAsignar() {
    if (!asignarForm.expedienteId || !asignarForm.perito_id) return;
    asignarMut.mutate(asignarForm, { onSuccess: () => { setShowAsignar(false); setAsignarForm({ expedienteId: '', perito_id: '' }); } });
  }

  return (
    <div className="page-peritos-admin">
      <div className="page-header">
        <h2>Peritos</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Nuevo perito</button>
          <button className="btn" onClick={() => setShowAsignar(true)}>Asignar a expediente</button>
        </div>
      </div>

      <div className="filters-bar">
        <input type="search" placeholder="Buscar por nombre, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
      </div>

      {isLoading ? (
        <div className="loading">Cargando peritos...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No se encontraron peritos</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>Colegiado</th>
              <th>Especialidades</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id}>
                <td>{p.nombre} {p.apellidos}</td>
                <td>{p.email ?? '-'}</td>
                <td>{p.telefono ?? '-'}</td>
                <td>{p.colegiado_numero ?? '-'}</td>
                <td>{p.especialidades?.join(', ') ?? '-'}</td>
                <td>{p.activo ? <span className="badge badge-success">Si</span> : <span className="badge badge-inactivo">No</span>}</td>
                <td><button className="btn btn-sm" onClick={() => setEditRow(p)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo perito</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>User ID (UUID)</label><input name="user_id" required className="form-input" /></div>
              <div className="form-group"><label>Nombre</label><input name="nombre" required className="form-input" /></div>
              <div className="form-group"><label>Apellidos</label><input name="apellidos" required className="form-input" /></div>
              <div className="form-group"><label>Email</label><input name="email" type="email" className="form-input" /></div>
              <div className="form-group"><label>Telefono</label><input name="telefono" className="form-input" /></div>
              <div className="form-group"><label>N. Colegiado</label><input name="colegiado_numero" className="form-input" /></div>
              <div className="form-group"><label>Especialidades (coma separadas)</label><input name="especialidades" className="form-input" /></div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={crearMut.isPending}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <div className="modal-overlay" onClick={() => setEditRow(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar perito</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-group"><label>Nombre</label><input name="nombre" defaultValue={editRow.nombre} required className="form-input" /></div>
              <div className="form-group"><label>Apellidos</label><input name="apellidos" defaultValue={editRow.apellidos} required className="form-input" /></div>
              <div className="form-group"><label>Email</label><input name="email" type="email" defaultValue={editRow.email ?? ''} className="form-input" /></div>
              <div className="form-group"><label>Telefono</label><input name="telefono" defaultValue={editRow.telefono ?? ''} className="form-input" /></div>
              <div className="form-group"><label>N. Colegiado</label><input name="colegiado_numero" defaultValue={editRow.colegiado_numero ?? ''} className="form-input" /></div>
              <div className="form-group"><label>Especialidades</label><input name="especialidades" defaultValue={editRow.especialidades?.join(', ') ?? ''} className="form-input" /></div>
              <div className="form-group">
                <label>Activo</label>
                <select name="activo" defaultValue={editRow.activo ? 'true' : 'false'} className="filter-select">
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditRow(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asignar modal */}
      {showAsignar && (
        <div className="modal-overlay" onClick={() => setShowAsignar(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Asignar perito a expediente</h3>
            <div className="form-group">
              <label>Expediente ID</label>
              <input type="text" value={asignarForm.expedienteId} onChange={(e) => setAsignarForm({ ...asignarForm, expedienteId: e.target.value })} className="form-input" />
            </div>
            <div className="form-group">
              <label>Perito ID</label>
              <input type="text" value={asignarForm.perito_id} onChange={(e) => setAsignarForm({ ...asignarForm, perito_id: e.target.value })} className="form-input" />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAsignar(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAsignar} disabled={asignarMut.isPending}>Asignar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
