import { useState, useMemo } from 'react';
import {
  useAllCompanias,
  useCreateCompania,
  useUpdateCompania,
  useCompaniaTramitadores,
  useAllTramitadores,
  useAddCompaniaTramitador,
  useRemoveCompaniaTramitador,
  useCompaniaEspecialidades,
  useAddCompaniaEspecialidad,
  useUpdateCompaniaEspecialidad,
  useRemoveCompaniaEspecialidad,
  useCompaniaTiposSiniestro,
  useAddCompaniaTipoSiniestro,
  useRemoveCompaniaTipoSiniestro,
  useTiposSiniestro,
} from '@/hooks/useMasters';
import { useBaremos } from '@/hooks/useBaremos';
import { useEspecialidades } from '@/hooks/useEspecialidades';
import type { Compania, CompaniaTipo, CompaniaSistema, CompaniaEspecialidad } from '@erp/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS: { value: CompaniaTipo; label: string }[] = [
  { value: 'compania',              label: 'Compañía aseguradora' },
  { value: 'correduria',            label: 'Correduría de seguros' },
  { value: 'administrador_fincas',  label: 'Administrador de fincas' },
];

const SISTEMAS: { value: CompaniaSistema; label: string }[] = [
  { value: 'ADMINISTRADOR_FINCA',  label: 'Administrador Finca' },
  { value: 'ASITUR',               label: 'ASITUR' },
  { value: 'FAMAEX',               label: 'FAMAEX' },
  { value: 'FUNCIONA',             label: 'FUNCIONA' },
  { value: 'GENERALI',             label: 'GENERALI' },
  { value: 'IMA',                  label: 'IMA' },
  { value: 'RNET_EMAIL',           label: 'RNET-EMAIL' },
  { value: 'LAGUNARO',             label: 'LAGUNARO' },
  { value: 'LDWEB',                label: 'LDWEB' },
  { value: 'MULTIASISTENCIA_WS',   label: 'MULTIASISTENCIA WS' },
  { value: 'MUTUA',                label: 'MUTUA' },
  { value: 'NINGUNO',              label: 'Ninguno' },
  { value: 'PAP',                  label: 'P.A.P.' },
  { value: 'PELAYO',               label: 'PELAYO' },
  { value: 'SICI',                 label: 'SICI' },
  { value: 'VERYFICA',             label: 'VERYFICA' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'especialidades' | 'baremos' | 'tramitadores' | 'tipos-siniestro' | 'plantillas';
type ExpandedRow = { companiaId: string; section: Section };

interface CompaniaConfig {
  [key: string]: unknown;
  domicilio: string;
  cp: string;
  poblacion: string;
  provincia: string;
  telefono: string;
  fax: string;
  email: string;
  prefijo: string;
  fact_por_partidas: boolean;
  albaranes: boolean;
  notificar_sms: boolean;
  auto_numerico: boolean;
  asignar_corredor: boolean;
}

interface CompaniaForm {
  nombre: string;
  codigo: string;
  cif: string;
  activa: boolean;
  tipo: CompaniaTipo;
  sistema_integracion: CompaniaSistema | '';
  config: CompaniaConfig;
}

const CONFIG_DEFAULT: CompaniaConfig = {
  domicilio: '', cp: '', poblacion: '', provincia: '',
  telefono: '', fax: '', email: '', prefijo: '',
  fact_por_partidas: false, albaranes: false, notificar_sms: false,
  auto_numerico: false, asignar_corredor: false,
};

const FORM_DEFAULT: CompaniaForm = {
  nombre: '', codigo: '', cif: '', activa: true,
  tipo: 'compania', sistema_integracion: '',
  config: { ...CONFIG_DEFAULT },
};

function companiaToForm(c: Compania): CompaniaForm {
  const cfg = (c.config ?? {}) as Record<string, unknown>;
  return {
    nombre:              c.nombre,
    codigo:              c.codigo,
    cif:                 c.cif ?? '',
    activa:              c.activa,
    tipo:                c.tipo ?? 'compania',
    sistema_integracion: (c.sistema_integracion ?? '') as CompaniaSistema | '',
    config: {
      domicilio:         String(cfg.domicilio ?? ''),
      cp:                String(cfg.cp ?? ''),
      poblacion:         String(cfg.poblacion ?? ''),
      provincia:         String(cfg.provincia ?? ''),
      telefono:          String(cfg.telefono ?? ''),
      fax:               String(cfg.fax ?? ''),
      email:             String(cfg.email ?? ''),
      prefijo:           String(cfg.prefijo ?? ''),
      fact_por_partidas: Boolean(cfg.fact_por_partidas),
      albaranes:         Boolean(cfg.albaranes),
      notificar_sms:     Boolean(cfg.notificar_sms),
      auto_numerico:     Boolean(cfg.auto_numerico),
      asignar_corredor:  Boolean(cfg.asignar_corredor),
    },
  };
}

// ─── EspecialidadesPanel ──────────────────────────────────────────────────────

function EspecialidadesPanel({ companiaId }: { companiaId: string }) {
  const { data: asignadasRes, isLoading } = useCompaniaEspecialidades(companiaId);
  const { data: todasRes }                = useEspecialidades(true);
  const addMut    = useAddCompaniaEspecialidad();
  const updateMut = useUpdateCompaniaEspecialidad();
  const removeMut = useRemoveCompaniaEspecialidad();

  const [selectedEspId, setSelectedEspId] = useState('');
  const [editing, setEditing] = useState<{ espId: string; dias: number; diasC: number } | null>(null);

  const asignadas: CompaniaEspecialidad[] = (asignadasRes as any)?.data ?? [];
  const todas: any[]                      = (todasRes as any)?.data ?? [];
  const asignadasIds = new Set(asignadas.map(e => e.especialidad_id));
  const disponibles  = todas.filter(e => !asignadasIds.has(e.id));

  const handleAdd = () => {
    if (!selectedEspId) return;
    addMut.mutate(
      { companiaId, especialidadId: selectedEspId },
      { onSuccess: () => setSelectedEspId('') },
    );
  };

  const startEdit = (row: CompaniaEspecialidad) => {
    setEditing({ espId: row.id, dias: row.dias_caducidad, diasC: row.dias_caducidad_confirmar });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateMut.mutate(
      { companiaId, espId: editing.espId, diasCaducidad: editing.dias, diasCaducidadConfirmar: editing.diasC },
      { onSuccess: () => setEditing(null) },
    );
  };

  if (isLoading) return <div className="cpanel__loading">Cargando especialidades…</div>;

  return (
    <div>
      {/* Añadir especialidad */}
      <div className="cpanel__add-row">
        <select
          className="form-control cpanel__select"
          value={selectedEspId}
          onChange={e => setSelectedEspId(e.target.value)}
        >
          <option value="">Seleccione especialidad…</option>
          {disponibles.map((e: any) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
        <button
          className="btn-primary btn--sm"
          onClick={handleAdd}
          disabled={!selectedEspId || addMut.isPending}
        >
          Añadir especialidad
        </button>
      </div>

      {asignadas.length === 0 ? (
        <div className="cpanel__empty">No hay especialidades asignadas a esta compañía.</div>
      ) : (
        <table className="data-table cpanel__table">
          <thead>
            <tr>
              <th>Especialidad</th>
              <th style={{ width: 140 }}>Días caducidad</th>
              <th style={{ width: 160 }}>Días cad. confirmar</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {asignadas.map(row => {
              const isEditing = editing?.espId === row.id;
              const nombre = (row as any).especialidades?.nombre ?? row.especialidad_id;
              return (
                <tr key={row.id}>
                  <td><strong>{nombre}</strong></td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number" min={0} className="form-control"
                        style={{ width: 80 }}
                        value={editing.dias}
                        onChange={e => setEditing(prev => prev ? { ...prev, dias: Number(e.target.value) } : prev)}
                      />
                    ) : (
                      row.dias_caducidad
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number" min={0} className="form-control"
                        style={{ width: 80 }}
                        value={editing.diasC}
                        onChange={e => setEditing(prev => prev ? { ...prev, diasC: Number(e.target.value) } : prev)}
                      />
                    ) : (
                      row.dias_caducidad_confirmar
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {isEditing ? (
                      <>
                        <button
                          className="btn-primary btn--sm"
                          onClick={saveEdit}
                          disabled={updateMut.isPending}
                        >
                          Guardar
                        </button>
                        <button className="btn-secondary btn--sm" onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-secondary btn--sm" onClick={() => startEdit(row)}>
                          Editar
                        </button>
                        <button
                          className="btn-link"
                          style={{ color: 'var(--red-600)', fontSize: 'var(--text-sm)' }}
                          onClick={() => removeMut.mutate({ companiaId, espId: row.id })}
                          disabled={removeMut.isPending}
                        >
                          Quitar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── BaremosPanel ─────────────────────────────────────────────────────────────

function BaremosPanel({ companiaId }: { companiaId: string }) {
  const { data: res, isLoading } = useBaremos({ compania_id: companiaId });
  const baremos: any[] = (res as any)?.data ?? [];

  if (isLoading) return <div className="cpanel__loading">Cargando baremos…</div>;
  if (baremos.length === 0) {
    return (
      <div className="cpanel__empty">
        No hay baremos para esta compañía.{' '}
        <a href="/baremos">Gestionar baremos →</a>
      </div>
    );
  }

  return (
    <table className="data-table cpanel__table">
      <thead>
        <tr>
          <th>Baremo</th>
          <th>Tipo</th>
          <th>Vigente desde</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {baremos.map((b: any) => (
          <tr key={b.id}>
            <td><strong>{b.nombre}</strong></td>
            <td style={{ textTransform: 'capitalize' }}>{b.tipo}</td>
            <td>
              {b.vigente_desde
                ? new Date(b.vigente_desde).toLocaleDateString('es-ES')
                : '—'}
            </td>
            <td>
              <span className={`badge ${b.activo ? 'badge--success' : 'badge--neutral'}`}>
                {b.activo ? 'Activo' : 'Inactivo'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── TramitadoresPanel ────────────────────────────────────────────────────────

function TramitadoresPanel({ companiaId }: { companiaId: string }) {
  const { data: asignadosRes, isLoading } = useCompaniaTramitadores(companiaId);
  const { data: todosRes }                = useAllTramitadores();
  const addMut    = useAddCompaniaTramitador();
  const removeMut = useRemoveCompaniaTramitador();
  const [selectedId, setSelectedId] = useState('');

  const asignados: any[] = (asignadosRes as any)?.data ?? [];
  const todos: any[]     = (todosRes as any)?.data ?? [];
  const asignadosIds     = new Set(asignados.map((t: any) => t.id));
  const disponibles      = todos.filter((t: any) => !asignadosIds.has(t.id));

  const handleAdd = () => {
    if (!selectedId) return;
    addMut.mutate(
      { companiaId, tramitadorId: selectedId },
      { onSuccess: () => setSelectedId('') },
    );
  };

  const handleRemove = (tramitadorId: string) => {
    removeMut.mutate({ companiaId, tramitadorId });
  };

  if (isLoading) return <div className="cpanel__loading">Cargando tramitadores…</div>;

  return (
    <div>
      <div className="cpanel__add-row">
        <select
          className="form-control cpanel__select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">Seleccione tramitador</option>
          {disponibles.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.nombre_completo ?? `${t.nombre ?? ''} ${t.apellidos ?? ''}`.trim()}
            </option>
          ))}
        </select>
        <button
          className="btn-primary btn--sm"
          onClick={handleAdd}
          disabled={!selectedId || addMut.isPending}
        >
          Añadir Tramitador
        </button>
      </div>

      {asignados.length === 0 ? (
        <div className="cpanel__empty">No hay tramitadores asignados a esta compañía.</div>
      ) : (
        <table className="data-table cpanel__table">
          <thead>
            <tr><th>Tramitador</th><th>Email</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            {asignados.map((t: any) => (
              <tr key={t.id}>
                <td><strong>{t.nombre} {t.apellidos}</strong></td>
                <td>{t.email ?? '—'}</td>
                <td>{t.activo !== false ? 'Sí' : 'No'}</td>
                <td>
                  <button
                    className="btn-link"
                    style={{ color: 'var(--red-600)', fontSize: 'var(--text-sm)' }}
                    onClick={() => handleRemove(t.id)}
                    disabled={removeMut.isPending}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── TiposSiniestroPanel ──────────────────────────────────────────────────────

function TiposSiniestroPanel({ companiaId }: { companiaId: string }) {
  const { data: asignadosRes, isLoading } = useCompaniaTiposSiniestro(companiaId);
  const { data: todosRes }                = useTiposSiniestro();
  const addMut    = useAddCompaniaTipoSiniestro();
  const removeMut = useRemoveCompaniaTipoSiniestro();
  const [selectedId, setSelectedId] = useState('');

  const asignados: any[] = (asignadosRes as any)?.data ?? [];
  const todos: any[]     = (todosRes as any)?.data ?? [];
  const asignadosIds     = new Set(asignados.map((r: any) => r.tipo_siniestro_id));
  const disponibles      = todos.filter((t: any) => !asignadosIds.has(t.id));

  const handleAdd = () => {
    if (!selectedId) return;
    addMut.mutate(
      { companiaId, tipoSiniestroId: selectedId },
      { onSuccess: () => setSelectedId('') },
    );
  };

  if (isLoading) return <div className="cpanel__loading">Cargando tipos…</div>;

  return (
    <div>
      <div className="cpanel__add-row">
        <select
          className="form-control cpanel__select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">Seleccione tipo de siniestro…</option>
          {disponibles.map((t: any) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        <button
          className="btn-primary btn--sm"
          onClick={handleAdd}
          disabled={!selectedId || addMut.isPending}
        >
          Añadir tipo
        </button>
      </div>

      {asignados.length === 0 ? (
        <div className="cpanel__empty">No hay tipos de siniestro configurados para esta compañía.</div>
      ) : (
        <table className="data-table cpanel__table">
          <thead>
            <tr>
              <th>Tipo de siniestro</th>
              <th style={{ width: 60 }}>Color</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {asignados.map((row: any) => {
              const tipo = row.tipos_siniestro ?? {};
              return (
                <tr key={row.id}>
                  <td><strong>{tipo.nombre}</strong></td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: tipo.color ?? '#6b7280',
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-link"
                      style={{ color: 'var(--red-600)', fontSize: 'var(--text-sm)' }}
                      onClick={() => removeMut.mutate({ companiaId, tipoId: row.id })}
                      disabled={removeMut.isPending}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  compania: Compania | null;
  onClose: () => void;
  onSave: (form: CompaniaForm) => void;
  isPending: boolean;
  error?: string | null;
}

const OPCIONES: [keyof CompaniaConfig, string][] = [
  ['fact_por_partidas', 'Fact. por partidas'],
  ['albaranes',         'Albaranes'],
  ['notificar_sms',     'Notificar envíos SMS'],
  ['auto_numerico',     'Auto-Numérico'],
  ['asignar_corredor',  'Asignar a Correduría / Adm. Fincas'],
];

function EditModal({ compania, onClose, onSave, isPending, error }: EditModalProps) {
  const [tab, setTab] = useState<'datos' | 'opciones'>('datos');
  const [form, setForm] = useState<CompaniaForm>(() =>
    compania ? companiaToForm(compania) : { ...FORM_DEFAULT, config: { ...CONFIG_DEFAULT } }
  );

  const setField  = <K extends keyof CompaniaForm>(f: K, v: CompaniaForm[K]) =>
    setForm(prev => ({ ...prev, [f]: v }));
  const setConfig = <K extends keyof CompaniaConfig>(f: K, v: CompaniaConfig[K]) =>
    setForm(prev => ({ ...prev, config: { ...prev.config, [f]: v } }));

  const isValid = form.nombre.trim().length > 0 && form.codigo.trim().length > 0;

  return (
    <div
      className="modal-overlay-v2"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-v2 modal-v2--lg">
        {/* Header */}
        <div className="modal-v2__header">
          <h3 className="modal-v2__title">
            {compania ? `Editar — ${compania.nombre}` : 'Nueva compañía'}
          </h3>
          <button className="modal-v2__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Tabs */}
        <div className="compania-tabs">
          {(['datos', 'opciones'] as const).map(t => (
            <button
              key={t}
              className={`compania-tab${tab === t ? ' compania-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'datos' ? 'Datos' : 'Opciones'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-v2__body">
          {tab === 'datos' && (
            <>
              <p className="compania-section-title">Identificación</p>
              <div className="compania-form-grid">
                <div className="form-group-v2 compania-col-full">
                  <label className="form-label required">Nombre</label>
                  <input
                    className="form-control"
                    value={form.nombre}
                    onChange={e => setField('nombre', e.target.value)}
                    placeholder="Nombre completo de la compañía"
                    autoFocus
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label required">Código</label>
                  <input
                    className="form-control"
                    value={form.codigo}
                    onChange={e => setField('codigo', e.target.value)}
                    placeholder="Ej: CULiberty"
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">CIF / NIF</label>
                  <input
                    className="form-control"
                    value={form.cif}
                    onChange={e => setField('cif', e.target.value)}
                    placeholder="A12345678"
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Tipo de entidad</label>
                  <select
                    className="form-control"
                    value={form.tipo}
                    onChange={e => setField('tipo', e.target.value as CompaniaTipo)}
                  >
                    {TIPOS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Sistema de integración</label>
                  <select
                    className="form-control"
                    value={form.sistema_integracion}
                    onChange={e => setField('sistema_integracion', e.target.value as CompaniaSistema | '')}
                  >
                    <option value="">— Sin integración —</option>
                    {SISTEMAS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="compania-section-title" style={{ marginTop: 'var(--space-5)' }}>
                Contacto y domicilio
              </p>
              <div className="compania-form-grid">
                <div className="form-group-v2 compania-col-full">
                  <label className="form-label">Domicilio</label>
                  <input
                    className="form-control"
                    value={form.config.domicilio}
                    onChange={e => setConfig('domicilio', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">C.P.</label>
                  <input
                    className="form-control"
                    value={form.config.cp}
                    onChange={e => setConfig('cp', e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Población</label>
                  <input
                    className="form-control"
                    value={form.config.poblacion}
                    onChange={e => setConfig('poblacion', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Provincia</label>
                  <input
                    className="form-control"
                    value={form.config.provincia}
                    onChange={e => setConfig('provincia', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-control"
                    type="tel"
                    value={form.config.telefono}
                    onChange={e => setConfig('telefono', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Fax</label>
                  <input
                    className="form-control"
                    value={form.config.fax}
                    onChange={e => setConfig('fax', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">E-mail</label>
                  <input
                    className="form-control"
                    type="email"
                    value={form.config.email}
                    onChange={e => setConfig('email', e.target.value)}
                  />
                </div>
                <div className="form-group-v2">
                  <label className="form-label">Prefijo remitente</label>
                  <input
                    className="form-control"
                    value={form.config.prefijo}
                    onChange={e => setConfig('prefijo', e.target.value)}
                    placeholder="ID Prefijo"
                  />
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-5)' }}>
                <label className="compania-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.activa}
                    onChange={e => setField('activa', e.target.checked)}
                  />
                  Compañía activa
                </label>
              </div>
            </>
          )}

          {tab === 'opciones' && (
            <>
              <p className="compania-section-title">Opciones</p>
              <div className="compania-checkboxes">
                {OPCIONES.map(([key, label]) => (
                  <label key={key} className="compania-checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.config[key] as boolean}
                      onChange={e => setConfig(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="alert alert--danger" style={{ marginTop: 'var(--space-4)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-v2__footer">
          <button className="btn-secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!isValid || isPending}
            onClick={() => onSave(form)}
          >
            {isPending
              ? 'Guardando…'
              : compania ? 'Guardar cambios' : 'Crear compañía'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'especialidades',  label: 'Especialidades'   },
  { key: 'baremos',         label: 'Baremos'          },
  { key: 'tramitadores',    label: 'Tramitadores'     },
  { key: 'tipos-siniestro', label: 'Tipos siniestro'  },
  { key: 'plantillas',      label: 'Plantillas'       },
];

export function CompaniasPage() {
  const [filterSistema, setFilterSistema] = useState<CompaniaSistema | ''>('');
  const { data: res, isLoading } = useAllCompanias(
    filterSistema ? { sistema_integracion: filterSistema } : undefined,
  );
  const createMut = useCreateCompania();
  const updateMut = useUpdateCompania();

  const [search,       setSearch]       = useState('');
  const [expanded,     setExpanded]     = useState<ExpandedRow | null>(null);
  const [editCompania, setEditCompania] = useState<Compania | 'nueva' | null>(null);
  const [saveError,    setSaveError]    = useState<string | null>(null);

  const allCompanias: Compania[] = (res as any)?.data ?? [];

  const sorted = useMemo(() => {
    const term = search.toLowerCase().trim();
    const list = term
      ? allCompanias.filter(c =>
          c.nombre.toLowerCase().includes(term) || c.codigo.toLowerCase().includes(term)
        )
      : allCompanias;
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [allCompanias, search]);

  const toggleSection = (companiaId: string, section: Section) => {
    setExpanded(prev =>
      prev?.companiaId === companiaId && prev.section === section
        ? null
        : { companiaId, section }
    );
  };

  const openEdit = (c: Compania | 'nueva') => {
    setSaveError(null);
    setEditCompania(c);
  };

  const handleSave = (form: CompaniaForm) => {
    setSaveError(null);
    const payload = {
      nombre:              form.nombre.trim(),
      codigo:              form.codigo.trim(),
      cif:                 form.cif.trim() || null,
      activa:              form.activa,
      tipo:                form.tipo,
      sistema_integracion: form.sistema_integracion || null,
      config:              form.config,
    };

    if (editCompania === 'nueva') {
      createMut.mutate(payload, {
        onSuccess: result => {
          if ((result as any)?.error) {
            setSaveError((result as any).error.message);
            return;
          }
          setEditCompania(null);
        },
        onError: () => setSaveError('Error al crear la compañía. Inténtalo de nuevo.'),
      });
    } else if (editCompania) {
      updateMut.mutate({ id: editCompania.id, ...payload }, {
        onSuccess: result => {
          if ((result as any)?.error) {
            setSaveError((result as any).error.message);
            return;
          }
          setEditCompania(null);
        },
        onError: () => setSaveError('Error al guardar los cambios. Inténtalo de nuevo.'),
      });
    }
  };

  if (isLoading) return <div className="loading">Cargando compañías…</div>;

  return (
    <div className="page-maestros">
      {/* ── Toolbar ── */}
      <div className="compania-toolbar">
        <button className="btn-primary" onClick={() => openEdit('nueva')}>
          + Nueva compañía
        </button>
        <input
          type="search"
          className="compania-search"
          placeholder="Buscar compañía…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-control"
          style={{ width: 200 }}
          value={filterSistema}
          onChange={e => setFilterSistema(e.target.value as CompaniaSistema | '')}
        >
          <option value="">Todos los sistemas</option>
          {SISTEMAS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="compania-count">
          {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── List ── */}
      <div className="compania-list">
        {sorted.length === 0 && (
          <div className="compania-empty">
            {search || filterSistema
              ? 'Sin resultados para los filtros aplicados.'
              : 'No hay compañías registradas. Crea la primera.'}
          </div>
        )}

        {sorted.map(c => {
          const isOpen = expanded?.companiaId === c.id;
          return (
            <div
              key={c.id}
              className={`compania-row${!c.activa ? ' compania-row--inactiva' : ''}`}
            >
              {/* Row header */}
              <div className="compania-row__header">
                <div className="compania-row__info">
                  <span className="compania-row__nombre">{c.nombre}</span>
                  <span className="compania-row__codigo">({c.codigo})</span>
                  {c.sistema_integracion && (
                    <span className="compania-badge compania-badge--sistema">
                      {c.sistema_integracion}
                    </span>
                  )}
                  {c.tipo !== 'compania' && (
                    <span className="compania-badge compania-badge--tipo">
                      {TIPOS.find(t => t.value === c.tipo)?.label ?? c.tipo}
                    </span>
                  )}
                  {!c.activa && (
                    <span className="compania-badge compania-badge--off">Inactiva</span>
                  )}
                </div>

                <div className="compania-row__actions">
                  <button
                    className="compania-btn compania-btn--edit"
                    onClick={() => openEdit(c)}
                  >
                    Editar
                  </button>

                  {SECTIONS.map(({ key, label }) => {
                    const active = isOpen && expanded?.section === key;
                    return (
                      <button
                        key={key}
                        className={`compania-btn${active ? ' compania-btn--open' : ''}`}
                        onClick={() => toggleSection(c.id, key)}
                      >
                        {label}
                        <span className="compania-btn__caret">{active ? '▲' : '▼'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline panel */}
              {isOpen && expanded && (
                <div className="cpanel">
                  <div className="cpanel__header">
                    <span className="cpanel__title">
                      {SECTIONS.find(s => s.key === expanded.section)?.label}
                      {' '}— {c.nombre}
                    </span>
                    <button
                      className="cpanel__close"
                      onClick={() => setExpanded(null)}
                      aria-label="Cerrar panel"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="cpanel__body">
                    {expanded.section === 'especialidades' && (
                      <EspecialidadesPanel companiaId={c.id} />
                    )}
                    {expanded.section === 'baremos' && (
                      <BaremosPanel companiaId={c.id} />
                    )}
                    {expanded.section === 'tramitadores' && (
                      <TramitadoresPanel companiaId={c.id} />
                    )}
                    {expanded.section === 'tipos-siniestro' && (
                      <TiposSiniestroPanel companiaId={c.id} />
                    )}
                    {expanded.section === 'plantillas' && (
                      <div className="cpanel__placeholder">
                        Plantillas de baremo — disponible próximamente.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modal ── */}
      {editCompania !== null && (
        <EditModal
          compania={editCompania === 'nueva' ? null : editCompania}
          onClose={() => setEditCompania(null)}
          onSave={handleSave}
          isPending={createMut.isPending || updateMut.isPending}
          error={saveError}
        />
      )}
    </div>
  );
}
