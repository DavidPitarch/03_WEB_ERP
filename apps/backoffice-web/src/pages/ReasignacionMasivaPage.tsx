import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useTramitadores,
  useTramitadorExpedientes,
  useReasignacionMasiva,
} from '@/hooks/useTramitadores';

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', media: '#f59e0b', baja: '#6b7280',
};

const MOTIVOS = [
  { codigo: 'baja_tramitador',    label: 'Baja del tramitador' },
  { codigo: 'exceso_carga',       label: 'Exceso de carga de trabajo' },
  { codigo: 'especializacion',    label: 'Requiere especialización' },
  { codigo: 'conflicto_interes',  label: 'Conflicto de interés' },
  { codigo: 'vacaciones',         label: 'Vacaciones / ausencia' },
  { codigo: 'solicitud_compania', label: 'Solicitud de la compañía' },
  { codigo: 'reorg_interna',      label: 'Reorganización interna' },
  { codigo: 'otro',               label: 'Otro (especificar)' },
];

export function ReasignacionMasivaPage() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [origenId, setOrigenId] = useState(searchParams.get('origen') ?? '');
  const [destinoId, setDestinoId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: tramRes } = useTramitadores(undefined, true);
  const { data: expRes, isLoading: loadingExp } = useTramitadorExpedientes(origenId, { page: 1 });
  const reasignar = useReasignacionMasiva();

  const tramitadores: any[] = tramRes?.data ?? [];
  const expedientes: any[] = expRes?.data?.items ?? [];

  const tramDestino = tramitadores.find(t => t.tramitador_id === destinoId);

  function toggleAll() {
    if (selected.size === expedientes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expedientes.map((e: any) => e.id)));
    }
  }

  function toggleExp(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleConfirmar() {
    setError('');
    if (!motivo.trim() && motivoCodigo !== 'otro') {
      const m = MOTIVOS.find(x => x.codigo === motivoCodigo);
      setMotivo(m?.label ?? '');
    }
    try {
      const res = await reasignar.mutateAsync({
        tramitador_origen_id: origenId || undefined,
        tramitador_destino_id: destinoId,
        expediente_ids: Array.from(selected),
        motivo: motivo.trim() || MOTIVOS.find(x => x.codigo === motivoCodigo)?.label || motivoCodigo,
        motivo_codigo: motivoCodigo || undefined,
      });
      setResult(res?.data);
      setStep(3);
    } catch (err: any) {
      setError(err.message ?? 'Error en la reasignación');
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Reasignación Masiva</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Reasignar expedientes entre tramitadores con trazabilidad completa</p>
        </div>
        <Link to="/usuarios/cargas" className="btn btn-secondary">Volver</Link>
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {[['1', 'Origen y expedientes'], ['2', 'Destino y motivo'], ['3', 'Resultado']].map(([n, label], i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: step >= parseInt(n) ? 'var(--color-primary)' : '#e5e7eb',
                color: step >= parseInt(n) ? '#fff' : 'var(--color-muted)',
              }}>{n}</div>
              <span style={{ fontSize: 13, fontWeight: step === parseInt(n) ? 600 : 400, color: step >= parseInt(n) ? 'var(--color-foreground)' : 'var(--color-muted)' }}>
                {label}
              </span>
            </div>
            {i < 2 && <div style={{ width: 40, height: 2, background: step > i + 1 ? 'var(--color-primary)' : '#e5e7eb', margin: '0 12px' }} />}
          </div>
        ))}
      </div>

      {/* PASO 1: Origen y selección de expedientes */}
      {step === 1 && (
        <div>
          <div className="form-field" style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Tramitador de origen</label>
            <select className="form-input" value={origenId} onChange={(e) => { setOrigenId(e.target.value); setSelected(new Set()); }}
              style={{ maxWidth: 360 }}>
              <option value="">— Seleccionar origen —</option>
              {tramitadores.map((t: any) => (
                <option key={t.tramitador_id} value={t.tramitador_id}>
                  {t.nombre_completo} ({t.total_activos} activos)
                </option>
              ))}
            </select>
          </div>

          {origenId && (
            <>
              {loadingExp ? (
                <div className="loading">Cargando expedientes...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                      {expedientes.length} expedientes activos — {selected.size} seleccionados
                    </span>
                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={toggleAll}>
                      {selected.size === expedientes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}></th>
                          <th>Expediente</th>
                          <th>Compañía</th>
                          <th>Estado</th>
                          <th>Prioridad</th>
                          <th>SLA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expedientes.map((e: any) => (
                          <tr key={e.id} onClick={() => toggleExp(e.id)} style={{ cursor: 'pointer', background: selected.has(e.id) ? 'var(--color-primary-bg)' : undefined }}>
                            <td onClick={(ev) => { ev.stopPropagation(); toggleExp(e.id); }}>
                              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleExp(e.id)} />
                            </td>
                            <td style={{ fontWeight: 600 }}>{e.numero_expediente}</td>
                            <td style={{ fontSize: 13 }}>{e.companias?.nombre ?? '—'}</td>
                            <td><span className="badge badge-default" style={{ fontSize: 11 }}>{e.estado}</span></td>
                            <td style={{ fontSize: 12, fontWeight: 700, color: PRIORIDAD_COLOR[e.prioridad] }}>
                              {e.prioridad?.toUpperCase()}
                            </td>
                            <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                              {e.fecha_limite_sla ? new Date(e.fecha_limite_sla).toLocaleDateString('es-ES') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              className="btn btn-primary"
              disabled={selected.size === 0}
              onClick={() => setStep(2)}
            >
              Siguiente: Seleccionar destino ({selected.size} expedientes)
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Destino y motivo */}
      {step === 2 && (
        <div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>Resumen de selección</div>
            <strong>{selected.size} expedientes</strong> a reasignar desde{' '}
            <strong>{tramitadores.find(t => t.tramitador_id === origenId)?.nombre_completo ?? origenId}</strong>
          </div>

          <div style={{ display: 'flex', gap: 16, flexDirection: 'column', maxWidth: 480 }}>
            <div className="form-field">
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Tramitador de destino *</label>
              <select className="form-input" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">— Seleccionar destino —</option>
                {tramitadores
                  .filter(t => t.tramitador_id !== origenId)
                  .map((t: any) => (
                    <option key={t.tramitador_id} value={t.tramitador_id}>
                      {t.nombre_completo} — {t.total_activos}/{t.max_expedientes_activos} ({t.semaforo === 'rojo' ? '🔴 Lleno' : t.semaforo === 'amarillo' ? '🟡 Alerta' : '🟢 OK'})
                    </option>
                  ))}
              </select>
              {tramDestino && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-muted)' }}>
                  Carga proyectada tras reasignación:{' '}
                  <strong>{tramDestino.total_activos + selected.size}/{tramDestino.max_expedientes_activos}</strong>
                  {' '}({Math.round((tramDestino.total_activos + selected.size) / tramDestino.max_expedientes_activos * 100)}%)
                </div>
              )}
            </div>

            <div className="form-field">
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Motivo *</label>
              <select className="form-input" value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value)}>
                <option value="">— Seleccionar motivo —</option>
                {MOTIVOS.map(m => (
                  <option key={m.codigo} value={m.codigo}>{m.label}</option>
                ))}
              </select>
            </div>

            {(motivoCodigo === 'otro' || motivoCodigo) && (
              <div className="form-field">
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  {motivoCodigo === 'otro' ? 'Especificar motivo *' : 'Notas adicionales (opcional)'}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={motivo}
                  required={motivoCodigo === 'otro'}
                  placeholder={motivoCodigo === 'otro' ? 'Describir el motivo de la reasignación...' : ''}
                  onChange={(e) => setMotivo(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Volver</button>
            <button
              className="btn btn-primary"
              disabled={!destinoId || !motivoCodigo || (motivoCodigo === 'otro' && !motivo.trim()) || reasignar.isPending}
              onClick={handleConfirmar}
            >
              {reasignar.isPending ? 'Reasignando...' : `Confirmar reasignación de ${selected.size} expedientes`}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Resultado */}
      {step === 3 && result && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {result.fallidos?.length === 0 ? '✅' : '⚠️'}
          </div>
          <h3>Reasignación completada</h3>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 16 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 24px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{result.asignados}</div>
              <div style={{ fontSize: 13, color: '#16a34a' }}>Asignados</div>
            </div>
            {result.fallidos?.length > 0 && (
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: '12px 24px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{result.fallidos.length}</div>
                <div style={{ fontSize: 13, color: '#dc2626' }}>Fallidos</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
            Batch ID: <code style={{ fontSize: 11 }}>{result.batch_id}</code>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
            <Link to="/usuarios/cargas" className="btn btn-secondary">Panel de cargas</Link>
            <button className="btn btn-primary" onClick={() => { setStep(1); setSelected(new Set()); setResult(null); setOrigenId(''); setDestinoId(''); }}>
              Nueva reasignación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
