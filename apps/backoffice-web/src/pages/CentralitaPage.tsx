import { useState } from 'react';
import { Phone, Save, Search, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { useCentralitaConfig, useUpdateCentralitaConfig, useCentralitaLlamadas } from '@/hooks/useCentralita';
import { useEmpresasFacturadoras } from '@/hooks/useMasters';

type Tab = 'llamadas' | 'config';

const TIPO_ICON: Record<string, React.ReactNode> = {
  entrante: <PhoneIncoming size={13} style={{ color: '#22c55e' }} />,
  saliente: <PhoneOutgoing size={13} style={{ color: '#3b82f6' }} />,
  perdida:  <PhoneMissed  size={13} style={{ color: '#ef4444' }} />,
};
const TIPO_LABEL: Record<string, string> = { entrante: 'Entrante', saliente: 'Saliente', perdida: 'Perdida' };
const TIPO_BADGE: Record<string, string> = { entrante: 'badge-success', saliente: 'badge-info', perdida: 'badge-danger' };

function formatDuration(secs: number | null): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CentralitaPage() {
  const [tab, setTab] = useState<Tab>('llamadas');
  const { data: resEmpresas } = useEmpresasFacturadoras();
  const empresas: any[] = resEmpresas?.data ?? [];
  const empresaId = empresas[0]?.id;

  // Llamadas filters
  const [filtroTipo, setFiltroTipo] = useState('');
  const [search, setSearch] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: resLlamadas, isLoading: loadingLlamadas } = useCentralitaLlamadas({
    tipo: filtroTipo || undefined,
    search: search || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
  });

  const { data: resConfig, isLoading: loadingConfig } = useCentralitaConfig(empresaId);
  const updateConfig = useUpdateCentralitaConfig(empresaId ?? '');

  const llamadas: any[] = resLlamadas?.data ?? [];
  const config = resConfig?.data;

  const [cfgForm, setCfgForm] = useState({ proveedor: '', activa: false });
  if (config && cfgForm.proveedor !== (config.proveedor ?? '') && !updateConfig.isPending) {
    setCfgForm({ proveedor: config.proveedor ?? '', activa: config.activa });
  }

  async function handleSaveConfig(ev: React.FormEvent) {
    ev.preventDefault();
    await updateConfig.mutateAsync({ proveedor: cfgForm.proveedor || null, activa: cfgForm.activa });
  }

  return (
    <div className="page-stub">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={20} /> Centralita</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Registro de llamadas e integración con centralita telefónica</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border-default)', marginBottom: 24 }}>
        {([['llamadas', 'Informe de Llamadas'], ['config', 'Configuración']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab: Llamadas */}
      {tab === 'llamadas' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-control" style={{ width: 150 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todas</option>
              <option value="entrante">Entrantes</option>
              <option value="saliente">Salientes</option>
              <option value="perdida">Perdidas</option>
            </select>
            <input type="date" className="form-control" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>—</span>
            <input type="date" className="form-control" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input className="form-control" style={{ paddingLeft: 32, width: 200 }} placeholder="Buscar origen/destino..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {loadingLlamadas ? <div className="loading">Cargando llamadas...</div> : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Tipo</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th style={{ textAlign: 'right' }}>Duración</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {llamadas.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0' }}>Sin llamadas registradas</td></tr>
                  )}
                  {llamadas.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${TIPO_BADGE[l.tipo]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {TIPO_ICON[l.tipo]}{TIPO_LABEL[l.tipo]}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{l.origen ?? '—'}</td>
                      <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{l.destino ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatDuration(l.duracion_segundos)}</td>
                      <td style={{ fontSize: 13 }}>{l.usuario?.email ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{new Date(l.iniciada_at).toLocaleString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Configuración */}
      {tab === 'config' && (
        loadingConfig ? <div className="loading">Cargando...</div> : (
          <form onSubmit={handleSaveConfig} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--color-bg-subtle)', borderRadius: 10, border: '1px solid var(--color-border-default)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Integración activa</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Centralita conectada al ERP</div>
                </div>
                <input type="checkbox" checked={cfgForm.activa} onChange={(e) => setCfgForm(p => ({ ...p, activa: e.target.checked }))} style={{ width: 18, height: 18 }} />
              </div>

              <div className="form-group-v2">
                <label className="form-label">Proveedor de centralita</label>
                <select className="form-control" value={cfgForm.proveedor} onChange={(e) => setCfgForm(p => ({ ...p, proveedor: e.target.value }))}>
                  <option value="">Sin integración</option>
                  <option value="asterisk">Asterisk / FreePBX</option>
                  <option value="3cx">3CX</option>
                  <option value="ringcentral">RingCentral</option>
                  <option value="cloudtalk">CloudTalk</option>
                  <option value="aircall">Aircall</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {cfgForm.proveedor && (
                <div style={{ background: 'var(--color-bg-muted)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  La configuración avanzada (webhooks, extensiones, tokens) se realiza directamente en el panel de tu proveedor de centralita. Consulta la documentación de integración.
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={updateConfig.isPending}>
                <Save size={15} /> {updateConfig.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              {updateConfig.isSuccess && <p style={{ color: 'var(--color-success)', fontSize: 13, margin: 0 }}>Guardado correctamente</p>}
            </div>
          </form>
        )
      )}
    </div>
  );
}
