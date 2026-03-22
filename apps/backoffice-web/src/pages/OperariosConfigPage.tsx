import { useState } from 'react';
import { useOperarios, useCreateOperario, useUpdateOperario, useCatalogos } from '@/hooks/useMasters';

export function OperariosConfigPage() {
  const { data: gremiosRes } = useCatalogos('gremio');
  const gremios = gremiosRes && 'data' in gremiosRes ? gremiosRes.data ?? [] : [];

  const { data: res, isLoading } = useOperarios();
  const createMut = useCreateOperario();
  const updateMut = useUpdateOperario();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', apellidos: '', telefono: '', email: '', gremios: [] as string[], activo: true });

  const operarios = res && 'data' in res ? res.data ?? [] : [];

  const handleSave = () => {
    if (editId) {
      updateMut.mutate({ id: editId, ...form }, { onSuccess: () => { setShowForm(false); setEditId(null); } });
    } else {
      createMut.mutate(form, { onSuccess: () => { setShowForm(false); setForm({ nombre: '', apellidos: '', telefono: '', email: '', gremios: [], activo: true }); } });
    }
  };

  const handleEdit = (o: any) => {
    setForm({ nombre: o.nombre, apellidos: o.apellidos, telefono: o.telefono, email: o.email || '', gremios: o.gremios || [], activo: o.activo });
    setEditId(o.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: '', apellidos: '', telefono: '', email: '', gremios: [], activo: true });
  };

  const toggleGremio = (codigo: string) => {
    setForm((f) => ({
      ...f,
      gremios: f.gremios.includes(codigo) ? f.gremios.filter((g) => g !== codigo) : [...f.gremios, codigo],
    }));
  };

  if (isLoading) return <div className="loading">Cargando...</div>;

  return (
    <div className="page-maestros">
      <div className="page-header">
        <h2>Operarios</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', apellidos: '', telefono: '', email: '', gremios: [], activo: true }); }}>
          {showForm && !editId ? 'Cancelar' : 'Nuevo operario'}
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="form-grid">
            <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="form-group"><label>Apellidos *</label><input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></div>
            <div className="form-group"><label>Teléfono *</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
            <div className="form-group"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="form-group">
            <label>Especialidades (Gremios)</label>
            <div className="chips">
              {(gremios as any[]).map((g) => (
                <button key={g.codigo} type="button" className={`chip ${form.gremios.includes(g.codigo) ? 'active' : ''}`} onClick={() => toggleGremio(g.codigo)}>
                  {g.valor}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" onClick={handleSave}>{editId ? 'Guardar' : 'Crear'}</button>
            <button className="btn-link" onClick={handleCancel}>Cancelar</button>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Especialidades</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          {(operarios as any[]).map((o) => (
            <tr key={o.id}>
              <td>{o.nombre} {o.apellidos}</td><td>{o.telefono}</td><td>{o.email || '—'}</td>
              <td>{(o.gremios || []).join(', ') || '—'}</td>
              <td>{o.activo ? 'Sí' : 'No'}</td>
              <td><button className="btn-link" onClick={() => handleEdit(o)}>Editar</button></td>
            </tr>
          ))}
          {operarios.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay operarios registrados</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
