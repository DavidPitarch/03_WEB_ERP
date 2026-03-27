import { useState } from 'react';
import { Landmark, Plus, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEmpresasFacturadoras } from '@/hooks/useMasters';

interface CuentaBancaria {
  id: string;
  empresa_id: string;
  alias: string;
  entidad: string;
  iban: string;
  bic_swift: string | null;
  moneda: string;
  es_principal: boolean;
  activa: boolean;
  created_at: string;
}

const EMPTY: Partial<CuentaBancaria> = {
  alias: '', entidad: '', iban: '', bic_swift: '', moneda: 'EUR', es_principal: false, activa: true, empresa_id: '',
};

export function BancosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CuentaBancaria | null>(null);
  const [form, setForm] = useState<Partial<CuentaBancaria>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: () => api.get<CuentaBancaria[]>('/bancos/cuentas'),
  });
  const { data: resEmpresas } = useEmpresasFacturadoras();

  const crear = useMutation({
    mutationFn: (data: Partial<CuentaBancaria>) => api.post<CuentaBancaria>('/bancos/cuentas', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuentas-bancarias'] }),
  });
  const actualizar = useMutation({
    mutationFn: ({ id, ...data }: Partial<CuentaBancaria> & { id: string }) => api.put<CuentaBancaria>(`/bancos/cuentas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuentas-bancarias'] }),
  });

  const cuentas: CuentaBancaria[] = res?.data ?? [];
  const empresas: any[] = resEmpresas?.data ?? [];

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, empresa_id: empresas[0]?.id ?? '' });
    setFormError('');
    setShowForm(true);
  }
  function openEdit(c: CuentaBancaria) {
    setEditing(c);
    setForm({ ...c });
    setFormError('');
    setShowForm(true);
  }
  function setField(k: keyof CuentaBancaria, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    try {
      if (editing) await actualizar.mutateAsync({ id: editing.id, ...form });
      else await crear.mutateAsync(form);
      setShowForm(false);
    } catch (err: any) { setFormError(err.message ?? 'Error al guardar'); }
  }

  const isPending = crear.isPending || actualizar.isPending;

  function getEmpresaNombre(id: string) {
    return empresas.find((e: any) => e.id === id)?.nombre ?? id;
  }

  return (
    <div className="page-stub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Landmark size={20} /> Bancos y Cuentas</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Cuentas bancarias de las empresas facturadoras del grupo</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openNew}>
          <Plus size={15} /> Nueva cuenta
        </button>
      </div>

      {isLoading ? <div className="loading">Cargando...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alias</th>
                <th>Entidad</th>
                <th>IBAN</th>
                <th>BIC/SWIFT</th>
                <th>Empresa</th>
                <th style={{ textAlign: 'center' }}>Principal</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin cuentas registradas</td></tr>
              )}
              {cuentas.map((c) => (
                <tr key={c.id} style={{ opacity: c.activa ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{c.alias}</td>
                  <td>{c.entidad}</td>
                  <td><code style={{ fontSize: 12, letterSpacing: 1 }}>{c.iban}</code></td>
                  <td style={{ fontSize: 13 }}>{c.bic_swift ?? '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{getEmpresaNombre(c.empresa_id)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {c.es_principal && <span className="badge badge-info">Principal</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c.activa ? 'badge-success' : 'badge-default'}`}>{c.activa ? 'Activa' : 'Inactiva'}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openEdit(c)} title="Editar">
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay-v2" onClick={() => setShowForm(false)}>
          <div className="modal-v2 modal-v2--md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">{editing ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}</div>
              <button className="modal-v2__close" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-grid-v2">
                  <div className="form-group-v2">
                    <label className="form-label required">Alias</label>
                    <input className="form-control" value={form.alias ?? ''} required autoFocus placeholder="Ej. Cuenta principal BBVA" onChange={(e) => setField('alias', e.target.value)} />
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label required">Entidad bancaria</label>
                    <input className="form-control" value={form.entidad ?? ''} required placeholder="Ej. BBVA" onChange={(e) => setField('entidad', e.target.value)} />
                  </div>
                  <div className="form-group-v2 span-full">
                    <label className="form-label required">IBAN</label>
                    <input className="form-control" value={form.iban ?? ''} required placeholder="ES00 0000 0000 0000 0000 0000" onChange={(e) => setField('iban', e.target.value.toUpperCase())} style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">BIC / SWIFT</label>
                    <input className="form-control" value={form.bic_swift ?? ''} placeholder="Ej. BBVAESMMXXX" onChange={(e) => setField('bic_swift', e.target.value.toUpperCase())} style={{ fontFamily: 'monospace' }} />
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label required">Empresa</label>
                    <select className="form-control" value={form.empresa_id ?? ''} required onChange={(e) => setField('empresa_id', e.target.value)}>
                      <option value="">Seleccionar empresa...</option>
                      {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group-v2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="principal-cb" checked={form.es_principal ?? false} onChange={(e) => setField('es_principal', e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="principal-cb" className="form-label" style={{ margin: 0 }}>Cuenta principal</label>
                  </div>
                  {editing && (
                    <div className="form-group-v2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" id="activa-cb" checked={form.activa ?? true} onChange={(e) => setField('activa', e.target.checked)} style={{ width: 16, height: 16 }} />
                      <label htmlFor="activa-cb" className="form-label" style={{ margin: 0 }}>Cuenta activa</label>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear cuenta')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
