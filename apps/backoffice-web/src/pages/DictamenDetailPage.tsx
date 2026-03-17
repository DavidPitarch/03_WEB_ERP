import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDictamenDetail, useUpdateDictamen, useEmitirDictamen, useAddEvidenciaDictamen } from '@/hooks/usePeritos';

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'badge-dictamen-borrador',
  emitido: 'badge-dictamen-emitido',
  revisado: 'badge-dictamen-revisado',
  aceptado: 'badge-dictamen-aceptado',
  rechazado: 'badge-dictamen-rechazado',
};

export function DictamenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useDictamenDetail(id);
  const updateMut = useUpdateDictamen();
  const emitirMut = useEmitirDictamen();
  const addEvidenciaMut = useAddEvidenciaDictamen();

  const dictamen: any = data && 'data' in data ? data.data : null;
  const isBorrador = dictamen?.estado === 'borrador';

  const [form, setForm] = useState({
    tipo_dano: '',
    causa_dano: '',
    valoracion_danos: 0,
    valoracion_reparacion: 0,
    cobertura_aplicable: '',
    observaciones: '',
    recomendaciones: '',
    fecha_inspeccion: '',
  });

  useEffect(() => {
    if (dictamen) {
      setForm({
        tipo_dano: dictamen.tipo_dano ?? '',
        causa_dano: dictamen.causa_dano ?? '',
        valoracion_danos: dictamen.valoracion_danos ?? 0,
        valoracion_reparacion: dictamen.valoracion_reparacion ?? 0,
        cobertura_aplicable: dictamen.cobertura_aplicable ?? '',
        observaciones: dictamen.observaciones ?? '',
        recomendaciones: dictamen.recomendaciones ?? '',
        fecha_inspeccion: dictamen.fecha_inspeccion ?? '',
      });
    }
  }, [dictamen]);

  function handleSave() {
    if (!id) return;
    updateMut.mutate({ id, ...form });
  }

  function handleEmitir() {
    if (!id || !confirm('Emitir dictamen? Esta accion no se puede deshacer.')) return;
    emitirMut.mutate(id, {
      onSuccess: () => navigate('/peritos/dictamenes'),
    });
  }

  // Evidencia form state
  const [evForm, setEvForm] = useState({ storage_path: '', nombre_original: '', clasificacion: 'contexto', notas: '' });

  function handleAddEvidencia() {
    if (!id || !evForm.storage_path || !evForm.nombre_original) return;
    addEvidenciaMut.mutate({ id, ...evForm }, {
      onSuccess: () => setEvForm({ storage_path: '', nombre_original: '', clasificacion: 'contexto', notas: '' }),
    });
  }

  if (isLoading) return <div className="loading">Cargando dictamen...</div>;
  if (!dictamen) return <div className="empty-state">Dictamen no encontrado</div>;

  const evidencias: any[] = dictamen.evidencias_dictamen ?? [];
  const exp = dictamen.expedientes;

  return (
    <div className="page-dictamen-detail">
      <div className="page-header">
        <div>
          <h2>{dictamen.numero_dictamen}</h2>
          <span className={`badge ${ESTADO_BADGE[dictamen.estado] ?? ''}`}>{dictamen.estado}</span>
        </div>
        <button className="btn" onClick={() => navigate('/peritos/dictamenes')}>Volver</button>
      </div>

      {exp && (
        <div className="dashboard-section" style={{ marginBottom: '1rem' }}>
          <h3>Expediente</h3>
          <p><strong>{exp.numero_expediente}</strong> — {exp.tipo_siniestro} — {exp.estado}</p>
          <p>{exp.descripcion}</p>
        </div>
      )}

      <div className="dictamen-form">
        <div className="form-group">
          <label>Fecha de inspeccion</label>
          <input type="date" value={form.fecha_inspeccion} onChange={(e) => setForm({ ...form, fecha_inspeccion: e.target.value })} className="form-input" disabled={!isBorrador} />
        </div>

        <div className="form-group">
          <label>Tipo de dano</label>
          <input type="text" value={form.tipo_dano} onChange={(e) => setForm({ ...form, tipo_dano: e.target.value })} className="form-input" disabled={!isBorrador} />
        </div>

        <div className="form-group">
          <label>Causa del dano</label>
          <input type="text" value={form.causa_dano} onChange={(e) => setForm({ ...form, causa_dano: e.target.value })} className="form-input" disabled={!isBorrador} />
        </div>

        <div className="valoraciones-grid">
          <div className="form-group">
            <label>Valoracion danos (EUR)</label>
            <input type="number" step="0.01" value={form.valoracion_danos} onChange={(e) => setForm({ ...form, valoracion_danos: Number(e.target.value) })} className="form-input" disabled={!isBorrador} />
          </div>
          <div className="form-group">
            <label>Valoracion reparacion (EUR)</label>
            <input type="number" step="0.01" value={form.valoracion_reparacion} onChange={(e) => setForm({ ...form, valoracion_reparacion: Number(e.target.value) })} className="form-input" disabled={!isBorrador} />
          </div>
        </div>

        <div className="form-group">
          <label>Cobertura aplicable</label>
          <input type="text" value={form.cobertura_aplicable} onChange={(e) => setForm({ ...form, cobertura_aplicable: e.target.value })} className="form-input" disabled={!isBorrador} />
        </div>

        <div className="form-group">
          <label>Observaciones</label>
          <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="form-input" rows={4} disabled={!isBorrador} />
        </div>

        <div className="form-group">
          <label>Recomendaciones</label>
          <textarea value={form.recomendaciones} onChange={(e) => setForm({ ...form, recomendaciones: e.target.value })} className="form-input" rows={4} disabled={!isBorrador} />
        </div>

        {isBorrador && (
          <div className="action-bar">
            <button className="btn btn-primary" onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Guardando...' : 'Guardar borrador'}
            </button>
            <button className="btn btn-success" onClick={handleEmitir} disabled={emitirMut.isPending}>
              {emitirMut.isPending ? 'Emitiendo...' : 'Emitir dictamen'}
            </button>
          </div>
        )}
      </div>

      {/* Evidencias */}
      <div className="dashboard-section" style={{ marginTop: '1.5rem' }}>
        <h3>Evidencias ({evidencias.length})</h3>
        {evidencias.length > 0 && (
          <div className="evidencias-gallery">
            {evidencias.map((ev: any) => (
              <div key={ev.id} className="evidencia-card">
                <div className="evidencia-nombre">{ev.nombre_original}</div>
                <span className="badge">{ev.clasificacion}</span>
                {ev.notas && <p className="evidencia-notas">{ev.notas}</p>}
              </div>
            ))}
          </div>
        )}

        {isBorrador && (
          <div style={{ marginTop: '1rem' }}>
            <h4>Agregar evidencia</h4>
            <div className="filters-bar">
              <input type="text" placeholder="Storage path" value={evForm.storage_path} onChange={(e) => setEvForm({ ...evForm, storage_path: e.target.value })} className="form-input" />
              <input type="text" placeholder="Nombre original" value={evForm.nombre_original} onChange={(e) => setEvForm({ ...evForm, nombre_original: e.target.value })} className="form-input" />
              <select value={evForm.clasificacion} onChange={(e) => setEvForm({ ...evForm, clasificacion: e.target.value })} className="filter-select">
                <option value="dano">Dano</option>
                <option value="causa">Causa</option>
                <option value="contexto">Contexto</option>
                <option value="detalle">Detalle</option>
              </select>
              <button className="btn btn-primary" onClick={handleAddEvidencia} disabled={addEvidenciaMut.isPending}>Agregar</button>
            </div>
          </div>
        )}
      </div>

      {dictamen.emitido_at && (
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Emitido el {new Date(dictamen.emitido_at).toLocaleString('es-ES')}
        </p>
      )}
    </div>
  );
}
