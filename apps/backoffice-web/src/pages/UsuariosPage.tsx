import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useTramitadores,
  useCrearTramitador,
  useToggleTramitador,
} from '@/hooks/useTramitadores';

const SEMAFORO_COLORS: Record<string, string> = {
  verde: '#22c55e',
  amarillo: '#f59e0b',
  rojo: '#ef4444',
};

export function UsuariosPage() {
  const { data: res, isLoading, refetch } = useTramitadores();
  const crearTramitador = useCrearTramitador();
  const toggleTramitador = useToggleTramitador();
  const [showModal, setShowModal] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'bajas'>('activos');
  const [form, setForm] = useState({
    user_id: '', nombre: '', apellidos: '', email: '',
    telefono: '', nivel: 'junior', max_expedientes_activos: 30, max_urgentes: 5,
  });
  const [formError, setFormError] = useState('');

  const tramitadores: any[] = res?.data ?? [];

  const filtered = tramitadores.filter((t) => {
    if (filtroActivo === 'activos') return t.activo;
    if (filtroActivo === 'bajas') return !t.activo;
    return true;
  });

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      await crearTramitador.mutateAsync(form);
      setShowModal(false);
      setForm({ user_id: '', nombre: '', apellidos: '', email: '', telefono: '', nivel: 'junior', max_expedientes_activos: 30, max_urgentes: 5 });
      refetch();
    } catch (err: any) {
      setFormError(err.message ?? 'Error al crear tramitador');
    }
  }

  async function handleToggle(id: string, activar: boolean) {
    await toggleTramitador.mutateAsync({ id, activar });
    refetch();
  }

  return (
    <div className="page-usuarios">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Usuarios y Tramitadores</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Gestión de tramitadores internos y configuración de capacidad
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/usuarios/cargas" className="btn btn-secondary">Panel de cargas</Link>
          <Link to="/usuarios/cola" className="btn btn-secondary">Cola de asignación</Link>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo tramitador</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['activos', 'todos', 'bajas'] as const).map((f) => (
          <button
            key={f}
            className={`btn ${filtroActivo === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltroActivo(f)}
          >
            {f === 'activos' ? 'Activos' : f === 'bajas' ? 'Bajas' : 'Todos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Nivel</th>
                <th>Estado</th>
                <th>Carga actual</th>
                <th>Máx. expedientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px 0' }}>
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtered.map((t: any) => (
                <tr key={t.id} style={{ opacity: t.activo ? 1 : 0.55 }}>
                  <td>
                    <Link to={`/usuarios/tramitador/${t.id}`} style={{ fontWeight: 600 }}>
                      {t.nombre} {t.apellidos}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--color-muted)', fontSize: 13 }}>{t.email}</td>
                  <td><span className="badge badge-default">{t.nivel}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.activo ? '#22c55e' : '#9ca3af', display: 'inline-block' }} />
                      {t.activo ? 'Activo' : 'Baja'}
                    </span>
                  </td>
                  <td>
                    {t.carga ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(t.carga.porcentaje_carga ?? 0, 100)}%`,
                            background: SEMAFORO_COLORS[t.carga.semaforo ?? 'verde'],
                            borderRadius: 3,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: SEMAFORO_COLORS[t.carga.semaforo ?? 'verde'], minWidth: 34, textAlign: 'right' }}>
                          {t.carga.porcentaje_carga ?? 0}%
                        </span>
                      </div>
                    ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--color-muted)', fontSize: 13, textAlign: 'center' }}>
                    {t.max_expedientes_activos}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/usuarios/tramitador/${t.id}`} className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 8px' }}>
                        Ver detalle
                      </Link>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '3px 8px' }}
                        onClick={() => handleToggle(t.id, !t.activo)}
                        disabled={toggleTramitador.isPending}
                      >
                        {t.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Nuevo tramitador</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCrear}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="form-field">
                    <span>Nombre *</span>
                    <input className="form-input" value={form.nombre} required
                      onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} />
                  </label>
                  <label className="form-field">
                    <span>Apellidos *</span>
                    <input className="form-input" value={form.apellidos} required
                      onChange={(e) => setForm(p => ({ ...p, apellidos: e.target.value }))} />
                  </label>
                  <label className="form-field">
                    <span>Email *</span>
                    <input className="form-input" type="email" value={form.email} required
                      onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                  </label>
                  <label className="form-field">
                    <span>Teléfono</span>
                    <input className="form-input" value={form.telefono}
                      onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))} />
                  </label>
                  <label className="form-field" style={{ gridColumn: '1/-1' }}>
                    <span>User ID (Supabase Auth) *</span>
                    <input className="form-input" value={form.user_id} required
                      placeholder="UUID del usuario en auth.users"
                      onChange={(e) => setForm(p => ({ ...p, user_id: e.target.value }))} />
                  </label>
                  <label className="form-field">
                    <span>Nivel</span>
                    <select className="form-input" value={form.nivel}
                      onChange={(e) => setForm(p => ({ ...p, nivel: e.target.value }))}>
                      <option value="junior">Junior</option>
                      <option value="senior">Senior</option>
                      <option value="especialista">Especialista</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Máx. expedientes activos</span>
                    <input className="form-input" type="number" min={1} max={500}
                      value={form.max_expedientes_activos}
                      onChange={(e) => setForm(p => ({ ...p, max_expedientes_activos: parseInt(e.target.value) || 30 }))} />
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={crearTramitador.isPending}>
                  {crearTramitador.isPending ? 'Creando...' : 'Crear tramitador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
