import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FolderOpen, Activity, CheckCircle2, Clock, Plus, ArrowRight } from 'lucide-react';
import { useDashboardKpis, useCompaniasKpisMes } from '@/hooks/useDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(v: number) {
  return v.toLocaleString('es-ES');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CompaniaRow {
  compania_id: string;
  compania_nombre: string;
  prefijo: string;
  nuevos_mes: number;
  cerrados_mes: number;
  en_curso: number;
  facturado_mes: number;
  coste_operario_mes: number;
}

// ─── Tarjeta de compañía ──────────────────────────────────────────────────────

function CompaniaCard({ row }: { row: CompaniaRow }) {
  return (
    <Link
      to={`/expedientes?compania=${row.compania_id}`}
      className="compania-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-accent)',
            background: 'var(--color-accent-subtle)',
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-sm)',
          }}>
            {row.prefijo}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>
            {row.compania_nombre}
          </span>
        </div>
        <ArrowRight size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
            {fmtNum(row.en_curso)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <Activity size={10} />
            En curso
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>
            {fmtNum(row.cerrados_mes)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <CheckCircle2 size={10} />
            Cerrados
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-warning)' }}>
            {fmtNum(row.nuevos_mes)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <Clock size={10} />
            Nuevos
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-default)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
    }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 40, height: 20, borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className="skeleton" style={{ width: 40, height: 28, borderRadius: 'var(--radius-sm)' }} />
            <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 'var(--radius-sm)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OperacionesEscritorioPage ─────────────────────────────────────────────────

export function OperacionesEscritorioPage() {
  const [search, setSearch] = useState('');
  const kpis = useDashboardKpis();
  const companias = useCompaniasKpisMes();

  const rows: CompaniaRow[] = (companias.data ?? []) as CompaniaRow[];
  const filtered = search.trim()
    ? rows.filter((r) => r.compania_nombre.toLowerCase().includes(search.toLowerCase()) || r.prefijo.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const totalEnCurso  = rows.reduce((s, r) => s + r.en_curso, 0);
  const totalNuevosMes = rows.reduce((s, r) => s + r.nuevos_mes, 0);
  const totalCerrados  = rows.reduce((s, r) => s + r.cerrados_mes, 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <FolderOpen size={20} style={{ color: 'var(--color-accent)' }} />
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Escritorio
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Módulo de Operaciones — vista por compañía
            </p>
          </div>
        </div>

        <Link
          to="/expedientes/nuevo"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          <Plus size={14} />
          Nuevo siniestro
        </Link>
      </div>

      {/* KPI strip */}
      {!kpis.isLoading && kpis.data && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          {[
            { label: 'En curso', value: fmtNum(totalEnCurso), icon: <Activity size={14} />, color: 'var(--color-accent)' },
            { label: 'Nuevos este mes', value: fmtNum(totalNuevosMes), icon: <Clock size={14} />, color: 'var(--color-warning)' },
            { label: 'Cerrados este mes', value: fmtNum(totalCerrados), icon: <CheckCircle2 size={14} />, color: 'var(--color-success)' },
          ].map((k) => (
            <div key={k.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>{k.value}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{k.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Filtrar por compañía..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3) var(--space-2) 32px',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Grid de compañías */}
      {companias.isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)' }}>
          {search ? `Sin resultados para "${search}"` : 'Sin compañías disponibles'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {filtered.map((row) => (
            <CompaniaCard key={row.compania_id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
