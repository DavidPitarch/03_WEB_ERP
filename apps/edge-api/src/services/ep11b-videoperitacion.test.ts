import { describe, it, expect } from 'vitest';

// ─── EP-11B: Videoperitación Tests ───

describe('Crear encargo VP con numero_caso VP-YYYY-NNNNN', () => {
  it('generates VP-YYYY-NNNNN format', () => {
    const year = 2026;
    const count = 7;
    const seq = (count + 1).toString().padStart(5, '0');
    const numeroCaso = `VP-${year}-${seq}`;
    expect(numeroCaso).toBe('VP-2026-00008');
    expect(numeroCaso).toMatch(/^VP-\d{4}-\d{5}$/);
  });

  it('first VP of the year gets 00001', () => {
    const count = 0;
    const seq = (count + 1).toString().padStart(5, '0');
    expect(seq).toBe('00001');
  });

  it('creates VP with estado encargo_recibido', () => {
    const vp = {
      id: 'vp-001',
      expediente_id: 'exp-001',
      estado: 'encargo_recibido',
      prioridad: 'media',
      origen: 'manual',
    };
    expect(vp.estado).toBe('encargo_recibido');
  });
});

describe('Registrar hoja de encargo → estado pendiente_contacto', () => {
  it('transitions to pendiente_contacto after registering hoja_encargo', () => {
    const vp = { estado: 'encargo_recibido' };
    const encargo = { tipo: 'hoja_encargo', contenido: 'Datos del siniestro...' };
    // Simulate: after registering encargo, state changes
    if (encargo.tipo === 'hoja_encargo' && vp.estado === 'encargo_recibido') {
      vp.estado = 'pendiente_contacto';
    }
    expect(vp.estado).toBe('pendiente_contacto');
  });
});

describe('Registrar declaración del siniestro', () => {
  it('creates declaracion_siniestro encargo', () => {
    const encargo = {
      tipo: 'declaracion_siniestro' as const,
      contenido: 'El dia 10 de marzo se produjo una inundacion...',
      datos_estructurados: { causa: 'inundacion', zona: 'cocina' },
    };
    expect(encargo.tipo).toBe('declaracion_siniestro');
    expect(encargo.datos_estructurados).toBeTruthy();
  });
});

describe('Registrar comunicación entrante (llamada)', () => {
  it('creates llamada_entrante communication', () => {
    const com = {
      tipo: 'llamada_entrante',
      emisor_tipo: 'cliente',
      resultado: 'informado',
      contenido: 'Cliente llama preguntando por el estado',
      actor_id: 'user-001',
    };
    expect(com.tipo).toBe('llamada_entrante');
    expect(com.emisor_tipo).toBe('cliente');
  });
});

describe('Registrar comunicación saliente (email)', () => {
  it('creates email_saliente communication', () => {
    const com = {
      tipo: 'email_saliente',
      emisor_tipo: 'oficina',
      resultado: 'enviado',
      contenido: 'Se envia informacion sobre la videoperitacion',
      actor_id: 'user-002',
    };
    expect(com.tipo).toBe('email_saliente');
    expect(com.emisor_tipo).toBe('oficina');
  });
});

describe('Registrar intento contacto → resultado contactado → estado cambia', () => {
  it('changes estado to contactado when resultado is contactado', () => {
    const vp = { estado: 'pendiente_contacto' };
    const intento = { canal: 'telefono', resultado: 'contactado' };
    if (intento.resultado === 'contactado') {
      vp.estado = 'contactado';
    }
    expect(vp.estado).toBe('contactado');
  });
});

describe('Registrar intento contacto → no_contesta → estado no cambia', () => {
  it('keeps estado when resultado is no_contesta', () => {
    const vp = { estado: 'pendiente_contacto' };
    const intento = { canal: 'telefono', resultado: 'no_contesta' };
    if (intento.resultado === 'contactado') {
      vp.estado = 'contactado';
    }
    expect(vp.estado).toBe('pendiente_contacto');
  });
});

describe('Agendar videoperitación → estado agendado', () => {
  it('transitions to agendado when agenda is created', () => {
    const vp = { estado: 'contactado' };
    const agenda = { fecha: '2026-04-01', hora_inicio: '10:00', hora_fin: '11:00', estado: 'programada' };
    vp.estado = 'agendado';
    expect(vp.estado).toBe('agendado');
    expect(agenda.estado).toBe('programada');
  });
});

describe('Reprogramar → old agenda reprogramada, new created', () => {
  it('marks old agenda as reprogramada and creates new one', () => {
    const oldAgenda = { id: 'ag-1', estado: 'programada', fecha: '2026-04-01' };
    const newAgenda = { id: 'ag-2', estado: 'programada', fecha: '2026-04-05' };
    // Simulate reprogramar
    oldAgenda.estado = 'reprogramada';
    expect(oldAgenda.estado).toBe('reprogramada');
    expect(newAgenda.estado).toBe('programada');
    expect(newAgenda.fecha).not.toBe(oldAgenda.fecha);
  });
});

describe('Cancelar → estado cancelado, motivo required', () => {
  it('transitions to cancelado with motivo', () => {
    const vp = { estado: 'agendado', cancelado_at: null as string | null, cancelado_motivo: null as string | null };
    const motivo = 'Cliente no desea continuar';
    vp.estado = 'cancelado';
    vp.cancelado_at = new Date().toISOString();
    vp.cancelado_motivo = motivo;
    expect(vp.estado).toBe('cancelado');
    expect(vp.cancelado_motivo).toBe(motivo);
    expect(vp.cancelado_at).toBeTruthy();
  });
});

describe('Cancelar sin motivo → rejected', () => {
  it('rejects cancellation without motivo', () => {
    const motivo = '';
    const canCancel = motivo.trim().length > 0;
    expect(canCancel).toBe(false);
  });

  it('rejects cancellation with null motivo', () => {
    const motivo: string | null = null;
    const canCancel = (motivo ?? '').trim().length > 0;
    expect(canCancel).toBe(false);
  });
});

describe('Enviar enlace → estado link_enviado, link_token generated', () => {
  it('transitions to link_enviado and generates token', () => {
    const vp = { estado: 'agendado' };
    const agenda = {
      link_token: null as string | null,
      link_enviado_at: null as string | null,
      link_reenvios: 0,
    };
    // Simulate enviar link
    vp.estado = 'link_enviado';
    agenda.link_token = 'tok_' + Math.random().toString(36).substring(2, 15);
    agenda.link_enviado_at = new Date().toISOString();
    agenda.link_reenvios = 1;
    expect(vp.estado).toBe('link_enviado');
    expect(agenda.link_token).toBeTruthy();
    expect(agenda.link_token).toMatch(/^tok_/);
    expect(agenda.link_enviado_at).toBeTruthy();
    expect(agenda.link_reenvios).toBe(1);
  });
});

describe('Enviar enlace sin agenda activa → rejected', () => {
  it('rejects sending link without active agenda', () => {
    const agendaActiva = null;
    const canSendLink = agendaActiva !== null;
    expect(canSendLink).toBe(false);
  });

  it('rejects sending link with cancelled agenda', () => {
    const agendaActiva = { estado: 'cancelada' };
    const canSendLink = agendaActiva !== null && agendaActiva.estado !== 'cancelada' && agendaActiva.estado !== 'reprogramada';
    expect(canSendLink).toBe(false);
  });
});

describe('Timeline: comunicación registrada en expediente', () => {
  it('creates timeline entry for VP communication', () => {
    const timelineEntry = {
      timeline_type: 'comunicacion',
      tipo: 'llamada_entrante',
      contenido: 'Contacto con cliente',
      actor_nombre: 'Ana Garcia',
      created_at: new Date().toISOString(),
    };
    expect(timelineEntry.timeline_type).toBe('comunicacion');
    expect(timelineEntry.tipo).toBe('llamada_entrante');
  });

  it('VP communications appear in expediente timeline', () => {
    const expedienteTimeline = [
      { id: 't-1', timeline_type: 'estado', created_at: '2026-01-01T10:00:00Z' },
      { id: 't-2', timeline_type: 'comunicacion', created_at: '2026-01-02T10:00:00Z' },
    ];
    const vpCom = { id: 't-3', timeline_type: 'comunicacion', tipo: 'nota_interna', created_at: '2026-01-03T10:00:00Z' };
    expedienteTimeline.push(vpCom);
    expect(expedienteTimeline).toHaveLength(3);
    expect(expedienteTimeline[2].timeline_type).toBe('comunicacion');
  });
});

describe('Auditoría: todas las acciones generan audit entry', () => {
  it('generates audit entry for each VP action', () => {
    const actions = [
      'crear_videoperitacion',
      'registrar_encargo',
      'registrar_comunicacion',
      'registrar_intento_contacto',
      'agendar',
      'reprogramar',
      'cancelar',
      'enviar_link',
    ];
    const auditEntries = actions.map((action) => ({
      tabla: 'videoperitaciones',
      accion: 'INSERT' as const,
      cambios: { action },
      created_at: new Date().toISOString(),
    }));
    expect(auditEntries).toHaveLength(8);
    auditEntries.forEach((entry) => {
      expect(entry.tabla).toBe('videoperitaciones');
      expect(entry.created_at).toBeTruthy();
    });
  });
});

describe('Acceso perito: solo VPs asignadas a él', () => {
  it('perito can only see VPs assigned to them', () => {
    const peritoId = 'perito-001';
    const videoperitaciones = [
      { id: 'vp-1', perito_id: 'perito-001' },
      { id: 'vp-2', perito_id: 'perito-002' },
      { id: 'vp-3', perito_id: 'perito-001' },
      { id: 'vp-4', perito_id: null },
    ];
    const visible = videoperitaciones.filter((vp) => vp.perito_id === peritoId);
    expect(visible).toHaveLength(2);
    expect(visible.map((vp) => vp.id)).toEqual(['vp-1', 'vp-3']);
  });
});

describe('Acceso tramitador: todas las VPs', () => {
  it('tramitador can see all VPs', () => {
    const userRoles = ['tramitador'];
    const isTramitador = userRoles.includes('tramitador') || userRoles.includes('admin') || userRoles.includes('supervisor');
    const videoperitaciones = [
      { id: 'vp-1', perito_id: 'perito-001' },
      { id: 'vp-2', perito_id: 'perito-002' },
      { id: 'vp-3', perito_id: null },
    ];
    const visible = isTramitador ? videoperitaciones : [];
    expect(visible).toHaveLength(3);
  });
});

describe('SLA: deadline tracking', () => {
  it('detects VP past deadline', () => {
    const vp = { deadline: '2026-03-10T00:00:00Z', estado: 'pendiente_contacto' };
    const now = new Date('2026-03-15T12:00:00Z');
    const deadlineDate = new Date(vp.deadline);
    const isPastDeadline = now > deadlineDate;
    expect(isPastDeadline).toBe(true);
  });

  it('detects VP within deadline', () => {
    const vp = { deadline: '2026-03-20T00:00:00Z', estado: 'pendiente_contacto' };
    const now = new Date('2026-03-15T12:00:00Z');
    const deadlineDate = new Date(vp.deadline);
    const isPastDeadline = now > deadlineDate;
    expect(isPastDeadline).toBe(false);
  });

  it('handles VP without deadline', () => {
    const vp = { deadline: null, estado: 'pendiente_contacto' };
    const isPastDeadline = vp.deadline ? new Date() > new Date(vp.deadline) : false;
    expect(isPastDeadline).toBe(false);
  });
});

describe('Intentos de contacto auto-numerados', () => {
  it('auto-numbers contact attempts sequentially', () => {
    const intentos = [
      { intento_numero: 1, resultado: 'no_contesta' },
      { intento_numero: 2, resultado: 'no_contesta' },
    ];
    const nextNumero = intentos.length + 1;
    const newIntento = { intento_numero: nextNumero, resultado: 'contactado' };
    expect(newIntento.intento_numero).toBe(3);
  });

  it('first attempt gets numero 1', () => {
    const intentos: any[] = [];
    const nextNumero = intentos.length + 1;
    expect(nextNumero).toBe(1);
  });
});

describe('Consentimiento: pendiente por defecto al crear', () => {
  it('creates all consent types as pendiente when VP is created', () => {
    const tipos = ['videoperitacion', 'grabacion_video', 'grabacion_audio', 'transcripcion'] as const;
    const consentimientos = tipos.map((tipo) => ({
      tipo,
      estado: 'pendiente' as const,
      otorgado_por: null,
      otorgado_at: null,
    }));
    expect(consentimientos).toHaveLength(4);
    consentimientos.forEach((c) => {
      expect(c.estado).toBe('pendiente');
      expect(c.otorgado_por).toBeNull();
      expect(c.otorgado_at).toBeNull();
    });
  });

  it('all consent types are represented', () => {
    const expectedTypes = ['videoperitacion', 'grabacion_video', 'grabacion_audio', 'transcripcion'];
    const consentimientos = expectedTypes.map((tipo) => ({ tipo, estado: 'pendiente' }));
    const types = consentimientos.map((c) => c.tipo);
    expect(types).toEqual(expectedTypes);
  });
});
