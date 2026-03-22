/**
 * Notificaciones del módulo Autocita.
 *
 * Patrón: insertar alertas en la tabla `alertas` (mismo que customer-tracking).
 * La oficina y el operario reciben alertas en la bandeja de la app.
 * Extensible a email/push externos en post-MVP.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AutocitaNotifEvent =
  | 'cita_confirmada'
  | 'slot_seleccionado'
  | 'slot_no_disponible'
  | 'limite_cambios_alcanzado'
  | 'token_expirado_sin_accion';

interface AutocitaNotifParams {
  supabase: SupabaseClient;
  event: AutocitaNotifEvent;
  expedienteId: string;
  citaId?: string | null;
  operarioUserId?: string | null;  // user_id del operario (para destinatario de su alerta)
  detalle?: string;
}

const NOTIF_CONFIG: Record<AutocitaNotifEvent, {
  titulo: string;
  prioridad: 'baja' | 'media' | 'alta';
  notifOperario: boolean;
}> = {
  cita_confirmada: {
    titulo: 'Cliente ha confirmado la cita',
    prioridad: 'media',
    notifOperario: true,
  },
  slot_seleccionado: {
    titulo: 'Cliente ha seleccionado nueva franja horaria',
    prioridad: 'alta',
    notifOperario: true,
  },
  slot_no_disponible: {
    titulo: 'Hueco seleccionado por cliente ya no disponible (race condition)',
    prioridad: 'alta',
    notifOperario: false,
  },
  limite_cambios_alcanzado: {
    titulo: 'Cliente ha alcanzado el límite de cambios de cita',
    prioridad: 'media',
    notifOperario: false,
  },
  token_expirado_sin_accion: {
    titulo: 'Enlace de autocita expirado sin respuesta del cliente',
    prioridad: 'baja',
    notifOperario: false,
  },
};

export async function notifyAutocita(params: AutocitaNotifParams): Promise<void> {
  const { supabase, event, expedienteId, citaId, operarioUserId, detalle } = params;
  const cfg = NOTIF_CONFIG[event];
  const mensaje = detalle ?? null;

  const inserts: Promise<unknown>[] = [
    // Alerta para oficina (sin destinatario_id = visible para todos los roles de oficina)
    Promise.resolve(supabase.from('alertas').insert({
      tipo: 'custom',
      titulo: cfg.titulo,
      mensaje,
      expediente_id: expedienteId,
      cita_id: citaId ?? null,
      prioridad: cfg.prioridad,
      estado: 'activa',
      destinatario_id: null,
    })),
  ];

  if (cfg.notifOperario && operarioUserId) {
    inserts.push(
      Promise.resolve(supabase.from('alertas').insert({
        tipo: 'custom',
        titulo: cfg.titulo,
        mensaje,
        expediente_id: expedienteId,
        cita_id: citaId ?? null,
        prioridad: cfg.prioridad,
        estado: 'activa',
        destinatario_id: operarioUserId,
      })),
    );
  }

  await Promise.allSettled(inserts);
}
