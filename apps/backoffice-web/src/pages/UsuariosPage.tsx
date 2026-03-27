import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useTramitadores,
  useCrearTramitador,
  useToggleTramitador,
  useToggleAusente,
} from '@/hooks/useTramitadores';

const SEMAFORO_COLORS: Record<string, string> = {
  verde: '#22c55e',
  amarillo: '#f59e0b',
  rojo:    '#ef4444',
};

const ROL_LABELS: Record<string, string> = {
  tramitador:          'Tramitador',
  facturacion:         'Facturación',
  redes:               'Redes',
  administrador:       'Administrador',
  super_administrador: 'Super Admin',
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function UsuariosPage() {
  const { data: res, isLoading, refetch } = useTramitadores();
  const crearTramitador  = useCrearTramitador();
  const toggleTramitador = useToggleTramitador();
  const toggleAusente    = useToggleAusente();

  const [showModal, setShowModal]       = useState(false);
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'bajas'>('activos');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({
    nombre: '', apellidos: '', email: '',
    telefono: '', nivel: 'tramitador', max_expedientes_activos: 30, max_urgentes: 5,
  });
  const [formError, setFormError] = useState('');

  const tramitadores: any[] = res?.data ?? [];

  const filtered = tramitadores.filter((t) => {
    if (filtroActivo === 'activos') return t.activo;
    if (filtroActivo === 'bajas')   return !t.activo;
    return true;
  });

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      await crearTramitador.mutateAsync(form);
      setShowModal(false);
      setForm({ nombre: '', apellidos: '', email: '', telefono: '', nivel: 'tramitador', max_expedientes_activos: 30, max_urgentes: 5 });
      refetch();
    } catch (err: any) {
      setFormError(err.message ?? 'Error al crear tramitador');
    }
  }

  async function handleToggle(id: string, activar: boolean) {
    await toggleTramitador.mutateAsync({ id, activar });
    refetch();
  }

  async function handleAusente(id: string, ausente: boolean) {
    await toggleAusente.mutateAsync({ id, ausente });
  }

  return (
    <div className="page-usuarios">

      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Usuarios y Tramitadores</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Gestión de accesos, roles y capacidad operativa
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/usuarios/cargas" className="btn btn-secondary">Panel de cargas</Link>
          <Link to="/usuarios/cola"   className="btn btn-secondary">Cola de asignación</Link>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo usuario</button>
        </div>
      </div>

      {/* ── Filtros ── */}
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

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Permisos</th>
                <th>Tipo</th>
                <th>Carga</th>
                <th style={{ textAlign: 'center' }}>Ausente</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '32px 0' }}>
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtered.map((t: any) => {
                const tipo = t.empresa_facturadora_id ? 'Compañía' : 'Tramitación';
                const permisos: string[] = t.permisos ?? [];

                return (
                  <tr key={t.id} style={{ opacity: t.activo ? 1 : 0.55 }}>

                    {/* Nombre */}
                    <td>
                      <Link to={`/usuarios/tramitador/${t.tramitador_id ?? t.id}`} style={{ fontWeight: 600 }}>
                        {t.nombre} {t.apellidos}
                      </Link>
                    </td>

                    {/* Usuario (email) */}
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {t.email ?? '—'}
                    </td>

                    {/* Permisos */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {permisos.length > 0
                          ? permisos.map((p) => (
                              <span key={p} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p}</span>
                            ))
                          : <span className="badge badge-default">{ROL_LABELS[t.nivel] ?? t.nivel}</span>
                        }
                      </div>
                    </td>

                    {/* Tipo */}
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{tipo}</span>
                    </td>

                    {/* Carga */}
                    <td>
                      {t.carga ?? (t.total_activos !== undefined) ? (
                        <div style={{ minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--color-border-default)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(t.porcentaje_carga ?? 0, 100)}%`,
                                background: SEMAFORO_COLORS[t.semaforo ?? 'verde'],
                                borderRadius: 3,
                                transition: 'width 0.3s',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: SEMAFORO_COLORS[t.semaforo ?? 'verde'], minWidth: 32, textAlign: 'right' }}>
                              {t.porcentaje_carga ?? 0}%
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                            <span>Activos: <strong style={{ color: 'var(--color-text-primary)' }}>{t.total_activos ?? 0}</strong></span>
                            <span>Máx: <strong style={{ color: 'var(--color-text-primary)' }}>{t.max_expedientes_activos}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Ausente */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={t.ausente ?? false}
                        disabled={toggleAusente.isPending}
                        onChange={(e) => handleAusente(t.tramitador_id ?? t.id, e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                        title={t.ausente ? 'Marcar como presente' : 'Marcar como ausente'}
                      />
                    </td>

                    {/* Estado */}
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: t.activo ? '#22c55e' : '#9ca3af',
                          display: 'inline-block', flexShrink: 0,
                        }} />
                        {t.activo ? 'Activo' : 'Baja'}
                      </span>
                    </td>

                    {/* Inicio */}
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(t.fecha_alta)}
                    </td>

                    {/* Fin */}
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(t.fecha_baja)}
                    </td>

                    {/* Acciones */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {/* Editar */}
                        <Link
                          to={`/usuarios/tramitador/${t.tramitador_id ?? t.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                          title="Editar"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M11 2.5l2.5 2.5-7.5 7.5H3.5v-2.5L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                          </svg>
                        </Link>
                        {/* Dar de baja / Reactivar */}
                        <button
                          className={`btn ${t.activo ? 'btn-danger' : 'btn-secondary'}`}
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                          title={t.activo ? 'Dar de baja' : 'Reactivar'}
                          onClick={() => t.activo
                            ? setConfirmDelete({ id: t.tramitador_id ?? t.id, nombre: `${t.nombre} ${t.apellidos}` })
                            : handleToggle(t.tramitador_id ?? t.id, true)
                          }
                          disabled={toggleTramitador.isPending}
                        >
                          {t.activo ? (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <polyline points="3,3 13,13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                              <polyline points="13,3 3,13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M5.5 8.5l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Nuevo usuario ── */}
      {showModal && (
        <div className="modal-overlay-v2" onClick={() => setShowModal(false)}>
          <div className="modal-v2 modal-v2--lg" onClick={(e) => e.stopPropagation()}>

            <div className="modal-v2__header">
              <div>
                <div className="modal-v2__title">Nuevo usuario / tramitador</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  Se enviará un email de invitación para que el usuario establezca su contraseña.
                </div>
              </div>
              <button className="modal-v2__close" onClick={() => setShowModal(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={handleCrear}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                {formError && <div className="alert alert-error">{formError}</div>}

                {/* Datos personales */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">
                    <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Datos personales
                  </div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Nombre</label>
                      <input className="form-control" value={form.nombre} required autoFocus
                        placeholder="Ej. María"
                        onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label required">Apellidos</label>
                      <input className="form-control" value={form.apellidos} required
                        placeholder="Ej. García López"
                        onChange={(e) => setForm(p => ({ ...p, apellidos: e.target.value }))} />
                    </div>
                    <div className="form-group-v2 span-full">
                      <label className="form-label required">Email corporativo</label>
                      <input className="form-control" type="email" value={form.email} required
                        placeholder="nombre.apellido@grupocuid.com"
                        onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                      <div className="form-hint">Se usará como credencial de acceso al ERP.</div>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" value={form.telefono}
                        placeholder="Ej. 600 000 000"
                        onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Rol y capacidad */}
                <div className="form-section-v2">
                  <div className="form-section-v2__title">
                    <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Rol y capacidad operativa
                  </div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Rol</label>
                      <select className="form-control" value={form.nivel}
                        onChange={(e) => setForm(p => ({ ...p, nivel: e.target.value }))}>
                        <option value="tramitador">Tramitador</option>
                        <option value="facturacion">Facturación</option>
                        <option value="redes">Redes</option>
                        <option value="administrador">Administrador</option>
                        <option value="super_administrador">Super Administrador</option>
                      </select>
                      <div className="form-hint">Define los permisos de acceso dentro del ERP.</div>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Máx. expedientes activos</label>
                      <input className="form-control" type="number" min={1} max={500}
                        value={form.max_expedientes_activos}
                        onChange={(e) => setForm(p => ({ ...p, max_expedientes_activos: parseInt(e.target.value) || 30 }))} />
                      <div className="form-hint">Límite de carga simultánea.</div>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Máx. urgentes simultáneos</label>
                      <input className="form-control" type="number" min={1} max={50}
                        value={form.max_urgentes}
                        onChange={(e) => setForm(p => ({ ...p, max_urgentes: parseInt(e.target.value) || 5 }))} />
                      <div className="form-hint">Expedientes de prioridad alta.</div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={crearTramitador.isPending}>
                  {crearTramitador.isPending ? 'Creando cuenta...' : 'Crear y enviar invitación'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── Modal: Confirmar baja ── */}
      {confirmDelete && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDelete(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Dar de baja</div>
              <button className="modal-v2__close" onClick={() => setConfirmDelete(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Confirmas la baja de <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDelete.nombre}</strong>?
                El usuario perderá acceso al ERP. Los expedientes asignados se mantendrán.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className="btn btn-danger"
                disabled={toggleTramitador.isPending}
                onClick={async () => {
                  await handleToggle(confirmDelete.id, false);
                  setConfirmDelete(null);
                }}
              >
                {toggleTramitador.isPending ? 'Procesando...' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
