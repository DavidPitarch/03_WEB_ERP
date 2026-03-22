import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DispatchSuggestion } from '@erp/types';
import { supabase } from '@/lib/supabase';

interface SuggestResponse {
  data: { suggestions: DispatchSuggestion[]; total: number };
  error: null;
}

interface AcceptPayload {
  assignments: Array<{
    expediente_id: string;
    operario_id: string;
    fecha: string;
    franja_inicio: string;
    franja_fin: string;
  }>;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export function useSmartDispatchSuggest() {
  return useMutation<SuggestResponse, Error, { fecha?: string }>({
    mutationFn: async (payload) => {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/planning/dispatch/suggest`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, dry_run: true }),
        }
      );
      if (!res.ok) throw new Error('Error al generar sugerencias');
      return res.json();
    },
  });
}

export function useSmartDispatchAccept() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AcceptPayload>({
    mutationFn: async (payload) => {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/planning/dispatch/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error('Error al aceptar asignaciones');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geo-expedientes'] });
      qc.invalidateQueries({ queryKey: ['geo-operarios'] });
    },
  });
}
