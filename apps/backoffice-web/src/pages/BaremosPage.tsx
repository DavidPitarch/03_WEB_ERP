import { useState, useRef } from 'react';
import { useBaremos, useBaremoPartidas, useImportBaremoCsv } from '@/hooks/useBaremos';
import { useCompanias } from '@/hooks/useMasters';

export function BaremosPage() {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [selectedBaremo, setSelectedBaremo] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filters: Record<string, string> = {};
  if (filtroTipo) filters.tipo = filtroTipo;

  const { data: res, isLoading } = useBaremos(filters);
  const items = res && 'data' in res ? (res.data ?? []) as any[] : [];

  return (
    <div className="page-baremos">
      <div className="page-header">
        <h2>Baremos</h2>
        <button className="btn btn-primary" onClick={() => setShowImport(true)}>Importar CSV</button>
      </div>

      <div className="filters-bar">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="compania">Compania</option>
          <option value="operario">Operario</option>
        </select>
      </div>

      {isLoading ? (
        <div className="loading">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay baremos. Importa uno desde CSV.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Version</th>
              <th>Vigente desde</th>
              <th>Vigente hasta</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.nombre}</strong></td>
                <td><span className={`badge badge-${b.tipo ?? 'compania'}`}>{b.tipo ?? 'compania'}</span></td>
                <td>v{b.version}</td>
                <td>{b.vigente_desde}</td>
                <td>{b.vigente_hasta ?? '—'}</td>
                <td>{b.activo ? 'Si' : 'No'}</td>
                <td><button className="btn-link" onClick={() => setSelectedBaremo(b.id)}>Ver partidas</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showImport && <ImportCsvModal onClose={() => setShowImport(false)} />}
      {selectedBaremo && <PartidasModal baremoId={selectedBaremo} onClose={() => setSelectedBaremo(null)} />}
    </div>
  );
}

function ImportCsvModal({ onClose }: { onClose: () => void }) {
  const importCsv = useImportBaremoCsv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<{
    compania_id: string;
    nombre: string;
    tipo: 'compania' | 'operario';
    vigente_desde: string;
    operario_id: string;
  }>({ compania_id: '', nombre: '', tipo: 'compania', vigente_desde: '', operario_id: '' });
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<{ partidas_count: number; errors: string[] } | null>(null);
  const { data: companiasRes } = useCompanias();
  const companias = companiasRes && 'data' in companiasRes ? (companiasRes.data ?? []) as any[] : [];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText) return;
    const res = await importCsv.mutateAsync({
      compania_id: form.compania_id,
      nombre: form.nombre,
      tipo: form.tipo as 'compania' | 'operario',
      operario_id: form.tipo === 'operario' ? form.operario_id : undefined,
      vigente_desde: form.vigente_desde,
      csv_text: csvText,
    });
    if (res && 'data' in res && res.data) {
      setResult(res.data);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Importar baremo desde CSV</h3><button className="btn-close" onClick={onClose}>&times;</button></div>
        {result ? (
          <div className="import-result">
            <p className="text-success">Importadas {result.partidas_count} partidas correctamente.</p>
            {result.errors.length > 0 && (
              <div className="import-errors">
                <p className="text-danger">{result.errors.length} errores:</p>
                <ul>{result.errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}</ul>
              </div>
            )}
            <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
              <div className="form-group">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as 'compania' | 'operario' })}>
                  <option value="compania">Compania</option>
                  <option value="operario">Operario</option>
                </select>
              </div>
              <div className="form-group"><label>Compañía *</label>
                <select value={form.compania_id} onChange={(e) => setForm({ ...form, compania_id: e.target.value })} required>
                  <option value="">Seleccionar compañía...</option>
                  {companias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Vigente desde *</label><input type="date" value={form.vigente_desde} onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })} required /></div>
              {form.tipo === 'operario' && (
                <div className="form-group"><label>Operario ID</label><input value={form.operario_id} onChange={(e) => setForm({ ...form, operario_id: e.target.value })} placeholder="UUID" /></div>
              )}
            </div>
            <div className="form-group">
              <label>Archivo CSV *</label>
              <input type="file" accept=".csv" ref={fileRef} onChange={handleFile} />
              {csvText && <p className="text-muted">{csvText.split('\n').length} lineas cargadas</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={importCsv.isPending || !csvText}>
                {importCsv.isPending ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PartidasModal({ baremoId, onClose }: { baremoId: string; onClose: () => void }) {
  const [filtroEsp, setFiltroEsp] = useState('');
  const { data: res, isLoading } = useBaremoPartidas(baremoId, filtroEsp || undefined);
  const items = res && 'data' in res ? (res.data ?? []) as any[] : [];

  const especialidades = [...new Set(items.map((p) => p.especialidad).filter(Boolean))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Partidas del baremo ({items.length})</h3><button className="btn-close" onClick={onClose}>&times;</button></div>
        <div className="filters-bar">
          <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)}>
            <option value="">Todas las especialidades</option>
            {especialidades.map((esp) => <option key={esp} value={esp}>{esp}</option>)}
          </select>
        </div>
        {isLoading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <div className="partidas-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Especialidad</th>
                  <th>Precio unitario</th>
                  <th>Precio operario</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td><code>{p.codigo}</code></td>
                    <td>{p.descripcion}</td>
                    <td>{p.especialidad ?? '—'}</td>
                    <td className="text-right">{p.precio_unitario ? `${Number(p.precio_unitario).toFixed(2)} EUR` : '—'}</td>
                    <td className="text-right">{p.precio_operario ? `${Number(p.precio_operario).toFixed(2)} EUR` : '—'}</td>
                    <td>{p.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
