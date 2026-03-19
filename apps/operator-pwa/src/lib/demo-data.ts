import type { AgendaItem, OperatorClaimDetail } from '@erp/types';

const OP_ID = 'demo-op-001';
const EXP1 = 'demo-exp-001';
const EXP2 = 'demo-exp-002';
const EXP3 = 'demo-exp-003';
const CITA1 = 'demo-cita-001';
const CITA2 = 'demo-cita-002';
const CITA3 = 'demo-cita-003';

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export function getDemoAgenda(): AgendaItem[] {
  const hoy = dateStr(0);
  const manana = dateStr(1);
  return [
    {
      cita_id: CITA1, expediente_id: EXP1, operario_id: OP_ID,
      fecha: hoy, franja_inicio: '09:00', franja_fin: '11:00',
      cita_estado: 'programada', cita_notas: null,
      numero_expediente: 'EXP-2026-0001', expediente_estado: 'EN_CURSO',
      tipo_siniestro: 'Agua', prioridad: 'alta',
      descripcion: 'Fuga en tubería de cocina. Daños en suelo y pared.',
      direccion_siniestro: 'Calle Mayor 45, 3º B', codigo_postal: '46001',
      localidad: 'Valencia', provincia: 'Valencia',
      asegurado_nombre: 'María', asegurado_apellidos: 'García López',
      asegurado_telefono: '612345678', asegurado_telefono2: null,
      tiene_parte: false,
    },
    {
      cita_id: CITA2, expediente_id: EXP2, operario_id: OP_ID,
      fecha: hoy, franja_inicio: '12:00', franja_fin: '14:00',
      cita_estado: 'confirmada', cita_notas: 'El cliente confirmó por teléfono',
      numero_expediente: 'EXP-2026-0042', expediente_estado: 'EN_CURSO',
      tipo_siniestro: 'Cristales', prioridad: 'media',
      descripcion: 'Rotura de ventana principal por vandalismo.',
      direccion_siniestro: 'Av. Blasco Ibáñez 12, 1º A', codigo_postal: '46022',
      localidad: 'Valencia', provincia: 'Valencia',
      asegurado_nombre: 'Carlos', asegurado_apellidos: 'Martínez Ruiz',
      asegurado_telefono: '698765432', asegurado_telefono2: '963123456',
      tiene_parte: true,
    },
    {
      cita_id: CITA3, expediente_id: EXP3, operario_id: OP_ID,
      fecha: manana, franja_inicio: '10:00', franja_fin: '12:00',
      cita_estado: 'programada', cita_notas: null,
      numero_expediente: 'EXP-2026-0087', expediente_estado: 'EN_CURSO',
      tipo_siniestro: 'Robo', prioridad: 'urgente',
      descripcion: 'Cerradura forzada. Cambio de bombín y refuerzo de puerta.',
      direccion_siniestro: 'C/ Colón 8, 4º C', codigo_postal: '46004',
      localidad: 'Valencia', provincia: 'Valencia',
      asegurado_nombre: 'Ana', asegurado_apellidos: 'Fernández Gómez',
      asegurado_telefono: '677889900', asegurado_telefono2: null,
      tiene_parte: false,
    },
  ];
}

export function getDemoClaimDetail(id: string): OperatorClaimDetail {
  const hoy = dateStr(0);
  const manana = dateStr(1);

  if (id === EXP2) {
    return {
      id: EXP2, numero_expediente: 'EXP-2026-0042', estado: 'EN_CURSO',
      tipo_siniestro: 'Cristales', prioridad: 'media',
      descripcion: 'Rotura de ventana principal por vandalismo.',
      direccion_siniestro: 'Av. Blasco Ibáñez 12, 1º A', codigo_postal: '46022',
      localidad: 'Valencia', provincia: 'Valencia',
      asegurado: { nombre: 'Carlos', apellidos: 'Martínez Ruiz', telefono: '698765432', telefono2: '963123456' },
      citas: [{
        id: CITA2, expediente_id: EXP2, operario_id: OP_ID,
        fecha: hoy, franja_inicio: '12:00', franja_fin: '14:00',
        estado: 'realizada', notas: 'El cliente confirmó por teléfono',
        notificacion_enviada: true, created_at: hoy + 'T08:00:00Z', updated_at: hoy + 'T08:00:00Z',
      }],
      partes: [{
        id: 'demo-parte-001', expediente_id: EXP2, operario_id: OP_ID, cita_id: CITA2,
        trabajos_realizados: 'Sustitución de cristal 4mm en ventana principal. Sellado perimetral.',
        trabajos_pendientes: null, materiales_utilizados: 'Cristal 4mm, silicona, junquillo',
        observaciones: null, resultado: 'completada', motivo_resultado: null,
        requiere_nueva_visita: false, firma_cliente_url: null, firma_storage_path: null,
        sync_status: 'synced', validado: false, validado_por: null, validado_at: null,
        created_at: hoy + 'T13:00:00Z', updated_at: hoy + 'T13:00:00Z',
      }],
    };
  }

  if (id === EXP3) {
    return {
      id: EXP3, numero_expediente: 'EXP-2026-0087', estado: 'EN_CURSO',
      tipo_siniestro: 'Robo', prioridad: 'urgente',
      descripcion: 'Cerradura forzada. Cambio de bombín y refuerzo de puerta.',
      direccion_siniestro: 'C/ Colón 8, 4º C', codigo_postal: '46004',
      localidad: 'Valencia', provincia: 'Valencia',
      asegurado: { nombre: 'Ana', apellidos: 'Fernández Gómez', telefono: '677889900', telefono2: null },
      citas: [{
        id: CITA3, expediente_id: EXP3, operario_id: OP_ID,
        fecha: manana, franja_inicio: '10:00', franja_fin: '12:00',
        estado: 'programada', notas: null,
        notificacion_enviada: true, created_at: hoy + 'T08:00:00Z', updated_at: hoy + 'T08:00:00Z',
      }],
      partes: [],
    };
  }

  // Default: EXP1
  return {
    id: EXP1, numero_expediente: 'EXP-2026-0001', estado: 'EN_CURSO',
    tipo_siniestro: 'Agua', prioridad: 'alta',
    descripcion: 'Fuga en tubería de cocina. Daños en suelo y pared.',
    direccion_siniestro: 'Calle Mayor 45, 3º B', codigo_postal: '46001',
    localidad: 'Valencia', provincia: 'Valencia',
    asegurado: { nombre: 'María', apellidos: 'García López', telefono: '612345678', telefono2: null },
    citas: [{
      id: CITA1, expediente_id: EXP1, operario_id: OP_ID,
      fecha: hoy, franja_inicio: '09:00', franja_fin: '11:00',
      estado: 'programada', notas: null,
      notificacion_enviada: true, created_at: hoy + 'T07:00:00Z', updated_at: hoy + 'T07:00:00Z',
    }],
    partes: [],
  };
}
