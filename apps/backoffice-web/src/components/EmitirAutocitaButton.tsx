import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AutocitaIssueLinkResponse, AutocitaTokenScope } from '@erp/types';
import { api } from '@/lib/api';

interface EmitirAutocitaButtonProps {
  expedienteId: string;
}

export function EmitirAutocitaButton({ expedienteId }: EmitirAutocitaButtonProps) {
  const [autocitaLink, setAutocitaLink] = useState<string | null>(null);
  const [autocitaExpiry, setAutocitaExpiry] = useState<string | null>(null);
  const [scope, setScope] = useState<AutocitaTokenScope>('ambos');
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<AutocitaIssueLinkResponse>('/autocita-links', {
        expediente_id: expedienteId,
        scope,
      }),
    onSuccess: (result) => {
      if ('data' in result && result.data) {
        const url = `${window.location.origin}${result.data.path}`;
        setAutocitaLink(url);
        setAutocitaExpiry(result.data.expires_at);
      }
    },
  });

  const handleCopy = () => {
    if (!autocitaLink) return;
    navigator.clipboard.writeText(autocitaLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setAutocitaLink(null);
    setAutocitaExpiry(null);
    setCopied(false);
  };

  if (autocitaLink) {
    const expiryLabel = autocitaExpiry
      ? new Date(autocitaExpiry).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <div className="autocita-link-panel">
        <p className="autocita-link-panel__label">Enlace de autocita generado</p>
        <div className="autocita-link-panel__url-row">
          <input
            readOnly
            value={autocitaLink}
            className="autocita-link-panel__input"
            onFocus={(e) => e.target.select()}
          />
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        {expiryLabel && (
          <p className="autocita-link-panel__expiry">Caduca: {expiryLabel}</p>
        )}
        <button className="btn-ghost" onClick={handleReset}>Generar nuevo</button>
      </div>
    );
  }

  return (
    <div className="autocita-emit-panel">
      <label className="autocita-emit-panel__label" htmlFor={`scope-${expedienteId}`}>
        Tipo de autocita
      </label>
      <select
        id={`scope-${expedienteId}`}
        value={scope}
        onChange={(e) => setScope(e.target.value as AutocitaTokenScope)}
        className="autocita-emit-panel__select"
        disabled={mutation.isPending}
      >
        <option value="ambos">Confirmar o cambiar cita</option>
        <option value="confirmar">Solo confirmar cita</option>
        <option value="seleccionar">Solo elegir nuevo hueco</option>
      </select>
      <button
        className="btn-secondary"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Generando...' : 'Generar enlace autocita'}
      </button>
      {mutation.isError && (
        <p className="form-error">Error al generar el enlace. Inténtalo de nuevo.</p>
      )}
    </div>
  );
}
