import { useState } from 'react';
import { useReglasReparto, useActivarReglaReparto, useCrearReglaReparto } from '@/hooks/useTramitadores';

const TIPO_LABELS: Record<string, string> = {
  manual:       'Manual (sugerencias)',
  round_robin:  'Round-robin (menor carga)',
  weighted:     'Ponderado por capacidad',
  rule_based:   'Basado en reglas',
  sla_priority: 'Prioridad SLA',
};

const TIPO_DESC: Record<string, string> = {
  manual:       'Devuelve las 3 mejores sugerencias pero requiere decisión manual',
  round_robin:  'Asigna automáticamente al tramitador con menor porcentaje de carga',
  weighted:     'Distribuye en proporción a la capacidad libre de cada tramitador',
  rule_based:   'Evalúa condiciones configurables antes de aplicar el fallback',
  sla_priority: 'Para urgentes, prioriza tramitadores con menor carga de urgentes',
};

export function ReglasRepartoPage() {
  const { data: res, isLoading, refetch } = useReglasReparto();
  const activar = useActivarReglaReparto();
  const crear = useCrearReglaReparto();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'round_robin', descripcion: '', activa: false });
  const [formError, setFormError] = useState('');

  const reglas: any[] = res?.data ?? [];

  async function handleActivar(id: string) {
    await activar.mutateAsync(id);
    refetch();
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      await crear.mutateAsync(form);
      setShowModal(false);
      setForm({ nombre: '', tipo: 'round_robin', descripcion: '', activa: false });
      refetch();
    } catch (err: any) {
      setFormError(err.message ?? 'Error al crear regla');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Reglas de Reparto</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Algoritmo de asignación automática. Solo puede haber una regla activa por empresa.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva regla</button>
      </div>

      {isLoading ? (
        <div className="loading">Cargando reglas...</div>
      ) : reglas.length === 0 ? (
        <div style={{ color: 'var(--color-muted)', padding: '32px 0', textAlign: 'center' }}>
          Sin reglas configuradas. Crea una para activar la asignación automática.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reglas.map((r: any) => (
            <div
              key={r.id}
              style={{
                border: `2px solid ${r.activa ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 10,
                padding: '16px 20px',
                background: r.activa ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.nombre}</span>
                  {r.activa && (
                    <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                      ACTIVA
                    </span>
                  )}
                  <span className="badge badge-default" style={{ fontSize: 11 }}>
                    {TIPO_LABELS[r.tipo] ?? r.tipo}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {r.descripcion || TIPO_DESC[r.tipo]}
                </div>
                {r.empresas_facturadoras && (
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                    Empresa: {r.empresas_facturadoras.nombre}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!r.activa && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={() => handleActivar(r.id)}
                    disabled={activar.isPending}
                  >
                    Activar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info sobre el motor */}
      <div style={{ marginTop: 32, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '16px 20px' }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Orden de evaluación del motor de asignación</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.8 }}>
          <li><strong>Preasignaciones</strong>: reglas específicas por tramitador (compañía, tipo, zona, prioridad)</li>
          <li><strong>Regla de reparto activa</strong>: algoritmo configurado aquí</li>
          <li><strong>Fallback</strong>: tramitador con menor carga absoluta</li>
          <li><strong>Cola sin asignar</strong>: si ninguno tiene capacidad, entra en la cola</li>
        </ol>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Nueva regla de reparto</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCrear}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {formError && <div className="alert alert-error">{formError}</div>}
                <label className="form-field">
                  <span>Nombre *</span>
                  <input className="form-input" value={form.nombre} required
                    onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} />
                </label>
                <label className="form-field">
                  <span>Algoritmo *</span>
                  <select className="form-input" value={form.tipo}
                    onChange={(e) => setForm(p => ({ ...p, tipo: e.target.value }))}>
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, display: 'block' }}>
                    {TIPO_DESC[form.tipo]}
                  </span>
                </label>
                <label className="form-field">
                  <span>Descripción</span>
                  <textarea className="form-input" rows={2} value={form.descripcion}
                    onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    style={{ resize: 'vertical' }} />
                </label>
                <label className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.activa}
                    onChange={(e) => setForm(p => ({ ...p, activa: e.target.checked }))} />
                  <span>Activar inmediatamente (desactiva la regla actual)</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={crear.isPending}>
                  {crear.isPending ? 'Creando...' : 'Crear regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
