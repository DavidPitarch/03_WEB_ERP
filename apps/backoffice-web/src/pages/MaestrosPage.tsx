import { useState } from 'react';
import { useAllCompanias, useCreateCompania, useUpdateCompania, useOperarios, useCreateOperario, useUpdateOperario } from '@/hooks/useMasters';
import { useCatalogos } from '@/hooks/useMasters';

type Tab = 'companias' | 'operarios';

export function MaestrosPage() {
  const [tab, setTab] = useState<Tab>('companias');

  return (
    <div className="page-maestros">
      <h2>Maestros</h2>
      <div className="tabs">
        <button className={`tab ${tab === 'companias' ? 'active' : ''}`} onClick={() => setTab('companias')}>Compañías</button>
        <button className={`tab ${tab === 'operarios' ? 'active' : ''}`} onClick={() => setTab('operarios')}>Operarios</button>
      </div>
      {tab === 'companias' && <CompaniasTab />}
      {tab === 'operarios' && <OperariosTab />}
    </div>
  );
}

function CompaniasTab() {
  const { data: res, isLoading } = useAllCompanias();
  const createMut = useCreateCompania();
  const updateMut = useUpdateCompania();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', codigo: '', cif: '', activa: true });

  const companias = res && 'data' in res ? res.data ?? [] : [];

  const handleSave = () => {
    if (editId) {
      updateMut.mutate({ id: editId, ...form }, { onSuccess: () => { setShowForm(false); setEditId(null); } });
    } else {
      createMut.mutate(form, { onSuccess: () => { setShowForm(false); setForm({ nombre: '', codigo: '', cif: '', activa: true }); } });
    }
  };

  const handleEdit = (c: any) => {
    setForm({ nombre: c.nombre, codigo: c.codigo, cif: c.cif || '', activa: c.activa });
    setEditId(c.id);
    setShowForm(true);
  };

  if (isLoading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <div className="section-header">
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', codigo: '', cif: '', activa: true }); }}>
          {showForm ? 'Cancelar' : 'Nueva compañía'}
        </button>
      </div>

      {showForm && (
        <div className="inline-form">
          <div className="form-grid">
            <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="form-group"><label>Código *</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
            <div className="form-group"><label>CIF</label><input value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} /></div>
            <div className="form-group">
              <label>Activa</label>
              <label className="checkbox-label"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Sí</label>
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave}>{editId ? 'Guardar' : 'Crear'}</button>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Nombre</th><th>Código</th><th>CIF</th><th>Activa</th><th></th></tr></thead>
        <tbody>
          {(companias as any[]).map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td><td>{c.codigo}</td><td>{c.cif || '—'}</td>
              <td>{c.activa ? 'Sí' : 'No'}</td>
              <td><button className="btn-link" onClick={() => handleEdit(c)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperariosTab() {
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

  const toggleGremio = (codigo: string) => {
    setForm((f) => ({
      ...f,
      gremios: f.gremios.includes(codigo) ? f.gremios.filter((g) => g !== codigo) : [...f.gremios, codigo],
    }));
  };

  if (isLoading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <div className="section-header">
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', apellidos: '', telefono: '', email: '', gremios: [], activo: true }); }}>
          {showForm ? 'Cancelar' : 'Nuevo operario'}
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
            <label>Gremios</label>
            <div className="chips">
              {(gremios as any[]).map((g) => (
                <button key={g.codigo} type="button" className={`chip ${form.gremios.includes(g.codigo) ? 'active' : ''}`} onClick={() => toggleGremio(g.codigo)}>
                  {g.valor}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave}>{editId ? 'Guardar' : 'Crear'}</button>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Gremios</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          {(operarios as any[]).map((o) => (
            <tr key={o.id}>
              <td>{o.nombre} {o.apellidos}</td><td>{o.telefono}</td><td>{o.email || '—'}</td>
              <td>{(o.gremios || []).join(', ') || '—'}</td>
              <td>{o.activo ? 'Sí' : 'No'}</td>
              <td><button className="btn-link" onClick={() => handleEdit(o)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
