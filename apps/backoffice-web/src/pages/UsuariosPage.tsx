import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import {
  useTramitadores,
  useCrearTramitador,
  useActualizarTramitador,
  useToggleTramitador,
  useToggleAusente,
  useDesconectarUsuario,
  useTramitadorActividad,
} from '@/hooks/useTramitadores';

// ─── Constantes ──────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  tramitador:          'Tramitador',
  gestion:             'Gestión',
  tecnico:             'Técnico',
  administracion:      'Administración',
  super_administracion:'Super Administración',
  redes:               'Redes',
  facturacion:         'Facturación',
  perito:              'Perito',
  operario:            'Operario',
  suboperario:         'Suboperario',
};

const TIPO_LABELS: Record<string, string> = {
  tramitador: 'Tramitación',
  operario:   'Operario',
};

const JORNADA_LABELS: Record<string, string> = {
  completa:      'Completa',
  media_jornada: 'Media Jornada',
  partida:       'Partida',
};

const SEMAFORO_COLORS: Record<string, string> = {
  verde:    '#22c55e',
  amarillo: '#f59e0b',
  rojo:     '#ef4444',
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Tipos ───────────────────────────────────────────────────

type EditTab = 'datos' | 'acceso' | 'permisos' | 'centralita' | 'carga' | 'registro' | 'reasignacion';

// ─── Componente principal ────────────────────────────────────

export function UsuariosPage() {
  const { data: res, isLoading, refetch } = useTramitadores();
  const crearTramitador    = useCrearTramitador();
  const actualizarTramitador = useActualizarTramitador();
  const toggleTramitador   = useToggleTramitador();
  const toggleAusente      = useToggleAusente();
  const desconectar        = useDesconectarUsuario();

  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'bajas'>('activos');
  const [busqueda, setBusqueda]         = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmDesconectar, setConfirmDesconectar] = useState<{ id: string; nombre: string } | null>(null);

  // Formulario de creación
  const [form, setForm] = useState({
    nombre: '', apellido1: '', apellido2: '', email: '',
    telefono: '', nivel: 'tramitador', tipo_usuario: 'tramitador',
    max_expedientes_activos: 30, max_urgentes: 5,
  });
  const [formError, setFormError] = useState('');

  // Modal de edición (7 tabs)
  const [editUser, setEditUser]   = useState<any>(null);
  const [editTab, setEditTab]     = useState<EditTab>('datos');
  const [editForm, setEditForm]   = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const tramitadores: any[] = res?.data ?? [];

  const filtered = tramitadores
    .filter((t) => {
      if (filtroActivo === 'activos') return t.activo;
      if (filtroActivo === 'bajas')   return !t.activo;
      return true;
    })
    .filter((t) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        (t.nombre_completo ?? '').toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q) ||
        (t.nivel ?? '').toLowerCase().includes(q)
      );
    });

  // ─── Handlers ─────────────────────────────────────────────

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      await crearTramitador.mutateAsync(form);
      setShowModal(false);
      setForm({ nombre: '', apellido1: '', apellido2: '', email: '', telefono: '', nivel: 'tramitador', tipo_usuario: 'tramitador', max_expedientes_activos: 30, max_urgentes: 5 });
      refetch();
    } catch (err: any) {
      setFormError(err.message ?? 'Error al crear usuario');
    }
  }

  async function handleToggle(id: string, activar: boolean) {
    await toggleTramitador.mutateAsync({ id, activar });
    refetch();
  }

  async function handleAusente(id: string, ausente: boolean) {
    await toggleAusente.mutateAsync({ id, ausente });
  }

  async function handleDesconectar(id: string) {
    await desconectar.mutateAsync(id);
    setConfirmDesconectar(null);
    refetch();
  }

  function openEdit(t: any) {
    setEditUser(t);
    setEditForm({
      nombre:               t.nombre ?? '',
      apellido1:            t.apellido1 ?? t.apellidos ?? '',
      apellido2:            t.apellido2 ?? '',
      nif:                  t.nif ?? '',
      telefono:             t.telefono ?? '',
      contrato_horas_dia:   t.contrato_horas_dia ?? 8,
      jornada_laboral:      t.jornada_laboral ?? 'completa',
      horario_texto:        t.horario_texto ?? '',
      notas_usuario:        t.notas_usuario ?? '',
      nivel:                t.nivel ?? 'tramitador',
      tipo_usuario:         t.tipo_usuario ?? 'tramitador',
      extension:            t.extension ?? '',
      max_expedientes_activos: t.max_expedientes_activos ?? 30,
      pct_carga_trabajo:    t.pct_carga_trabajo ?? 100,
      jornada_pct:          t.jornada_pct ?? 100,
    });
    setEditTab('datos');
    setEditError('');
  }

  async function handleGuardar() {
    if (!editUser) return;
    setEditSaving(true);
    setEditError('');
    try {
      await actualizarTramitador.mutateAsync({ id: editUser.tramitador_id ?? editUser.id, ...editForm });
      setEditUser(null);
      refetch();
    } catch (err: any) {
      setEditError(err.message ?? 'Error al guardar');
    } finally {
      setEditSaving(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="page-usuarios">

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Usuarios</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Gestión de accesos, roles y capacidad operativa
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/usuarios/cargas"   className="btn btn-secondary">Panel de cargas</Link>
          <Link to="/usuarios/cola"     className="btn btn-secondary">Cola de asignación</Link>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo usuario</button>
        </div>
      </div>

      {/* Filtros + búsqueda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {(['activos', 'todos', 'bajas'] as const).map((f) => (
          <button key={f}
            className={`btn ${filtroActivo === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltroActivo(f)}
          >
            {f === 'activos' ? 'Activos' : f === 'bajas' ? 'Bajas' : 'Todos'}
          </button>
        ))}
        <input
          className="form-control"
          style={{ maxWidth: 240, marginLeft: 8 }}
          placeholder="Buscar por nombre, email o rol..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>ROL</th>
                <th>Tipo</th>
                <th>Carga</th>
                <th style={{ textAlign: 'center' }}>Ausente</th>
                <th style={{ textAlign: 'center' }}>Desconectar</th>
                <th>Inicio Sesión</th>
                <th>Fin Sesión</th>
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
                const totalActivos = t.total_activos ?? 0;
                const maxActivos   = t.max_expedientes_activos ?? 30;
                const cerradosHoy  = t.cerrados_hoy ?? 0;
                const ratio = totalActivos > 0 ? (cerradosHoy / totalActivos).toFixed(2) : '—';
                const isSesionActiva = t.sesion_activa === true;

                return (
                  <tr key={t.tramitador_id ?? t.id} style={{ opacity: t.activo ? 1 : 0.55 }}>

                    {/* Nombre */}
                    <td>
                      <Link
                        to={`/usuarios/tramitador/${t.tramitador_id ?? t.id}`}
                        style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}
                      >
                        {t.nombre_completo ?? `${t.nombre} ${t.apellidos}`}
                      </Link>
                    </td>

                    {/* Usuario (email) */}
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {t.email ?? '—'}
                    </td>

                    {/* ROL */}
                    <td>
                      <span className="badge badge-default" style={{ fontSize: 11 }}>
                        {ROL_LABELS[t.nivel] ?? t.nivel ?? '—'}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {TIPO_LABELS[t.tipo_usuario] ?? 'Tramitación'}
                      </span>
                    </td>

                    {/* Carga */}
                    <td>
                      <div style={{ minWidth: 200 }}>
                        {/* Barra de carga */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--color-border-default)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(t.porcentaje_carga ?? 0, 100)}%`,
                              background: SEMAFORO_COLORS[t.semaforo ?? 'verde'],
                              borderRadius: 3,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: SEMAFORO_COLORS[t.semaforo ?? 'verde'], minWidth: 30 }}>
                            {t.porcentaje_carga ?? 0}%
                          </span>
                        </div>
                        {/* Mini grid */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 2, background: 'var(--color-bg-subtle)', borderRadius: 6,
                          padding: '4px 6px',
                        }}>
                          {[
                            ['Activos', `${totalActivos} (${maxActivos})`],
                            ['Jornada', `${t.jornada_pct ?? 100}%`],
                            ['Carga', `${t.pct_carga_trabajo ?? 100}%`],
                            ['Ratio', ratio],
                          ].map(([label, value]) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
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

                    {/* Desconectar */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title={isSesionActiva ? 'Forzar cierre de sesión' : 'Sin sesión activa'}
                        disabled={!isSesionActiva || desconectar.isPending}
                        onClick={() => setConfirmDesconectar({
                          id: t.tramitador_id ?? t.id,
                          nombre: t.nombre_completo ?? `${t.nombre} ${t.apellidos}`,
                        })}
                        style={{
                          background: isSesionActiva ? '#f97316' : 'var(--color-bg-muted)',
                          border: 'none', borderRadius: 6, cursor: isSesionActiva ? 'pointer' : 'not-allowed',
                          padding: '4px 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          opacity: isSesionActiva ? 1 : 0.4, color: isSesionActiva ? '#fff' : 'var(--color-text-tertiary)',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 2.5A6 6 0 1 0 10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="8" y1="1" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </td>

                    {/* Inicio Sesión */}
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(t.ultima_sesion_inicio ?? t.fecha_alta)}
                    </td>

                    {/* Fin Sesión */}
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {isSesionActiva ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: '#dcfce7', color: '#16a34a',
                          borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          En sesión
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDateTime(t.ultima_sesion_fin ?? t.fecha_baja)}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                          title="Editar usuario"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className={`btn ${t.activo ? 'btn-danger' : 'btn-secondary'}`}
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                          title={t.activo ? 'Dar de baja' : 'Reactivar'}
                          disabled={toggleTramitador.isPending}
                          onClick={() => t.activo
                            ? setConfirmDelete({ id: t.tramitador_id ?? t.id, nombre: t.nombre_completo ?? `${t.nombre} ${t.apellidos}` })
                            : handleToggle(t.tramitador_id ?? t.id, true)
                          }
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
                <div className="modal-v2__title">Nuevo usuario</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  Se enviará un email de invitación para que el usuario establezca su contraseña.
                </div>
              </div>
              <button className="modal-v2__close" onClick={() => setShowModal(false)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={handleCrear}>
              <div className="modal-v2__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="form-section-v2">
                  <div className="form-section-v2__title">Datos personales</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Nombre *</label>
                      <input className="form-control" value={form.nombre} required autoFocus
                        placeholder="Nombre" onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label required">Primer apellido *</label>
                      <input className="form-control" value={form.apellido1} required
                        placeholder="Primer apellido" onChange={(e) => setForm(p => ({ ...p, apellido1: e.target.value }))} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Segundo apellido</label>
                      <input className="form-control" value={form.apellido2}
                        placeholder="Segundo apellido" onChange={(e) => setForm(p => ({ ...p, apellido2: e.target.value }))} />
                    </div>
                    <div className="form-group-v2 span-full">
                      <label className="form-label required">Email corporativo *</label>
                      <input className="form-control" type="email" value={form.email} required
                        placeholder="nombre.apellido@empresa.com"
                        onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                      <div className="form-hint">Será la credencial de acceso al ERP.</div>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" value={form.telefono}
                        placeholder="600 000 000" onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="form-section-v2">
                  <div className="form-section-v2__title">Permisos y capacidad</div>
                  <div className="form-grid-v2">
                    <div className="form-group-v2">
                      <label className="form-label required">Tipo *</label>
                      <select className="form-control" value={form.tipo_usuario}
                        onChange={(e) => setForm(p => ({ ...p, tipo_usuario: e.target.value }))}>
                        <option value="tramitador">Tramitador</option>
                        <option value="operario">Operario</option>
                      </select>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label required">ROL *</label>
                      <select className="form-control" value={form.nivel}
                        onChange={(e) => setForm(p => ({ ...p, nivel: e.target.value }))}>
                        {Object.entries(ROL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Máx. expedientes activos</label>
                      <input className="form-control" type="number" min={1} max={500}
                        value={form.max_expedientes_activos}
                        onChange={(e) => setForm(p => ({ ...p, max_expedientes_activos: parseInt(e.target.value) || 30 }))} />
                    </div>
                    <div className="form-group-v2">
                      <label className="form-label">Máx. urgentes</label>
                      <input className="form-control" type="number" min={1} max={50}
                        value={form.max_urgentes}
                        onChange={(e) => setForm(p => ({ ...p, max_urgentes: parseInt(e.target.value) || 5 }))} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-v2__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={crearTramitador.isPending}>
                  {crearTramitador.isPending ? 'Creando...' : 'Crear y enviar invitación'}
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
                El usuario perderá acceso. Los expedientes asignados se mantendrán.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className="btn btn-danger" disabled={toggleTramitador.isPending}
                onClick={async () => { await handleToggle(confirmDelete.id, false); setConfirmDelete(null); }}
              >
                {toggleTramitador.isPending ? 'Procesando...' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar desconexión ── */}
      {confirmDesconectar && (
        <div className="modal-overlay-v2" onClick={() => setConfirmDesconectar(null)}>
          <div className="modal-v2 modal-v2--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v2__header">
              <div className="modal-v2__title">Forzar cierre de sesión</div>
              <button className="modal-v2__close" onClick={() => setConfirmDesconectar(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="modal-v2__body">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                ¿Cerrar la sesión activa de <strong style={{ color: 'var(--color-text-primary)' }}>{confirmDesconectar.nombre}</strong>?
                El usuario deberá volver a autenticarse.
              </p>
            </div>
            <div className="modal-v2__footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDesconectar(null)}>Cancelar</button>
              <button
                style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
                disabled={desconectar.isPending}
                onClick={() => handleDesconectar(confirmDesconectar.id)}
              >
                {desconectar.isPending ? 'Procesando...' : 'Forzar desconexión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar usuario (7 tabs) ── */}
      {editUser && (
        <ModalEditar
          user={editUser}
          form={editForm}
          setForm={setEditForm}
          tab={editTab}
          setTab={setEditTab}
          saving={editSaving}
          error={editError}
          onGuardar={handleGuardar}
          onClose={() => setEditUser(null)}
        />
      )}

    </div>
  );
}

// ─── Modal Editar (extraído para claridad) ──────────────────

function ModalEditar({
  user, form, setForm, tab, setTab,
  saving, error, onGuardar, onClose,
}: {
  user: any;
  form: Record<string, any>;
  setForm: (fn: (p: Record<string, any>) => Record<string, any>) => void;
  tab: EditTab;
  setTab: (t: EditTab) => void;
  saving: boolean;
  error: string;
  onGuardar: () => void;
  onClose: () => void;
}) {
  const TABS: [EditTab, string][] = [
    ['datos',        'Datos'],
    ['acceso',       'Acceso'],
    ['permisos',     'Permisos'],
    ['centralita',   'Centralita'],
    ['carga',        'Carga'],
    ['registro',     'Registro'],
    ['reasignacion', 'Reasignación'],
  ];

  // Log de actividad (lazy: solo carga cuando la pestaña está activa)
  const actividadQuery = useTramitadorActividad(
    user.tramitador_id ?? user.id,
    1,
    tab === 'registro',
  );

  const f = (key: string) => form[key] ?? '';
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));
  const setVal = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="modal-overlay-v2" onClick={onClose}>
      <div
        className="modal-v2 modal-v2--lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: '95vw' }}
      >
        {/* Header */}
        <div className="modal-v2__header">
          <div>
            <div className="modal-v2__title">
              {form.nombre} {form.apellido1} {form.apellido2}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{user.email}</div>
          </div>
          <button className="modal-v2__close" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', padding: '0 24px', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', marginBottom: -1,
              borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-v2__body" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* ── DATOS ── */}
          {tab === 'datos' && (
            <div className="form-grid-v2">
              <div className="form-group-v2">
                <label className="form-label required">Nombre *</label>
                <input className="form-control" value={f('nombre')} onChange={set('nombre')} placeholder="Nombre" />
              </div>
              <div className="form-group-v2">
                <label className="form-label required">Primer apellido *</label>
                <input className="form-control" value={f('apellido1')} onChange={set('apellido1')} placeholder="Primer apellido" />
              </div>
              <div className="form-group-v2">
                <label className="form-label">Segundo apellido</label>
                <input className="form-control" value={f('apellido2')} onChange={set('apellido2')} placeholder="Segundo apellido" />
              </div>
              <div className="form-group-v2">
                <label className="form-label">NIF</label>
                <input className="form-control" value={f('nif')} onChange={set('nif')} placeholder="12345678A" />
              </div>
              <div className="form-group-v2">
                <label className="form-label">Teléfono</label>
                <input className="form-control" value={f('telefono')} onChange={set('telefono')} placeholder="600 000 000" />
              </div>
              <div className="form-group-v2">
                <label className="form-label">Contrato (horas/día)</label>
                <input className="form-control" type="number" min={0} max={24} step={0.5}
                  value={f('contrato_horas_dia')} onChange={set('contrato_horas_dia')} placeholder="8" />
              </div>
              <div className="form-group-v2">
                <label className="form-label">Jornada laboral</label>
                <select className="form-control" value={f('jornada_laboral')} onChange={set('jornada_laboral')}>
                  {Object.entries(JORNADA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group-v2">
                <label className="form-label">Horario laboral</label>
                <input className="form-control" value={f('horario_texto')} onChange={set('horario_texto')}
                  placeholder="De 09:00 a 14:00 y de 16:00 a 19:00" />
              </div>
              <div className="form-group-v2 span-full">
                <label className="form-label">Notas</label>
                <textarea className="form-control" rows={3} value={f('notas_usuario')}
                  onChange={(e) => setVal('notas_usuario', e.target.value)}
                  placeholder="Observaciones internas sobre el usuario..." />
              </div>
            </div>
          )}

          {/* ── ACCESO ── */}
          {tab === 'acceso' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group-v2">
                <label className="form-label">Email de acceso (usuario)</label>
                <input className="form-control" value={user.email ?? ''} readOnly
                  style={{ background: 'var(--color-bg-muted)' }} />
                <div className="form-hint">El email de acceso no puede modificarse desde aquí.</div>
              </div>
              <div className="form-group-v2">
                <label className="form-label">Nueva contraseña</label>
                <input className="form-control" type="password"
                  placeholder="Dejar en blanco para no cambiar" autoComplete="new-password" />
              </div>
              <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                El cambio de contraseña se realiza desde <strong>Perfil de usuario → Cambio de contraseña</strong> o mediante el flujo de restablecimiento por email.
              </div>
            </div>
          )}

          {/* ── PERMISOS ── */}
          {tab === 'permisos' && (
            <div className="form-grid-v2">
              <div className="form-group-v2">
                <label className="form-label required">Tipo de usuario *</label>
                <select className="form-control" value={f('tipo_usuario')} onChange={set('tipo_usuario')}>
                  <option value="tramitador">Tramitador</option>
                  <option value="operario">Operario</option>
                </select>
                <div className="form-hint">
                  Solo los usuarios con tipo <strong>Operario</strong> pueden acceder a la app móvil de operario.
                </div>
              </div>
              <div className="form-group-v2">
                <label className="form-label required">ROL *</label>
                <select className="form-control" value={f('nivel')} onChange={set('nivel')}>
                  {Object.entries(ROL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="form-hint">Define los permisos de acceso en el ERP.</div>
              </div>
              <div className="form-group-v2 span-full" style={{ background: 'var(--color-bg-subtle)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <strong>Roles disponibles:</strong> Tramitador, Gestión, Técnico, Administración, Super Administración, Redes, Facturación, Perito, Operario, Suboperario.
              </div>
            </div>
          )}

          {/* ── CENTRALITA ── */}
          {tab === 'centralita' && (
            <div className="form-grid-v2">
              <div className="form-group-v2">
                <label className="form-label">Extensión</label>
                <input className="form-control" value={f('extension')} onChange={set('extension')}
                  placeholder="Ej. 101" />
                <div className="form-hint">Extensión de la centralita telefónica.</div>
              </div>
              <div className="form-group-v2">
                <label className="form-label">Número de teléfono directo</label>
                <input className="form-control" value={f('telefono')} onChange={set('telefono')}
                  placeholder="Ej. 900 000 000" />
              </div>
              <div className="form-group-v2 span-full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 15, height: 15 }} />
                  <span className="form-label" style={{ margin: 0 }}>Usar softphone (Bria / WebRTC)</span>
                </label>
              </div>
              <div className="form-group-v2 span-full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" style={{ minWidth: 140 }}
                  onClick={async () => {
                    // Guardar solo los campos de centralita
                  }}>
                  Guardar centralita
                </button>
              </div>
            </div>
          )}

          {/* ── CARGA ── */}
          {tab === 'carga' && (
            <div className="form-grid-v2">
              <div className="form-group-v2">
                <label className="form-label">Carga máxima (expedientes activos)</label>
                <input className="form-control" type="number" min={1} max={500}
                  value={f('max_expedientes_activos')} onChange={set('max_expedientes_activos')} />
                <div className="form-hint">Número máximo de expedientes simultáneos.</div>
              </div>
              <div className="form-group-v2">
                <label className="form-label">% Carga de trabajo</label>
                <input className="form-control" type="number" min={0} max={200} step={5}
                  value={f('pct_carga_trabajo')} onChange={set('pct_carga_trabajo')} />
                <div className="form-hint">Porcentaje de capacidad asignada (100 = plena).</div>
              </div>
              <div className="form-group-v2">
                <label className="form-label">% Jornada activa</label>
                <input className="form-control" type="number" min={0} max={100} step={5}
                  value={f('jornada_pct')} onChange={set('jornada_pct')} />
                <div className="form-hint">Porcentaje de jornada efectivamente activa.</div>
              </div>
              <div className="form-group-v2">
                <label className="form-label">Ratio activos (calculado)</label>
                <input className="form-control" value={
                  (user.cerrados_hoy ?? 0) > 0 && (user.total_activos ?? 0) > 0
                    ? ((user.cerrados_hoy ?? 0) / (user.total_activos ?? 1)).toFixed(2)
                    : '—'
                } readOnly style={{ background: 'var(--color-bg-muted)' }} />
                <div className="form-hint">Expedientes cerrados hoy / expedientes activos (calculado automáticamente).</div>
              </div>
              {/* Info actual */}
              <div className="form-group-v2 span-full">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    ['Activos hoy', user.total_activos ?? 0],
                    ['Máx. activos', user.max_expedientes_activos ?? 30],
                    ['Jornada', `${user.jornada_pct ?? 100}%`],
                    ['Semáforo', user.semaforo ?? 'verde'],
                  ].map(([k, v]) => (
                    <div key={String(k)} style={{ background: 'var(--color-bg-subtle)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{k}</div>
                      <div style={{
                        fontSize: 16, fontWeight: 700,
                        color: k === 'Semáforo' ? SEMAFORO_COLORS[String(v)] : 'var(--color-text-primary)',
                      }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── REGISTRO ── */}
          {tab === 'registro' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                Registro de actividad del usuario en el ERP.
              </p>
              {actividadQuery.isLoading ? (
                <div className="loading" style={{ padding: '24px 0' }}>Cargando registro...</div>
              ) : (actividadQuery.data?.data?.items ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px 0', fontSize: 13 }}>
                  Sin actividad registrada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {(actividadQuery.data?.data?.items ?? []).map((log: any) => (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '8px 0', borderBottom: '1px solid var(--color-border-default)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', minWidth: 130, flexShrink: 0 }}>
                        {new Date(log.created_at).toLocaleString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{log.descripcion}</span>
                        {log.expediente_numero && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                            Exp. {log.expediente_numero}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── REASIGNACIÓN ── */}
          {tab === 'reasignacion' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Reasigna los expedientes activos de este usuario a otro tramitador.
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group-v2" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label">Tramitador destino</label>
                  <select className="form-control">
                    <option value="">Seleccionar tramitador...</option>
                  </select>
                </div>
                <button className="btn btn-secondary">Reasignar expedientes</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 12 }}>
                Para reasignaciones masivas utiliza la vista de{' '}
                <Link to="/usuarios/reasignacion-masiva" style={{ color: 'var(--color-primary)' }}>
                  Reasignación masiva
                </Link>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-v2__footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          {tab !== 'registro' && tab !== 'reasignacion' && tab !== 'acceso' && (
            <button className="btn btn-primary" onClick={onGuardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
