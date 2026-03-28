import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProveedor, useCrearProveedor, useUpdateProveedor } from '@/hooks/useProveedores';
import { useOperariosLista } from '@/hooks/useOperarios';
import {
  useBaremosDeProveedor,
  useBaremosPlantilla,
  useAsignarProveedorBaremo,
  useDesasignarProveedorBaremo,
} from '@/hooks/useBaremosPlantilla';

// ─── Estilos reutilizados ─────────────────────────────────────────────────────

const sectionHeaderStyle: React.CSSProperties = {
  backgroundColor: '#333',
  color: '#f4fcc0',
  fontSize: 14,
  fontWeight: 700,
  padding: '6px 10px',
  fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
};

const labelStyle: React.CSSProperties = {
  fontSize: 16,
  color: '#333',
  fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
  paddingRight: 8,
  whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  border: '1px solid #999',
  fontSize: 12,
  padding: 2,
  color: '#333',
  fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 8,
  gap: 4,
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProveedorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const { data: provRes, isLoading: loadingProv } = useProveedor(id ?? null);
  const proveedor = provRes && 'data' in provRes ? (provRes.data as any) : null;

  const { data: opRes } = useOperariosLista({ estado: 'todos', per_page: 999 });
  const operarios: any[] = opRes && 'data' in opRes ? ((opRes.data as any)?.items ?? []) : [];

  const crearMut = useCrearProveedor();
  const updateMut = useUpdateProveedor();

  // ─── Estado del formulario ───────────────────────────────────────────────────
  const [nombre, setNombre] = useState('');
  const [tipoIdentificacion, setTipoIdentificacion] = useState('');
  const [cif, setCif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [iban1, setIban1] = useState('');
  const [iban2, setIban2] = useState('');
  const [iban3, setIban3] = useState('');
  const [iban4, setIban4] = useState('');
  const [iban5, setIban5] = useState('');
  const [iban6, setIban6] = useState('');
  const [limiteDias, setLimiteDias] = useState('');
  const [utilizaPanel, setUtilizaPanel] = useState(false);
  const [autofactura, setAutofactura] = useState(true);
  const [idOperario, setIdOperario] = useState('');
  // Acceso intranet
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [contrasenaEmail, setContrasenaEmail] = useState('');

  // Poblar formulario cuando llegan datos de edición
  useEffect(() => {
    if (!proveedor) return;
    setNombre(proveedor.nombre ?? '');
    setTipoIdentificacion(proveedor.tipo_identificacion ?? '');
    setCif(proveedor.cif ?? '');
    setTelefono(proveedor.telefono ?? '');
    setFax(proveedor.fax ?? '');
    setEmail(proveedor.email ?? '');
    setDireccion(proveedor.direccion ?? '');
    setCodigoPostal(proveedor.codigo_postal ?? '');
    setCiudad(proveedor.localidad ?? '');
    setProvincia(proveedor.provincia ?? '');
    setIban1(proveedor.iban_1 ?? '');
    setIban2(proveedor.iban_2 ?? '');
    setIban3(proveedor.iban_3 ?? '');
    setIban4(proveedor.iban_4 ?? '');
    setIban5(proveedor.iban_5 ?? '');
    setIban6(proveedor.iban_6 ?? '');
    setLimiteDias(proveedor.limite_dias != null ? String(proveedor.limite_dias) : '');
    setUtilizaPanel(proveedor.utiliza_panel ?? false);
    setAutofactura(proveedor.autofactura ?? true);
    setIdOperario(proveedor.id_operario ?? '');
    setUsuario(proveedor.usuario ?? '');
    setContrasena(proveedor.contrasena ?? '');
    setUsuarioEmail(proveedor.email_app ?? '');
    setContrasenaEmail(proveedor.contrasena_email_app ?? '');
  }, [proveedor]);

  const isPending = crearMut.isPending || updateMut.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const payload: Record<string, unknown> = {
      nombre: nombre.trim(),
      tipo_identificacion: tipoIdentificacion || undefined,
      cif: cif || undefined,
      telefono: telefono || undefined,
      fax: fax || undefined,
      email: email || undefined,
      direccion: direccion || undefined,
      codigo_postal: codigoPostal || undefined,
      localidad: ciudad || undefined,
      provincia: provincia || undefined,
      iban_1: iban1 || undefined,
      iban_2: iban2 || undefined,
      iban_3: iban3 || undefined,
      iban_4: iban4 || undefined,
      iban_5: iban5 || undefined,
      iban_6: iban6 || undefined,
      limite_dias: limiteDias ? Number(limiteDias) : undefined,
      utiliza_panel: utilizaPanel,
      autofactura: autofactura,
      id_operario: idOperario || undefined,
      usuario: usuario || undefined,
      contrasena: contrasena || undefined,
      email_app: usuarioEmail || undefined,
      contrasena_email_app: contrasenaEmail || undefined,
    };

    if (isEdit && id) {
      updateMut.mutate(
        { id, ...payload } as any,
        { onSuccess: () => navigate('/proveedores') },
      );
    } else {
      crearMut.mutate(
        payload as any,
        { onSuccess: () => navigate('/proveedores') },
      );
    }
  }

  if (isEdit && loadingProv) {
    return (
      <div style={{ fontFamily: 'Verdana, Arial, Helvetica, sans-serif', padding: 16, fontSize: 12 }}>
        Cargando datos del proveedor...
      </div>
    );
  }

  const isError = crearMut.isError || updateMut.isError;

  return (
    <div style={{ fontFamily: 'Verdana, Arial, Helvetica, sans-serif', background: '#fff', padding: 16 }}>
      <form onSubmit={handleSubmit}>
        {/* Campo oculto ID */}
        <input type="hidden" name="idproveedor" value={id ?? ''} />

        {/* ══════════════════════════════════════════════════════════════
            SECCIÓN 1 — Datos del proveedor
        ═══════════════════════════════════════════════════════════════ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr>
              <td colSpan={2} style={sectionHeaderStyle}>
                Datos del proveedor
              </td>
            </tr>
          </thead>
          <tbody>

            {/* 1. Nombre */}
            <tr>
              <td style={{ ...labelStyle, width: 160, verticalAlign: 'middle', padding: '4px 8px' }}>Nombre</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  size={50}
                  maxLength={255}
                  required
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 2. Identificación (tipo + número) */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Identificación</td>
              <td style={{ padding: '4px 0' }}>
                <div style={rowStyle}>
                  <select
                    name="tipo_identificacion"
                    value={tipoIdentificacion}
                    onChange={(e) => setTipoIdentificacion(e.target.value)}
                    style={{ ...inputStyle, marginRight: 6 }}
                  >
                    <option value="">----</option>
                    <option value="N.I.F.">N.I.F.</option>
                    <option value="C.I.F.">C.I.F.</option>
                    <option value="N.I.E.">N.I.E.</option>
                    <option value="OTROS">OTROS</option>
                  </select>
                  <input
                    type="text"
                    name="nif_proveedor"
                    value={cif}
                    onChange={(e) => setCif(e.target.value)}
                    size={13}
                    maxLength={9}
                    style={inputStyle}
                  />
                </div>
              </td>
            </tr>

            {/* 3. Teléfono */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Teléfono</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  size={13}
                  maxLength={9}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 4. Fax */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Fax</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="fax"
                  value={fax}
                  onChange={(e) => setFax(e.target.value)}
                  size={13}
                  maxLength={9}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 5. E-Mail */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>E-Mail</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size={50}
                  maxLength={200}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 6. Dirección */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Dirección</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  size={50}
                  maxLength={255}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 7. Código postal */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Código postal</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="codigo_postal_proveedor"
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                  size={5}
                  maxLength={5}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 8. Ciudad */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Ciudad</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="ciudad"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  size={50}
                  maxLength={200}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 9. Provincia */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Provincia</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="provincia_proveedor"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  size={50}
                  maxLength={200}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 10. IBAN (6 bloques) */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>IBAN</td>
              <td style={{ padding: '4px 0' }}>
                <div style={rowStyle}>
                  <input
                    type="text"
                    name="iban_1_proveedor"
                    value={iban1}
                    onChange={(e) => setIban1(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                    placeholder="ES12"
                  />
                  <span>-</span>
                  <input
                    type="text"
                    name="iban_2_proveedor"
                    value={iban2}
                    onChange={(e) => setIban2(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                  />
                  <span>-</span>
                  <input
                    type="text"
                    name="iban_3_proveedor"
                    value={iban3}
                    onChange={(e) => setIban3(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                  />
                  <span>-</span>
                  <input
                    type="text"
                    name="iban_4_proveedor"
                    value={iban4}
                    onChange={(e) => setIban4(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                  />
                  <span>-</span>
                  <input
                    type="text"
                    name="iban_5_proveedor"
                    value={iban5}
                    onChange={(e) => setIban5(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                  />
                  <span>-</span>
                  <input
                    type="text"
                    name="iban_6_proveedor"
                    value={iban6}
                    onChange={(e) => setIban6(e.target.value)}
                    size={4}
                    maxLength={4}
                    style={{ ...inputStyle, width: 40 }}
                  />
                </div>
              </td>
            </tr>

            {/* 11. Días límites */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Días límites</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="limite_dias"
                  value={limiteDias}
                  onChange={(e) => setLimiteDias(e.target.value)}
                  size={13}
                  maxLength={9}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 12. Utiliza panel */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Utiliza panel</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="checkbox"
                  name="panel"
                  checked={utilizaPanel}
                  onChange={(e) => setUtilizaPanel(e.target.checked)}
                />
              </td>
            </tr>

            {/* 13. Autofactura */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Autofactura</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="checkbox"
                  name="autofactura"
                  checked={autofactura}
                  onChange={(e) => setAutofactura(e.target.checked)}
                />
              </td>
            </tr>

            {/* 14. Operario */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Operario</td>
              <td style={{ padding: '4px 0' }}>
                <select
                  name="operario"
                  value={idOperario}
                  onChange={(e) => setIdOperario(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Ninguno</option>
                  {operarios.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      ({o.activo ? 'A' : 'N'}) {o.nombre} {o.apellidos ?? ''}
                    </option>
                  ))}
                </select>
              </td>
            </tr>

          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════
            SECCIÓN 2 — Acceso intranet
        ═══════════════════════════════════════════════════════════════ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr>
              <td colSpan={2} style={sectionHeaderStyle}>
                Acceso intranet
              </td>
            </tr>
          </thead>
          <tbody>

            {/* 15. Usuario */}
            <tr>
              <td style={{ ...labelStyle, width: 160, verticalAlign: 'middle', padding: '4px 8px' }}>Usuario</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="text"
                  name="usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 16. Clave */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Clave</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="password"
                  name="contrasenya"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 17. E-mail (acceso) */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>E-mail</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="email"
                  name="usuario_email"
                  value={usuarioEmail}
                  onChange={(e) => setUsuarioEmail(e.target.value)}
                  style={inputStyle}
                />
              </td>
            </tr>

            {/* 18. Clave (email) */}
            <tr>
              <td style={{ ...labelStyle, verticalAlign: 'middle', padding: '4px 8px' }}>Clave (email)</td>
              <td style={{ padding: '4px 0' }}>
                <input
                  type="password"
                  name="contrasenya_email"
                  value={contrasenaEmail}
                  onChange={(e) => setContrasenaEmail(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </td>
            </tr>

          </tbody>
        </table>

        {/* Botón GUARDAR */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="submit"
            name="guardar"
            value="GUARDAR"
            disabled={isPending}
            style={{
              backgroundColor: '#666',
              color: '#f4fcc0',
              border: '1px solid #333',
              fontSize: 12,
              padding: '4px 16px',
              cursor: isPending ? 'wait' : 'pointer',
              fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
            }}
          />
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/proveedores'); }}
            style={{ fontSize: 12, color: '#333' }}
          >
            Volver al listado
          </a>
        </div>

        {isError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'red' }}>
            Error al guardar el proveedor. Revise los datos e inténtelo de nuevo.
          </div>
        )}
      </form>

      {/* ══════════════════════════════════════════════════════════════
          SECCIÓN 3 — Baremos asignados (solo en modo edición)
      ═══════════════════════════════════════════════════════════════ */}
      {isEdit && id && <BaremosSection proveedorId={id} />}
    </div>
  );
}

// ─── Sección Baremos (componente auxiliar) ────────────────────────────────────

function BaremosSection({ proveedorId }: { proveedorId: string }) {
  const [baremoidSeleccionado, setBaremoidSeleccionado] = useState('');

  const { data: asignadosRes, isLoading: loadingAsignados } = useBaremosDeProveedor(proveedorId);
  const asignados: any[] = asignadosRes && 'data' in asignadosRes ? (asignadosRes.data as any[]) ?? [] : [];

  const { data: todosRes } = useBaremosPlantilla({ tipo: 'Proveedor' });
  const todosBaremosRaw: any[] = todosRes && 'data' in todosRes ? (todosRes.data as any[]) ?? [] : [];
  const asignadosIds = new Set(asignados.map((b: any) => b.id));
  const disponibles = todosBaremosRaw.filter((b: any) => !asignadosIds.has(b.id));

  const asignarMut = useAsignarProveedorBaremo();
  const desasignarMut = useDesasignarProveedorBaremo();

  const sectionHeaderStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: '#f4fcc0',
    fontSize: 14,
    fontWeight: 700,
    padding: '6px 10px',
    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#333',
    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#f9f9f9',
    border: '1px solid #999',
    fontSize: 12,
    padding: 2,
    color: '#333',
    fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
  };

  function formatDate(iso: string) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function handleAsignar() {
    if (!baremoidSeleccionado) return;
    await asignarMut.mutateAsync({ baremoid: baremoidSeleccionado, proveedor_id: proveedorId });
    setBaremoidSeleccionado('');
  }

  async function handleDesasignar(baremoid: string, nombre: string) {
    if (!window.confirm(`¿Eliminar el baremo "${nombre}" de este proveedor?`)) return;
    await desasignarMut.mutateAsync({ baremoid, proveedor_id: proveedorId });
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
      <thead>
        <tr>
          <td colSpan={5} style={sectionHeaderStyle}>
            Baremos asignados
          </td>
        </tr>
      </thead>
      <tbody>
        {/* Fila para asignar nuevo baremo */}
        <tr>
          <td colSpan={5} style={{ padding: '6px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={baremoidSeleccionado}
                onChange={(e) => setBaremoidSeleccionado(e.target.value)}
                style={{ ...inputStyle, minWidth: 240 }}
              >
                <option value="">-- Seleccionar baremo --</option>
                {disponibles.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} ({formatDate(b.fecha_inicio)} – {formatDate(b.fecha_fin)})
                  </option>
                ))}
              </select>
              <input
                type="button"
                value="Asignar"
                disabled={!baremoidSeleccionado || asignarMut.isPending}
                onClick={handleAsignar}
                style={{
                  fontSize: 12,
                  cursor: baremoidSeleccionado ? 'pointer' : 'default',
                  padding: '2px 10px',
                  backgroundColor: '#3c8dbc',
                  color: '#fff',
                  border: '1px solid #367fa9',
                }}
              />
            </div>
            {asignarMut.isError && (
              <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                Error al asignar baremo. Es posible que ya esté asignado.
              </div>
            )}
          </td>
        </tr>

        {/* Cabecera tabla */}
        <tr style={{ backgroundColor: '#555' }}>
          <td style={{ ...labelStyle, color: '#fff', padding: '4px 6px', fontWeight: 700 }}>Nombre</td>
          <td style={{ ...labelStyle, color: '#fff', padding: '4px 6px', fontWeight: 700 }}>Fecha inicio</td>
          <td style={{ ...labelStyle, color: '#fff', padding: '4px 6px', fontWeight: 700 }}>Fecha fin</td>
          <td style={{ ...labelStyle, color: '#fff', padding: '4px 6px', fontWeight: 700 }}></td>
        </tr>

        {/* Filas de baremos asignados */}
        {loadingAsignados ? (
          <tr>
            <td colSpan={4} style={{ ...labelStyle, padding: 8 }}>Cargando baremos...</td>
          </tr>
        ) : asignados.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ ...labelStyle, padding: 8, color: '#888' }}>
              No hay baremos asignados a este proveedor.
            </td>
          </tr>
        ) : (
          asignados.map((b: any) => (
            <tr key={b.id} style={{ backgroundColor: '#DBDBDB' }}>
              <td style={{ ...labelStyle, padding: '4px 6px' }}>{b.nombre}</td>
              <td style={{ ...labelStyle, padding: '4px 6px' }}>{formatDate(b.fecha_inicio)}</td>
              <td style={{ ...labelStyle, padding: '4px 6px' }}>{formatDate(b.fecha_fin)}</td>
              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleDesasignar(b.id, b.nombre); }}
                  style={{ fontSize: 12, color: '#c0392b' }}
                >
                  Eliminar
                </a>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
