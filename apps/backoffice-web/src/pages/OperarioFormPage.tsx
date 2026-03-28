import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HardHat, ArrowLeft, Save } from 'lucide-react';
import { useOperario, useCreateOperario, useUpdateOperario } from '@/hooks/useOperarios';
import { useEspecialidades } from '@/hooks/useEspecialidades';
import { useDocRequerida } from '@/hooks/useDocRequerida';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_ID = ['----', 'N.I.F.', 'C.I.F.', 'N.I.E.', 'OTROS'];

const TIPOS_OPERARIO = ['-----', 'Autónomo', 'Contratado'];

const GENERA_PRESUPUESTOS = ['No genera', 'Con baremo operario', 'Con baremo compañía'];

const TIPOS_SERVICIO = [
  'Fontanería', 'Electricidad', 'Carpintería', 'Cerrajería', 'Cristalería',
  'Pintura', 'Albañilería', 'Climatización', 'Jardinería', 'Limpieza',
  'Desbordamiento', 'Impermeabilización', 'Deshumectación', 'Caída de árbol', 'Otros',
];

const EMPTY: Record<string, any> = {
  nombre: '', apellidos: '', telefono: '', email: '',
  razon_social: '', direccion: '', poblacion: '', ciudad: '', codigo_postal: '', provincia: '',
  telf2: '', fax: '', tipo_identificacion: '', nif: '', persona_contacto: '',
  iban_1: '', iban_2: '', iban_3: '', iban_4: '', iban_5: '', iban_6: '',
  numero_entidad: '', numero_oficina: '', numero_control: '', numero_cuenta: '', cuenta_bancaria: '',
  subcuenta_operario: '', prefijo_autofactura: '', tipo_operario: '',
  nomina: '', precio_hora: '',
  irpf: false, tipo_descuento: 'Desc', descuento_negociado: '', permitir_incrementos: false,
  automatico_sms: false, automatico_email: false, opcion_finaliza_visita: false,
  supervisor: false, bloquear_fotos: false,
  usa_app_movil: false, ocultar_baremo_app: false, ocultar_precio_baremo: false,
  fichaje_activo: false, horas_convenio_dia: '', jornada_laboral: '',
  plataforma_pas: false, app_pwgs: true,
  preferente: false, establecer_iva: false, iva_operario: '', puede_segunda_visita: false,
  genera_presupuestos: 'No genera', autoaprobado: false, mostrar_datos_perito: false,
  observaciones: '',
  usuario_intranet: '', contrasena_intranet: '', email_aplicacion: '', contrasena_email_app: '',
  activo: true, bloqueado: false,
  tipos_servicio: [] as string[],
  gremios: [] as string[],
};

type Tab = 'datos' | 'doc' | 'servicios';

// ─── Componente ───────────────────────────────────────────────────────────────

export function OperarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'nuevo';

  const { data: res, isLoading } = useOperario(isNew ? null : id!);
  const { data: docRes }         = useDocRequerida(true);
  const { data: catRes }         = useEspecialidades(true);

  const createMut = useCreateOperario();
  const updateMut = useUpdateOperario();

  const [tab, setTab]   = useState<Tab>('datos');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const operario = res && 'data' in res ? res.data as any : null;
  const docsRequeridos: any[] = docRes?.data ?? [];
  const catalogo: any[] = catRes && 'data' in catRes ? (catRes.data as any[]) ?? [] : [];

  // Populate form when operario loads
  useEffect(() => {
    if (operario) {
      const filled: Record<string, any> = { ...EMPTY };
      for (const key of Object.keys(EMPTY)) {
        if (key in operario && operario[key] !== null && operario[key] !== undefined) {
          filled[key] = operario[key];
        }
      }
      setForm(filled);
    }
  }, [operario]);

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  function toggleArr(k: 'tipos_servicio' | 'gremios', val: string) {
    setForm((p) => ({
      ...p,
      [k]: (p[k] as string[]).includes(val)
        ? (p[k] as string[]).filter((x: string) => x !== val)
        : [...(p[k] as string[]), val],
    }));
  }

  async function handleSave() {
    setError('');
    if (!form.nombre?.trim() || !form.apellidos?.trim() || !form.telefono?.trim()) {
      setError('Nombre, apellidos y teléfono son obligatorios');
      return;
    }
    try {
      if (isNew) {
        const created: any = await createMut.mutateAsync(form);
        const newId = created?.data?.id;
        if (newId) navigate(`/operarios-config/${newId}`, { replace: true });
      } else {
        await updateMut.mutateAsync({ id: id!, ...form });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar');
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  if (!isNew && isLoading) {
    return <div className="loading">Cargando operario...</div>;
  }

  // ── Renderiza tab Datos Operario ─────────────────────────────────────────────
  function renderDatos() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Datos personales */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Datos personales</div>
          <div className="form-grid-v2">
            <div className="form-group-v2 span-full">
              <label className="form-label required">Nombre</label>
              <input className="form-control" value={form.nombre} autoFocus required
                onChange={(e) => set('nombre', e.target.value)} />
            </div>
            <div className="form-group-v2 span-full">
              <label className="form-label required">Apellidos</label>
              <input className="form-control" value={form.apellidos} required
                onChange={(e) => set('apellidos', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Razón social</label>
              <input className="form-control" value={form.razon_social}
                onChange={(e) => set('razon_social', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">NIF — Tipo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-control" style={{ width: 90, flexShrink: 0 }}
                  value={form.tipo_identificacion}
                  onChange={(e) => set('tipo_identificacion', e.target.value)}>
                  {TIPOS_ID.map((t) => <option key={t}>{t}</option>)}
                </select>
                <input className="form-control" value={form.nif} placeholder="Número"
                  onChange={(e) => set('nif', e.target.value)} />
              </div>
            </div>
            <div className="form-group-v2">
              <label className="form-label">Dirección</label>
              <input className="form-control" value={form.direccion}
                onChange={(e) => set('direccion', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Población</label>
              <input className="form-control" value={form.ciudad || form.poblacion}
                onChange={(e) => { set('ciudad', e.target.value); set('poblacion', e.target.value); }} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">C. Postal</label>
              <input className="form-control" value={form.codigo_postal}
                onChange={(e) => set('codigo_postal', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Provincia</label>
              <input className="form-control" value={form.provincia}
                onChange={(e) => set('provincia', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label required">Móvil</label>
              <input className="form-control" type="tel" value={form.telefono} required
                onChange={(e) => set('telefono', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Teléfono</label>
              <input className="form-control" type="tel" value={form.telf2}
                onChange={(e) => set('telf2', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Fax</label>
              <input className="form-control" type="tel" value={form.fax}
                onChange={(e) => set('fax', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">E-Mail</label>
              <input className="form-control" type="email" value={form.email}
                onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Persona de contacto</label>
              <input className="form-control" value={form.persona_contacto}
                onChange={(e) => set('persona_contacto', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Datos bancarios */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Datos bancarios</div>
          <div className="form-group-v2">
            <label className="form-label">IBAN</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {(['iban_1', 'iban_2', 'iban_3', 'iban_4', 'iban_5', 'iban_6'] as const).map((k, i) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input className="form-control" value={form[k]} placeholder={i === 0 ? 'ES12' : '0000'}
                    style={{ width: i === 5 ? 80 : 55, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 13 }}
                    maxLength={i === 5 ? 10 : 4}
                    onChange={(e) => set(k, e.target.value.toUpperCase())} />
                  {i < 5 && <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="form-grid-v2" style={{ marginTop: 8 }}>
            <div className="form-group-v2">
              <label className="form-label">CCC — Entidad</label>
              <input className="form-control" value={form.numero_entidad} maxLength={4}
                onChange={(e) => set('numero_entidad', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Oficina</label>
              <input className="form-control" value={form.numero_oficina} maxLength={4}
                onChange={(e) => set('numero_oficina', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Control</label>
              <input className="form-control" value={form.numero_control} maxLength={2}
                onChange={(e) => set('numero_control', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Cuenta</label>
              <input className="form-control" value={form.numero_cuenta} maxLength={10}
                onChange={(e) => set('numero_cuenta', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Datos fiscales */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Datos fiscales / Facturación</div>
          <div className="form-grid-v2">
            <div className="form-group-v2">
              <label className="form-label">Sub. Cont.</label>
              <input className="form-control" value={form.subcuenta_operario}
                onChange={(e) => set('subcuenta_operario', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Prefijo Autofactura</label>
              <input className="form-control" value={form.prefijo_autofactura}
                onChange={(e) => set('prefijo_autofactura', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={form.tipo_operario || ''}
                onChange={(e) => set('tipo_operario', e.target.value || null)}>
                {TIPOS_OPERARIO.map((t) => <option key={t} value={t === '-----' ? '' : t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group-v2">
              <label className="form-label">Importe Nómina (€)</label>
              <input className="form-control" type="number" step="0.01" value={form.nomina}
                onChange={(e) => set('nomina', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Precio/hora (€)</label>
              <input className="form-control" type="number" step="0.01" value={form.precio_hora}
                onChange={(e) => set('precio_hora', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Configuración financiera */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Configuración financiera</div>
          <div className="form-grid-v2">
            <div className="form-group-v2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.irpf} onChange={(e) => set('irpf', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span className="form-label" style={{ margin: 0 }}>IRPF</span>
              </label>
            </div>
            <div className="form-group-v2">
              <label className="form-label">Desc/Incr defecto (%)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-control" style={{ width: 80 }} value={form.tipo_descuento}
                  onChange={(e) => set('tipo_descuento', e.target.value)}>
                  <option value="Desc">Desc</option>
                  <option value="Incr">Incr</option>
                </select>
                <input className="form-control" type="number" step="0.01" value={form.descuento_negociado}
                  onChange={(e) => set('descuento_negociado', e.target.value)} />
              </div>
            </div>
            <div className="form-group-v2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.permitir_incrementos} onChange={(e) => set('permitir_incrementos', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span className="form-label" style={{ margin: 0 }}>Permitir incrementos</span>
              </label>
            </div>
          </div>
        </div>

        {/* Comunicaciones */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Comunicaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['automatico_sms', 'Envío automático SMS'],
              ['automatico_email', 'Envío automático email'],
              ['opcion_finaliza_visita', 'Opción finalizar visita intranet'],
              ['supervisor', 'Supervisor operarios'],
              ['bloquear_fotos', 'Bloquear envío auto. fotos Caser'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* APP móvil */}
        <div className="form-section-v2" style={{ background: 'rgba(59, 130, 246, 0.07)', borderRadius: 8, padding: 16, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div className="form-section-v2__title" style={{ color: '#2563eb' }}>APP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['usa_app_movil', 'Utiliza APP móvil'],
              ['ocultar_baremo_app', 'Ocultar baremo APP'],
              ['ocultar_precio_baremo', 'Ocultar precio op. baremo'],
              ['fichaje_activo', 'Fichaje'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
            <div className="form-grid-v2" style={{ marginTop: 4 }}>
              <div className="form-group-v2">
                <label className="form-label">Fichaje: horas/día</label>
                <input className="form-control" type="number" step="0.5" value={form.horas_convenio_dia}
                  onChange={(e) => set('horas_convenio_dia', e.target.value)} />
              </div>
              <div className="form-group-v2">
                <label className="form-label">Fichaje: jornada</label>
                <input className="form-control" value={form.jornada_laboral}
                  onChange={(e) => set('jornada_laboral', e.target.value)} />
              </div>
            </div>
            {[
              ['plataforma_pas', 'Plataforma PAS / RGA'],
              ['app_pwgs', 'App PWGS'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Opciones generales */}
        <div className="form-section-v2">
          <div className="form-section-v2__title">Opciones generales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['preferente', 'Preferente'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
                <input type="checkbox" checked={!!form.establecer_iva} onChange={(e) => set('establecer_iva', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>Establecer IVA personalizado</span>
              </label>
              {form.establecer_iva && (
                <div className="form-group-v2" style={{ marginLeft: 24 }}>
                  <label className="form-label">IVA (%)</label>
                  <input className="form-control" type="number" step="0.01" style={{ width: 100 }} value={form.iva_operario}
                    onChange={(e) => set('iva_operario', e.target.value)} />
                </div>
              )}
            </div>
            {[
              ['puede_segunda_visita', 'Puede dar 2ª visita'],
              ['autoaprobado', 'Auto-aprobados presupuestos'],
              ['mostrar_datos_perito', 'Mostrar datos perito'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
            <div className="form-group-v2">
              <label className="form-label">Genera presupuestos</label>
              <select className="form-control" value={form.genera_presupuestos}
                onChange={(e) => set('genera_presupuestos', e.target.value)}>
                {GENERA_PRESUPUESTOS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group-v2">
              <label className="form-label">Observaciones</label>
              <textarea className="form-control" rows={4} value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Acceso intranet */}
        <div className="form-section-v2" style={{ background: '#000', borderRadius: 8, padding: 16, color: '#fff' }}>
          <div className="form-section-v2__title" style={{ color: '#fff', borderColor: '#444' }}>Acceso Intranet</div>
          <div className="form-grid-v2">
            <div className="form-group-v2">
              <label style={{ color: '#fff', fontSize: 13, marginBottom: 4, display: 'block' }}>Usuario</label>
              <input className="form-control" value={form.usuario_intranet}
                onChange={(e) => set('usuario_intranet', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label style={{ color: '#fff', fontSize: 13, marginBottom: 4, display: 'block' }}>Clave</label>
              <input className="form-control" value={form.contrasena_intranet}
                onChange={(e) => set('contrasena_intranet', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label style={{ color: '#fff', fontSize: 13, marginBottom: 4, display: 'block' }}>E-mail aplicación</label>
              <input className="form-control" value={form.email_aplicacion} placeholder="Nombre usuario"
                onChange={(e) => set('email_aplicacion', e.target.value)} />
            </div>
            <div className="form-group-v2">
              <label style={{ color: '#fff', fontSize: 13, marginBottom: 4, display: 'block' }}>Clave (email)</label>
              <input className="form-control" value={form.contrasena_email_app}
                onChange={(e) => set('contrasena_email_app', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Estado */}
        {!isNew && (
          <div className="form-section-v2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.activo} onChange={(e) => set('activo', e.target.checked)} style={{ width: 15, height: 15 }} />
              <span style={{ fontSize: 14 }}>Operario activo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
              <input type="checkbox" checked={!!form.bloqueado} onChange={(e) => set('bloqueado', e.target.checked)} style={{ width: 15, height: 15 }} />
              <span style={{ fontSize: 14 }}>Bloqueado ⊘</span>
            </label>
          </div>
        )}
      </div>
    );
  }

  // ── Tab Doc. Requerida ────────────────────────────────────────────────────────
  function renderDoc() {
    return (
      <div>
        {docsRequeridos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>
            No hay tipos de documentos configurados. Configúralos en <strong>Doc. Requerida</strong>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docsRequeridos.map((d: any) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-subtle)', borderRadius: 8, border: '1px solid var(--color-border-default)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{d.nombre}</div>
                  {d.dias_vigencia && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Vigencia: {d.dias_vigencia} días</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {d.obligatorio && <span className="badge badge-danger">Obligatorio</span>}
                  <span className="badge badge-default">Sin entregar</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {isNew && (
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 16 }}>
            Guarda el operario primero para gestionar la documentación entregada.
          </p>
        )}
      </div>
    );
  }

  // ── Tab Tipos servicio ────────────────────────────────────────────────────────
  function renderServicios() {
    return (
      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Selecciona los tipos de servicio que puede realizar este operario:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 16 }}>
          {TIPOS_SERVICIO.map((tipo) => (
            <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: 6, border: `1px solid ${form.tipos_servicio.includes(tipo) ? 'var(--color-primary)' : 'var(--color-border-default)'}` }}>
              <input type="checkbox" checked={form.tipos_servicio.includes(tipo)} onChange={() => toggleArr('tipos_servicio', tipo)} style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 13 }}>{tipo}</span>
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {form.tipos_servicio.length} tipo{form.tipos_servicio.length !== 1 ? 's' : ''} seleccionado{form.tipos_servicio.length !== 1 ? 's' : ''}
        </p>

        {/* Gremios / especialidades legacy */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Especialidades (gremios):</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catalogo.map((e: any) => (
              <button
                key={e.id}
                type="button"
                className={`btn ${form.gremios.includes(e.id) ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '3px 10px' }}
                onClick={() => toggleArr('gremios', e.id)}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stub">
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => navigate('/operarios-config')}>
          <ArrowLeft size={14} /> Volver
        </button>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardHat size={20} />
          {isNew ? 'Nuevo Operario' : `Editar Operario${operario ? ` — ${operario.nombre} ${operario.apellidos}` : ''}`}
        </h2>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>Guardado correctamente</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', marginBottom: 20 }}>
        {([
          ['datos', 'Datos Operario'],
          ['doc', 'Doc. Requerida'],
          ['servicios', 'Tipos servicio'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === key ? 600 : 400,
            borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      <div style={{ maxWidth: 800 }}>
        {tab === 'datos' && renderDatos()}
        {tab === 'doc' && renderDoc()}
        {tab === 'servicios' && renderServicios()}
      </div>

      {/* Botón GUARDAR */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ minWidth: 200, fontSize: 15, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleSave}
          disabled={isPending}
        >
          <Save size={16} />
          {isPending ? 'Guardando...' : 'GUARDAR'}
        </button>
      </div>
    </div>
  );
}
