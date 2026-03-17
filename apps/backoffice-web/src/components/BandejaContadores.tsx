import { Link } from 'react-router-dom';
import { useBandejaContadores } from '@/hooks/useBandejas';

const BANDEJAS = [
  { estado: 'NUEVO', label: 'Nuevos', color: '#3b82f6' },
  { estado: 'NO_ASIGNADO', label: 'No asignados', color: '#f59e0b' },
  { estado: 'EN_PLANIFICACION', label: 'En planificación', color: '#8b5cf6' },
  { estado: 'EN_CURSO', label: 'En curso', color: '#10b981' },
  { estado: 'PENDIENTE', label: 'Pendientes', color: '#ef4444' },
  { estado: 'PENDIENTE_MATERIAL', label: 'Pdte. material', color: '#f97316' },
  { estado: 'PENDIENTE_PERITO', label: 'Pdte. perito', color: '#f97316' },
  { estado: 'PENDIENTE_CLIENTE', label: 'Pdte. cliente', color: '#f97316' },
  { estado: 'FINALIZADO', label: 'Finalizados', color: '#06b6d4' },
];

export function BandejaContadores() {
  const { data } = useBandejaContadores();
  const contadores = data && 'data' in data ? data.data ?? {} : {};

  const total = Object.values(contadores as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="bandejas-bar">
      <Link to="/expedientes" className="bandeja-item" style={{ borderColor: '#64748b' }}>
        <span className="bandeja-count">{total}</span>
        <span className="bandeja-label">Todos</span>
      </Link>
      {BANDEJAS.map((b) => {
        const count = (contadores as Record<string, number>)[b.estado] ?? 0;
        if (count === 0) return null;
        return (
          <Link
            key={b.estado}
            to={`/expedientes?estado=${b.estado}`}
            className="bandeja-item"
            style={{ borderColor: b.color }}
          >
            <span className="bandeja-count" style={{ color: b.color }}>{count}</span>
            <span className="bandeja-label">{b.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
