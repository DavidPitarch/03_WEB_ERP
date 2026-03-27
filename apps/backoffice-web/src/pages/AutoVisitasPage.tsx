import { useState } from 'react';
import { Link2, Save, Settings } from 'lucide-react';
import { useAutoVisitasConfig, useUpdateAutoVisitas } from '@/hooks/useAutoVisitas';
import { useEmpresasFacturadoras } from '@/hooks/useMasters';

type Tab = 'general' | 'operarios' | 'companias';

export function AutoVisitasPage() {
  const [tab, setTab] = useState<Tab>('general');
  const { data: resEmpresas } = useEmpresasFacturadoras();
  const empresas: any[] = resEmpresas?.data ?? [];
  const empresaId = empresas[0]?.id;

  const { data: resConfig, isLoading } = useAutoVisitasConfig(empresaId);
  const update = useUpdateAutoVisitas(empresaId ?? '');

  const config = resConfig?.data;

  const [form, setForm] = useState({
    activo: false,
    horas_aviso_previo: 24,
    max_cambios_cita: 2,
    permitir_cancelacion: true,
    horas_min_cancelacion: 2,
  });

  // Sync when config loads
  if (config && form.horas_aviso_previo !== config.horas_aviso_previo && !update.isPending) {
    setForm({
      activo: config.activo,
      horas_aviso_previo: config.horas_aviso_previo,
      max_cambios_cita: config.max_cambios_cita,
      permitir_cancelacion: config.permitir_cancelacion,
      horas_min_cancelacion: config.horas_min_cancelacion,
    });
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    await update.mutateAsync(form);
  }

  return (
    <div className="page-stub">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Link2 size={20} /> Auto Visitas</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Configuración del portal de cita automática para asegurados y operarios</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border-default)', marginBottom: 24 }}>
        {([['general', 'General'], ['operarios', 'Operarios'], ['companias', 'Compañías']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {isLoading ? <div className="loading">Cargando configuración...</div> : (
        <>
          {/* Tab: General */}
          {tab === 'general' && (
            <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--color-bg-subtle)', borderRadius: 10, border: '1px solid var(--color-border-default)', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Sistema de Auto Visitas</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Permitir a asegurados gestionar citas de forma autónoma</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm(p => ({ ...p, activo: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  <span style={{ fontWeight: 600 }}>{form.activo ? 'Activo' : 'Inactivo'}</span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: form.activo ? 1 : 0.5, pointerEvents: form.activo ? 'auto' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group-v2">
                    <label className="form-label">Horas de aviso previo</label>
                    <input className="form-control" type="number" min={1} value={form.horas_aviso_previo} onChange={(e) => setForm(p => ({ ...p, horas_aviso_previo: parseInt(e.target.value) || 24 }))} />
                    <div className="form-hint">Horas mínimas entre solicitud y cita</div>
                  </div>
                  <div className="form-group-v2">
                    <label className="form-label">Cambios máximos de cita</label>
                    <input className="form-control" type="number" min={0} value={form.max_cambios_cita} onChange={(e) => setForm(p => ({ ...p, max_cambios_cita: parseInt(e.target.value) || 2 }))} />
                    <div className="form-hint">Por expediente y asegurado</div>
                  </div>
                </div>

                <div style={{ padding: '16px 20px', background: 'var(--color-bg-subtle)', borderRadius: 8, border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>Permitir cancelación</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>El asegurado puede cancelar citas programadas</div>
                    </div>
                    <input type="checkbox" checked={form.permitir_cancelacion} onChange={(e) => setForm(p => ({ ...p, permitir_cancelacion: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  </label>
                  {form.permitir_cancelacion && (
                    <div className="form-group-v2" style={{ margin: 0 }}>
                      <label className="form-label">Horas mínimas para cancelar</label>
                      <input className="form-control" type="number" min={0} style={{ width: 120 }} value={form.horas_min_cancelacion} onChange={(e) => setForm(p => ({ ...p, horas_min_cancelacion: parseInt(e.target.value) || 2 }))} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={update.isPending}>
                  <Save size={15} /> {update.isPending ? 'Guardando...' : 'Guardar configuración'}
                </button>
                {update.isSuccess && <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 8 }}>Guardado correctamente</p>}
              </div>
            </form>
          )}

          {/* Tab: Operarios */}
          {tab === 'operarios' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
              <Settings size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>La configuración por operario permitirá activar/desactivar autocita para operarios individuales.</p>
              <p style={{ fontSize: 13 }}>Requiere integración con el módulo de Operarios (FASE B).</p>
            </div>
          )}

          {/* Tab: Compañías */}
          {tab === 'companias' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
              <Settings size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>La configuración por compañía permitirá activar/desactivar autocita por compañía aseguradora.</p>
              <p style={{ fontSize: 13 }}>Requiere integración con el módulo de Compañías (FASE B).</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
