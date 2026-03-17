import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useSearch';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data } = useGlobalSearch(query);

  const results = data && 'data' in data ? data.data ?? [] : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (r: (typeof results)[number]) => {
    setOpen(false);
    setQuery('');
    if (r.type === 'expediente') {
      navigate(`/expedientes/${r.id}`);
    } else if (r.expediente_id) {
      navigate(`/expedientes/${r.expediente_id}`);
    }
  };

  return (
    <div className="global-search" ref={ref}>
      <input
        type="search"
        placeholder="Buscar expediente, asegurado, teléfono, póliza..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        className="global-search-input"
      />
      {open && results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`} onClick={() => handleSelect(r)} className="search-result-item">
              <span className="search-result-type">{r.type === 'expediente' ? 'EXP' : 'ASEG'}</span>
              <div>
                <div className="search-result-title">{r.title}</div>
                <div className="search-result-subtitle">{r.subtitle}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
