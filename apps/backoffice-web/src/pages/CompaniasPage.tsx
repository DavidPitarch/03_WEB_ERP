import { useState } from 'react';
import { useAllCompanias, useCreateCompania, useUpdateCompania } from '@/hooks/useMasters';

export function CompaniasPage() {
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

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: '', codigo: '', cif: '', activa: true });
  };

  if (isLoading) return <div className="loading">Cargando...</div>;

  return (
    <div className="page-maestros">
      <div className="page-header">
        <h2>Compañías / Corredurías / AF</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', codigo: '', cif: '', activa: true }); }}>
          {showForm && !editId ? 'Cancelar' : 'Nueva compañía'}
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" onClick={handleSave}>{editId ? 'Guardar' : 'Crear'}</button>
            <button className="btn-link" onClick={handleCancel}>Cancelar</button>
          </div>
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
          {companias.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay compañías registradas</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
