import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCompanias, useEmpresasFacturadoras, useAsegurados, useTiposSiniestroForCompania } from '@/hooks/useMasters';
import type { CreateExpedienteRequest } from '@erp/types';

export function NuevoExpedientePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Lookups
  const { data: companiasRes } = useCompanias();
  const { data: empresasRes } = useEmpresasFacturadoras();

  const companias = companiasRes && 'data' in companiasRes ? companiasRes.data ?? [] : [];
  const empresas = empresasRes && 'data' in empresasRes ? empresasRes.data ?? [] : [];

  // Asegurado search
  const [aseguradoSearch, setAseguradoSearch] = useState('');
  const [aseguradoMode, setAseguradoMode] = useState<'existing' | 'new'>('new');
  const [selectedAseguradoId, setSelectedAseguradoId] = useState('');
  const { data: aseguradosRes } = useAsegurados(aseguradoMode === 'existing' ? aseguradoSearch : undefined);
  const asegurados = aseguradosRes && 'data' in aseguradosRes ? aseguradosRes.data ?? [] : [];

  // Form state
  const [form, setForm] = useState({
    compania_id: '',
    empresa_facturadora_id: '',
    tipo_siniestro: '',
    descripcion: '',
    declaracion_siniestro: '',
    numero_expediente: '',
    direccion_siniestro: '',
    codigo_postal: '',
    localidad: '',
    provincia: '',
    numero_poliza: '',
    numero_siniestro_cia: '',
    prioridad: 'media' as const,
    // Asegurado nuevo
    aseg_nombre: '',
    aseg_apellidos: '',
    aseg_telefono: '',
    aseg_telefono2: '',
    aseg_email: '',
    aseg_nif: '',
    aseg_direccion: '',
    aseg_cp: '',
    aseg_localidad: '',
    aseg_provincia: '',
  });

  // Controla si el nº expediente fue auto-sugerido (se puede sobreescribir con sugerencia nueva)
  // o fue editado manualmente (no sobreescribir)
  const numeroModoRef = useRef<'none' | 'auto' | 'manual'>('none');

  const [error, setError] = useState('');

  // Tipos de siniestro filtrados por compañía seleccionada (necesita form.compania_id)
  const { data: tiposRes } = useTiposSiniestroForCompania(form.compania_id || null);
  const tipos = tiposRes && 'data' in tiposRes ? (tiposRes.data ?? []) : [];

  // Sugerencia de número de expediente (preview sin incrementar contador)
  const { data: sugerenciaRes } = useQuery({
    queryKey: ['sugerir-num-exp', form.compania_id, form.provincia],
    queryFn: () =>
      api.get(`/masters/companias/${form.compania_id}/sugerir-numero-expediente?provincia=${encodeURIComponent(form.provincia)}`),
    enabled: !!form.compania_id,
    staleTime: 15_000,
  });
  const sugerencia = (sugerenciaRes as any)?.data as { autonumero_activo: boolean; sugerido: string | null } | undefined;

  // Pre-rellenar el campo cuando llega una sugerencia (solo si no fue editado a mano)
  useEffect(() => {
    if (!sugerencia) return;
    if (sugerencia.autonumero_activo && sugerencia.sugerido && numeroModoRef.current !== 'manual') {
      setForm(f => ({ ...f, numero_expediente: sugerencia.sugerido! }));
      numeroModoRef.current = 'auto';
    } else if (!sugerencia.autonumero_activo && numeroModoRef.current === 'auto') {
      setForm(f => ({ ...f, numero_expediente: '' }));
      numeroModoRef.current = 'none';
    }
  }, [sugerencia]);

  const mutation = useMutation({
    mutationFn: (data: CreateExpedienteRequest) => api.post('/expedientes', data),
    onSuccess: (result) => {
      if (result && 'data' in result && result.data) {
        qc.invalidateQueries({ queryKey: ['expedientes'] });
        qc.invalidateQueries({ queryKey: ['bandeja-contadores'] });
        navigate(`/expedientes/${(result.data as any).id}`);
      } else if (result && 'error' in result && result.error) {
        setError(result.error.message);
      }
    },
  });

  const set = (field: string, value: string) => {
    if (field === 'compania_id') {
      // Al cambiar compañía: resetear tipo, número y modo auto
      numeroModoRef.current = 'none';
      setForm(f => ({ ...f, compania_id: value, tipo_siniestro: '', numero_expediente: '' }));
    } else {
      setForm(f => ({ ...f, [field]: value }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const payload: CreateExpedienteRequest = {
      numero_expediente: form.numero_expediente.trim() || undefined,
      compania_id: form.compania_id,
      empresa_facturadora_id: form.empresa_facturadora_id,
      tipo_siniestro: form.tipo_siniestro,
      descripcion: form.descripcion,
      declaracion_siniestro: form.declaracion_siniestro || undefined,
      direccion_siniestro: form.direccion_siniestro,
      codigo_postal: form.codigo_postal,
      localidad: form.localidad,
      provincia: form.provincia,
      numero_poliza: form.numero_poliza || undefined,
      numero_siniestro_cia: form.numero_siniestro_cia || undefined,
      prioridad: form.prioridad,
      origen: 'manual',
    };

    if (aseguradoMode === 'existing') {
      payload.asegurado_id = selectedAseguradoId;
    } else {
      payload.asegurado_nuevo = {
        nombre: form.aseg_nombre,
        apellidos: form.aseg_apellidos,
        telefono: form.aseg_telefono,
        telefono2: form.aseg_telefono2 || undefined,
        email: form.aseg_email || undefined,
        nif: form.aseg_nif || undefined,
        direccion: form.aseg_direccion,
        codigo_postal: form.aseg_cp,
        localidad: form.aseg_localidad,
        provincia: form.aseg_provincia,
      };
    }

    mutation.mutate(payload);
  };

  const copyAddressFromAsegurado = () => {
    setForm((f) => ({
      ...f,
      direccion_siniestro: f.aseg_direccion,
      codigo_postal: f.aseg_cp,
      localidad: f.aseg_localidad,
      provincia: f.aseg_provincia,
    }));
  };

  return (
    <div className="page-nuevo-expediente">
      <h2>Nuevo expediente</h2>

      <form onSubmit={handleSubmit} className="form-sections">
        {/* ─── Datos del encargo ─── */}
        <section className="form-section">
          <h3>Datos del encargo</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Compañía *</label>
              <select value={form.compania_id} onChange={(e) => set('compania_id', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {companias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Empresa facturadora *</label>
              <select value={form.empresa_facturadora_id} onChange={(e) => set('empresa_facturadora_id', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tipo de siniestro *</label>
              <select
                value={form.tipo_siniestro}
                onChange={(e) => set('tipo_siniestro', e.target.value)}
                required
                disabled={!form.compania_id}
              >
                <option value="">
                  {form.compania_id ? 'Seleccionar...' : 'Seleccione compañía primero'}
                </option>
                {tipos.map((t: any) => (
                  <option key={t.id} value={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nº Póliza</label>
              <input value={form.numero_poliza} onChange={(e) => set('numero_poliza', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Nº Siniestro Cía</label>
              <input value={form.numero_siniestro_cia} onChange={(e) => set('numero_siniestro_cia', e.target.value)} />
            </div>
            <div className="form-group">
              <label>
                Nº Expediente
                {sugerencia?.autonumero_activo && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)', marginLeft: 6 }}>
                    (auto-sugerido)
                  </span>
                )}
              </label>
              <input
                value={form.numero_expediente}
                onChange={(e) => {
                  numeroModoRef.current = 'manual';
                  set('numero_expediente', e.target.value);
                }}
                placeholder={
                  !form.compania_id
                    ? 'Seleccione compañía primero'
                    : sugerencia?.autonumero_activo
                    ? sugerencia.sugerido ?? 'Cargando sugerencia...'
                    : 'Introducir manualmente'
                }
                disabled={!form.compania_id}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Descripción *</label>
            <textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} required rows={3} />
          </div>
          <div className="form-group">
            <label>Declaración de siniestro</label>
            <textarea
              value={form.declaracion_siniestro}
              onChange={(e) => set('declaracion_siniestro', e.target.value)}
              rows={4}
              placeholder="Relato del siniestro según el asegurado o la compañía..."
            />
          </div>
        </section>

        {/* ─── Asegurado ─── */}
        <section className="form-section">
          <h3>Asegurado</h3>
          <div className="form-group">
            <div className="toggle-group">
              <button type="button" className={`toggle-btn ${aseguradoMode === 'new' ? 'active' : ''}`} onClick={() => setAseguradoMode('new')}>
                Nuevo asegurado
              </button>
              <button type="button" className={`toggle-btn ${aseguradoMode === 'existing' ? 'active' : ''}`} onClick={() => setAseguradoMode('existing')}>
                Buscar existente
              </button>
            </div>
          </div>

          {aseguradoMode === 'existing' ? (
            <div>
              <div className="form-group">
                <label>Buscar por nombre, teléfono o NIF</label>
                <input value={aseguradoSearch} onChange={(e) => setAseguradoSearch(e.target.value)} placeholder="Escriba al menos 2 caracteres..." />
              </div>
              {asegurados.length > 0 && (
                <div className="asegurado-results">
                  {asegurados.map((a: any) => (
                    <div
                      key={a.id}
                      className={`asegurado-option ${selectedAseguradoId === a.id ? 'selected' : ''}`}
                      onClick={() => setSelectedAseguradoId(a.id)}
                    >
                      <strong>{a.nombre} {a.apellidos}</strong>
                      <span>{a.telefono} — {a.direccion}, {a.localidad}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-group"><label>Nombre *</label><input value={form.aseg_nombre} onChange={(e) => set('aseg_nombre', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Apellidos *</label><input value={form.aseg_apellidos} onChange={(e) => set('aseg_apellidos', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Teléfono *</label><input value={form.aseg_telefono} onChange={(e) => set('aseg_telefono', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Teléfono 2</label><input value={form.aseg_telefono2} onChange={(e) => set('aseg_telefono2', e.target.value)} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.aseg_email} onChange={(e) => set('aseg_email', e.target.value)} /></div>
              <div className="form-group"><label>NIF</label><input value={form.aseg_nif} onChange={(e) => set('aseg_nif', e.target.value)} /></div>
              <div className="form-group span-2"><label>Dirección *</label><input value={form.aseg_direccion} onChange={(e) => set('aseg_direccion', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Código postal *</label><input value={form.aseg_cp} onChange={(e) => set('aseg_cp', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Localidad *</label><input value={form.aseg_localidad} onChange={(e) => set('aseg_localidad', e.target.value)} required={aseguradoMode === 'new'} /></div>
              <div className="form-group"><label>Provincia *</label><input value={form.aseg_provincia} onChange={(e) => set('aseg_provincia', e.target.value)} required={aseguradoMode === 'new'} /></div>
            </div>
          )}
        </section>

        {/* ─── Dirección del siniestro ─── */}
        <section className="form-section">
          <h3>
            Dirección del siniestro
            {aseguradoMode === 'new' && form.aseg_direccion && (
              <button type="button" className="btn-link" onClick={copyAddressFromAsegurado}>Copiar del asegurado</button>
            )}
          </h3>
          <div className="form-grid">
            <div className="form-group span-2"><label>Dirección *</label><input value={form.direccion_siniestro} onChange={(e) => set('direccion_siniestro', e.target.value)} required /></div>
            <div className="form-group"><label>Código postal *</label><input value={form.codigo_postal} onChange={(e) => set('codigo_postal', e.target.value)} required /></div>
            <div className="form-group"><label>Localidad *</label><input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} required /></div>
            <div className="form-group"><label>Provincia *</label><input value={form.provincia} onChange={(e) => set('provincia', e.target.value)} required /></div>
          </div>
        </section>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/expedientes')}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creando...' : 'Crear expediente'}
          </button>
        </div>
      </form>
    </div>
  );
}
