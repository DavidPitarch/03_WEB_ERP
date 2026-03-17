import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeExpedientes() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('expedientes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, () => {
        qc.invalidateQueries({ queryKey: ['expedientes'] });
        qc.invalidateQueries({ queryKey: ['bandeja-contadores'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
        qc.invalidateQueries({ queryKey: ['expedientes'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

export function useRealtimeExpediente(expedienteId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!expedienteId) return;

    const channel = supabase
      .channel(`expediente-${expedienteId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'expedientes',
        filter: `id=eq.${expedienteId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['expediente', expedienteId] });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comunicaciones',
        filter: `expediente_id=eq.${expedienteId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['expediente-timeline', expedienteId] });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'historial_estados',
        filter: `expediente_id=eq.${expedienteId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['expediente-timeline', expedienteId] });
        qc.invalidateQueries({ queryKey: ['expediente', expedienteId] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'citas',
        filter: `expediente_id=eq.${expedienteId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['expediente-timeline', expedienteId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc, expedienteId]);
}
