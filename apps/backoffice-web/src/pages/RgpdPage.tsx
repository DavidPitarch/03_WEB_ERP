import { useState } from 'react';
import { Shield, Save, Trash2, AlertTriangle } from 'lucide-react';
import { useRgpdConfig, useUpdateRgpdConfig, useRgpdEliminaciones, useCreateRgpdEliminacion } from '@/hooks/useRgpd';
import { useEmpresasFacturadoras } from '@/hooks/useMasters';

type Tab = 'config' | 'eliminacion' | 'registros';

const EMPRESA_PLACEHOLDER = 'default';

export function RgpdPage() {
  const [tab, setTab] = useState<Tab>('config');
  const { data: resEmpresas } = useEmpresasFacturadoras();
  const empresas: any[] = resEmpresas?.data ?? [];
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? EMPRESA_PLACEHOLDER);

  const { data: resConfig, isLoading: loadingConfig } = useRgpdConfig(empresaId !== EMPRESA_PLACEHOLDER ? empresaId : undefined);
  const updateConfig = useUpdateRgpdConfig(empresaId);
  const { data: resEliminaciones, isLoading: loadingEliminaciones } = useRgpdEliminaciones();
  const createEliminacion = useCreateRgpdEliminacion();

  const configData = resConfig?.data;

  const [form, setForm] = useState({
    dias_conservacion_expedientes: configData?.dias_conservacion_expedientes ?? 365,
    dias_conservacion_comunicaciones: configData?.dias_conservacion_comunicaciones ?? 180,
    dias_conservacion_evidencias: configData?.dias_conservacion_evidencias ?? 365,
    dias_conservacion_facturas: configData?.dias_conservacion_facturas ?? 2555,
    texto_politica: configData?.texto_politica ?? '',
  });

  // Sync form when config loads
  if (configData && form.dias_conservacion_expedientes !== configData.dias_conservacion_expedientes && !updateConfig.isPending) {
    setForm({
      dias_conservacion_expedientes: configData.dias_conservacion_expedientes,
      dias_conservacion_comunicaciones: configData.dias_conservacion_comunicaciones,
      dias_conservacion_evidencias: configData.dias_conservacion_evidencias,
      dias_conservacion_facturas: configData.dias_conservacion_facturas,
      texto_politica: configData.texto_politica ?? '',
    });
  }

  const [elimForm, setElimForm] = useState({ entidad: 'asegurado', entidad_id: '', motivo: '' });
  const [elimError, setElimError] = useState('');
  const [elimSuccess, setElimSuccess] = useState('');

  const eliminaciones: any[] = resEliminaciones?.data ?? [];

  async function handleSaveConfig(ev: React.FormEvent) {
    ev.preventDefault();
    await updateConfig.mutateAsync(form);
  }

  async function handleEliminacion(ev: React.FormEvent) {
    ev.preventDefault();
    setElimError('');
    setElimSuccess('');
    if (!elimForm.entidad_id.trim()) { setElimError('El ID de la entidad es obligatorio'); return; }
    try {
      await createEliminacion.mutateAsync({ entidad: elimForm.entidad, entidad_id: elimForm.entidad_id.trim(), motivo: elimForm.motivo || undefined });
      setElimSuccess('Registro de eliminación creado correctamente');
      setElimForm({ entidad: 'asegurado', entidad_id: '', motivo: '' });
    } catch (err: any) { setElimError(err.message ?? 'Error al registrar'); }
  }

  return (
    <div className="page-stub">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={20} /> RGPD</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Gestión de protección de datos personales, conservación y derechos de supresión</p>
      </div>

      {/* Selector empresa */}
      {empresas.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select className="form-control" style={{ width: 280 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border-default)', marginBottom: 24 }}>
        {([['config', 'Configuración'], ['eliminacion', 'Solicitud de Eliminación'], ['registros', 'Registros']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab: Config */}
      {tab === 'config' && (
        loadingConfig ? <div className="loading">Cargando...</div> : (
          <form onSubmit={handleSaveConfig} style={{ maxWidth: 600 }}>
            <div className="form-section-v2" style={{ marginBottom: 24 }}>
              <div className="form-section-v2__title">Períodos de conservación de datos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'dias_conservacion_expedientes', label: 'Expedientes' },
                  { key: 'dias_conservacion_comunicaciones', label: 'Comunicaciones' },
                  { key: 'dias_conservacion_evidencias', label: 'Evidencias (fotos/documentos)' },
                  { key: 'dias_conservacion_facturas', label: 'Facturas (obligación legal: mín. 2555 días / 7 años)' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <label className="form-label" style={{ margin: 0, width: 280, flexShrink: 0 }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        style={{ width: 100 }}
                        value={(form as any)[key]}
                        onChange={(e) => setForm(p => ({ ...p, [key]: parseInt(e.target.value) || 365 }))}
                      />
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>días</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                        (~{Math.round((form as any)[key] / 365 * 10) / 10} años)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group-v2" style={{ marginBottom: 24 }}>
              <label className="form-label">Texto de política de privacidad</label>
              <textarea className="form-control" rows={5} value={form.texto_politica} onChange={(e) => setForm(p => ({ ...p, texto_politica: e.target.value }))} placeholder="Texto de la política de privacidad que se muestra a los usuarios..." />
            </div>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={updateConfig.isPending}>
              <Save size={15} /> {updateConfig.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {updateConfig.isSuccess && <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 8 }}>Configuración guardada correctamente</p>}
          </form>
        )
      )}

      {/* Tab: Solicitud de eliminación */}
      {tab === 'eliminacion' && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ background: 'var(--color-warning-bg, #fef3c7)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, marginBottom: 20 }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-warning, #f59e0b)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Esta acción registra la supresión de datos personales en cumplimiento del derecho al olvido (RGPD Art. 17). La eliminación física debe realizarse manualmente o mediante proceso automático.</p>
          </div>
          <form onSubmit={handleEliminacion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {elimError && <div className="alert alert-error">{elimError}</div>}
            {elimSuccess && <div className="alert alert-success">{elimSuccess}</div>}
            <div className="form-group-v2">
              <label className="form-label required">Tipo de entidad</label>
              <select className="form-control" value={elimForm.entidad} onChange={(e) => setElimForm(p => ({ ...p, entidad: e.target.value }))}>
                <option value="asegurado">Asegurado</option>
                <option value="operario">Operario</option>
                <option value="comercial">Comercial</option>
                <option value="tramitador">Tramitador</option>
                <option value="perito">Perito</option>
              </select>
            </div>
            <div className="form-group-v2">
              <label className="form-label required">ID del registro</label>
              <input className="form-control" value={elimForm.entidad_id} onChange={(e) => setElimForm(p => ({ ...p, entidad_id: e.target.value }))} placeholder="UUID del registro a eliminar" style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group-v2">
              <label className="form-label">Motivo de la eliminación</label>
              <textarea className="form-control" rows={3} value={elimForm.motivo} onChange={(e) => setElimForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ejercicio del derecho al olvido, baja voluntaria, etc." />
            </div>
            <button type="submit" className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={createEliminacion.isPending}>
              <Trash2 size={15} /> {createEliminacion.isPending ? 'Registrando...' : 'Registrar eliminación'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Registros */}
      {tab === 'registros' && (
        loadingEliminaciones ? <div className="loading">Cargando registros...</div> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th>ID</th>
                  <th>Motivo</th>
                  <th>Actor</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {eliminaciones.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin registros de eliminación</td></tr>
                )}
                {eliminaciones.map((e: any) => (
                  <tr key={e.id}>
                    <td><span className="badge badge-default">{e.entidad}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.entidad_id}</td>
                    <td style={{ fontSize: 13 }}>{e.motivo ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{e.actor?.email ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{new Date(e.eliminado_at).toLocaleString('es-ES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
