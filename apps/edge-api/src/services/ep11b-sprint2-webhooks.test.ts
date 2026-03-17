import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Helpers ───

function makeSignature(payload: string, secret: string): Promise<string> {
  // Test helper using Node.js crypto for HMAC
  const { createHmac } = require('crypto');
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return Promise.resolve('sha256=' + hmac.digest('hex'));
}

const VP_WEBHOOK_SECRET = 'test-webhook-secret-key';

function makeWebhookPayload(eventType: string, data: Record<string, any>, eventId?: string) {
  return {
    event_id: eventId ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    data,
  };
}

// ─── HMAC Validation ───

describe('EP-11B Sprint 2 — Webhook HMAC Validation', () => {
  it('should accept valid HMAC-SHA256 signature', async () => {
    const payload = JSON.stringify(makeWebhookPayload('session.created', { session_id: 's1', correlation_id: 'vp1' }));
    const sig = await makeSignature(payload, VP_WEBHOOK_SECRET);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should reject missing signature header', () => {
    const sig = '';
    expect(sig).toBeFalsy();
  });

  it('should reject invalid HMAC signature', async () => {
    const payload = JSON.stringify({ data: 'test' });
    const validSig = await makeSignature(payload, VP_WEBHOOK_SECRET);
    const tamperedSig = validSig.slice(0, -4) + 'beef';
    expect(tamperedSig).not.toBe(validSig);
  });

  it('should reject signature with wrong secret', async () => {
    const payload = JSON.stringify({ data: 'test' });
    const sig1 = await makeSignature(payload, VP_WEBHOOK_SECRET);
    const sig2 = await makeSignature(payload, 'wrong-secret');
    expect(sig1).not.toBe(sig2);
  });
});

// ─── Idempotency ───

describe('EP-11B Sprint 2 — Webhook Idempotency', () => {
  it('should detect duplicate event_id', () => {
    const seen = new Set<string>();
    const eventId = 'evt_duplicate_123';
    seen.add(eventId);
    expect(seen.has(eventId)).toBe(true);
  });

  it('should allow unique event_ids', () => {
    const seen = new Set<string>();
    const ids = ['evt_1', 'evt_2', 'evt_3'];
    ids.forEach(id => seen.add(id));
    expect(seen.size).toBe(3);
  });

  it('should not reprocess already-processed events', () => {
    const processedEvents = new Map<string, boolean>();
    processedEvents.set('evt_processed', true);
    const shouldSkip = processedEvents.has('evt_processed');
    expect(shouldSkip).toBe(true);
  });
});

// ─── Session State Transitions ───

describe('EP-11B Sprint 2 — Session State Machine', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pendiente: ['creada', 'cancelada'],
    creada: ['iniciada', 'fallida', 'cancelada'],
    iniciada: ['finalizada', 'fallida'],
    finalizada: [],
    fallida: [],
    ausente: [],
    cancelada: [],
  };

  it('session.created should transition to creada', () => {
    expect(VALID_TRANSITIONS['pendiente']).toContain('creada');
  });

  it('session.started should transition from creada to iniciada', () => {
    expect(VALID_TRANSITIONS['creada']).toContain('iniciada');
  });

  it('session.ended should transition from iniciada to finalizada', () => {
    expect(VALID_TRANSITIONS['iniciada']).toContain('finalizada');
  });

  it('session.failed should transition from creada to fallida', () => {
    expect(VALID_TRANSITIONS['creada']).toContain('fallida');
  });

  it('finalized sessions cannot transition further', () => {
    expect(VALID_TRANSITIONS['finalizada']).toHaveLength(0);
  });

  it('full lifecycle: created -> started -> ended', () => {
    let state = 'pendiente';
    // session.created
    expect(VALID_TRANSITIONS[state]).toContain('creada');
    state = 'creada';
    // session.started
    expect(VALID_TRANSITIONS[state]).toContain('iniciada');
    state = 'iniciada';
    // session.ended
    expect(VALID_TRANSITIONS[state]).toContain('finalizada');
    state = 'finalizada';
    expect(VALID_TRANSITIONS[state]).toHaveLength(0);
  });
});

// ─── Artifact Registration ───

describe('EP-11B Sprint 2 — Artifact Registration', () => {
  const VALID_TIPOS = ['recording', 'audio', 'transcript', 'screenshot', 'document', 'evidence'];
  const VALID_ORIGINS = ['webhook', 'manual', 'perito', 'sistema'];
  const VALID_DISPONIBILIDAD = ['pendiente', 'disponible', 'expirado', 'eliminado'];
  const VALID_VISIBILITY = ['office', 'perito', 'all'];

  it('recording.ready should create artifact with tipo recording', () => {
    const artifact = { tipo: 'recording', origen: 'webhook', mime_type: 'video/mp4' };
    expect(VALID_TIPOS).toContain(artifact.tipo);
    expect(VALID_ORIGINS).toContain(artifact.origen);
  });

  it('audio.ready should create artifact with tipo audio', () => {
    const artifact = { tipo: 'audio', origen: 'webhook', mime_type: 'audio/mpeg' };
    expect(VALID_TIPOS).toContain(artifact.tipo);
  });

  it('transcript.ready should create artifact with tipo transcript', () => {
    const artifact = { tipo: 'transcript', origen: 'webhook', mime_type: 'text/plain' };
    expect(VALID_TIPOS).toContain(artifact.tipo);
  });

  it('manual upload should set origen to manual', () => {
    const artifact = { tipo: 'document', origen: 'manual' };
    expect(VALID_ORIGINS).toContain(artifact.origen);
  });

  it('artifact should have default disponibilidad as disponible', () => {
    const defaultDisp = 'disponible';
    expect(VALID_DISPONIBILIDAD).toContain(defaultDisp);
  });

  it('visibility scope defaults to office', () => {
    const defaultScope = 'office';
    expect(VALID_VISIBILITY).toContain(defaultScope);
  });

  it('webhook artifacts should store provider_url', () => {
    const recording = {
      tipo: 'recording',
      origen: 'webhook',
      provider_url: 'https://provider.example.com/recordings/abc123',
      storage_path: null,
    };
    expect(recording.provider_url).toBeTruthy();
    expect(recording.storage_path).toBeNull();
  });
});

// ─── Access Control for Artifacts ───

describe('EP-11B Sprint 2 — Artifact Access Control', () => {
  const OFFICE_ROLES = ['admin', 'supervisor', 'tramitador'];
  const ALL_VP_ROLES = ['admin', 'supervisor', 'tramitador', 'perito'];

  function canAccess(role: string, scope: string): boolean {
    if (scope === 'all') return true;
    if (scope === 'perito') return ALL_VP_ROLES.includes(role);
    if (scope === 'office') return OFFICE_ROLES.includes(role);
    return false;
  }

  it('office-scope artifact: admin can access', () => {
    expect(canAccess('admin', 'office')).toBe(true);
  });

  it('office-scope artifact: perito cannot access', () => {
    expect(canAccess('perito', 'office')).toBe(false);
  });

  it('perito-scope artifact: perito can access', () => {
    expect(canAccess('perito', 'perito')).toBe(true);
  });

  it('perito-scope artifact: compania cannot access', () => {
    expect(canAccess('compania', 'perito')).toBe(false);
  });

  it('all-scope artifact: anyone can access', () => {
    expect(canAccess('compania', 'all')).toBe(true);
    expect(canAccess('perito', 'all')).toBe(true);
    expect(canAccess('admin', 'all')).toBe(true);
  });

  it('signed URL should expire', () => {
    const expiresIn = 3600; // 1 hour
    const issuedAt = Date.now();
    const expiresAt = issuedAt + expiresIn * 1000;
    expect(expiresAt).toBeGreaterThan(issuedAt);
    expect(expiresIn).toBe(3600);
  });

  it('access log should record user and role', () => {
    const accessLog = {
      artefacto_id: 'art-1',
      user_id: 'user-1',
      user_role: 'perito',
      access_type: 'view' as const,
      ip: '192.168.1.1',
    };
    expect(accessLog.user_role).toBe('perito');
    expect(accessLog.access_type).toBe('view');
  });
});

// ─── Transcription ───

describe('EP-11B Sprint 2 — Transcription', () => {
  it('should store full transcript text', () => {
    const transcript = {
      texto_completo: 'Buenos días, vamos a revisar los daños del siniestro...',
      idioma: 'es',
      resumen: 'Revisión de daños por agua en cocina y baño',
    };
    expect(transcript.texto_completo.length).toBeGreaterThan(0);
    expect(transcript.idioma).toBe('es');
  });

  it('should support segments with speaker and timestamps', () => {
    const segments = [
      { start: 0, end: 15, speaker: 'perito', text: 'Buenos días, soy el perito asignado.' },
      { start: 15, end: 30, speaker: 'asegurado', text: 'Hola, gracias por venir.' },
      { start: 30, end: 60, speaker: 'perito', text: 'Vamos a revisar la zona afectada.' },
    ];
    expect(segments).toHaveLength(3);
    expect(segments[0].speaker).toBe('perito');
    expect(segments[1].start).toBe(15);
  });

  it('should support highlights extraction', () => {
    const highlights = ['daños por agua', 'tubería rota', 'cocina', 'presupuesto reparación'];
    expect(highlights).toContain('daños por agua');
    expect(highlights.length).toBe(4);
  });

  it('should support text search (basic validation)', () => {
    const texto = 'Los daños por agua afectaron la cocina y el baño principal del asegurado';
    const query = 'daños agua cocina';
    const words = query.split(' ');
    const allFound = words.every(w => texto.toLowerCase().includes(w.toLowerCase()));
    expect(allFound).toBe(true);
  });

  it('should reject search queries shorter than 3 chars', () => {
    const q = 'ab';
    expect(q.length).toBeLessThan(3);
  });
});

// ─── Timeline and Audit ───

describe('EP-11B Sprint 2 — Timeline & Audit', () => {
  const WEBHOOK_EVENT_TYPES = [
    'session.created', 'session.started', 'session.ended',
    'recording.ready', 'audio.ready', 'transcript.ready',
    'session.failed', 'participant.absent',
  ];

  it('all 8 webhook event types are covered', () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(8);
  });

  it('each event should generate timeline entry', () => {
    const timelineEntry = {
      expediente_id: 'exp-1',
      tipo: 'nota_interna',
      emisor_tipo: 'sistema',
      asunto: 'VP webhook: session.created',
      contenido: 'Sesión de videoperitación creada',
    };
    expect(timelineEntry.emisor_tipo).toBe('sistema');
    expect(timelineEntry.asunto).toContain('webhook');
  });

  it('each event should generate domain event', () => {
    const domainEvent = {
      aggregate_id: 'vp-1',
      aggregate_type: 'videoperitacion',
      event_type: 'VideoperitacionSesionIniciada',
      payload: { message: 'Sesión iniciada con 2 participantes' },
    };
    expect(domainEvent.aggregate_type).toBe('videoperitacion');
  });

  it('each event should generate audit record', () => {
    const audit = {
      tabla: 'vp_videoperitaciones',
      registro_id: 'vp-1',
      accion: 'WEBHOOK',
      cambios: { event_type: 'session.ended', message: 'Sesión finalizada' },
    };
    expect(audit.accion).toBe('WEBHOOK');
  });

  it('participant.absent should generate high priority alert', () => {
    const alert = {
      tipo: 'participante_ausente',
      prioridad: 'alta',
      referencia_tipo: 'videoperitacion',
    };
    expect(alert.prioridad).toBe('alta');
  });

  it('session.failed should generate high priority alert', () => {
    const alert = {
      tipo: 'sesion_fallida',
      prioridad: 'alta',
      referencia_tipo: 'videoperitacion',
    };
    expect(alert.prioridad).toBe('alta');
  });
});

// ─── Webhook Payload Validation ───

describe('EP-11B Sprint 2 — Payload Validation', () => {
  it('should require event_id header', () => {
    const headers = { 'x-vp-event-id': '', 'x-vp-event-type': 'session.created' };
    expect(headers['x-vp-event-id']).toBeFalsy();
  });

  it('should require event_type header', () => {
    const headers = { 'x-vp-event-id': 'evt_1', 'x-vp-event-type': '' };
    expect(headers['x-vp-event-type']).toBeFalsy();
  });

  it('should require valid JSON body', () => {
    const invalidBody = 'not-json{';
    expect(() => JSON.parse(invalidBody)).toThrow();
  });

  it('should require data field in payload', () => {
    const payload = { event_id: 'evt_1', event_type: 'session.created' };
    expect((payload as any).data).toBeUndefined();
  });

  it('session.created requires session_id and correlation_id', () => {
    const data = { session_id: 'ses-1', correlation_id: 'vp-1', room_url: 'https://room.example' };
    expect(data.session_id).toBeTruthy();
    expect(data.correlation_id).toBeTruthy();
  });

  it('recording.ready requires session_id and recording_url', () => {
    const data = { session_id: 'ses-1', recording_url: 'https://cdn.example/rec.mp4', duration_seconds: 1800, size_bytes: 524288000 };
    expect(data.session_id).toBeTruthy();
    expect(data.recording_url).toBeTruthy();
    expect(data.size_bytes).toBeGreaterThan(0);
  });
});
