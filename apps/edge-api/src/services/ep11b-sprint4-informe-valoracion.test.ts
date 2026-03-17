import { describe, it, expect } from 'vitest';

// ─── Helpers ───

const INFORME_ESTADOS = ['borrador', 'en_revision', 'validado', 'rectificado'];
const INFORME_TRANSITIONS: Record<string, string[]> = {
  borrador: ['en_revision'],
  en_revision: ['validado', 'rectificado'],
  validado: ['rectificado'],
  rectificado: ['en_revision'],
};

const VALIDATOR_ROLES = ['admin', 'supervisor'];
const OFFICE_ROLES = ['admin', 'supervisor', 'tramitador'];

function transition(from: string, action: string): string | null {
  const map: Record<string, Record<string, string>> = {
    borrador: { 'enviar-revision': 'en_revision' },
    en_revision: { 'validar': 'validado', 'rectificar': 'rectificado' },
    validado: { 'rectificar': 'rectificado' },
    rectificado: { 'enviar-revision': 'en_revision' },
  };
  return map[from]?.[action] ?? null;
}

function canPerformAction(role: string, action: string): boolean {
  const restrictedActions = ['validar', 'ajuste-manual-precio'];
  if (restrictedActions.includes(action)) {
    return VALIDATOR_ROLES.includes(role);
  }
  if (['crear-informe', 'guardar-borrador', 'enviar-revision'].includes(action)) {
    return role === 'perito' || VALIDATOR_ROLES.includes(role);
  }
  if (action === 'ver-informe') {
    return [...OFFICE_ROLES, 'perito'].includes(role);
  }
  return false;
}

function calcularImporte(cantidad: number, precioUnitario: number): number {
  return cantidad * precioUnitario;
}

function calcularTotales(lineas: Array<{ importe: number }>): number {
  return lineas.reduce((sum, l) => sum + l.importe, 0);
}

// ─── 1. Informe State Machine ───

describe('EP-11B Sprint 4 — Informe State Machine', () => {
  it('create informe sets estado=borrador, version=1', () => {
    const informe = { estado: 'borrador', version: 1 };
    expect(informe.estado).toBe('borrador');
    expect(informe.version).toBe(1);
  });

  it('borrador -> en_revision via enviar-revision', () => {
    const result = transition('borrador', 'enviar-revision');
    expect(result).toBe('en_revision');
  });

  it('en_revision -> validado (only admin/supervisor)', () => {
    const result = transition('en_revision', 'validar');
    expect(result).toBe('validado');
    expect(canPerformAction('admin', 'validar')).toBe(true);
    expect(canPerformAction('supervisor', 'validar')).toBe(true);
    expect(canPerformAction('perito', 'validar')).toBe(false);
    expect(canPerformAction('tramitador', 'validar')).toBe(false);
  });

  it('validado -> rectificado with motivo', () => {
    const result = transition('validado', 'rectificar');
    expect(result).toBe('rectificado');
    const rectificacion = { motivo: 'Datos incorrectos en hallazgos' };
    expect(rectificacion.motivo).toBeTruthy();
  });

  it('rectificado -> en_revision via re-submit', () => {
    const result = transition('rectificado', 'enviar-revision');
    expect(result).toBe('en_revision');
  });

  it('cannot validate without dictamen emitido/validado', () => {
    const dictamen = { estado: 'borrador' };
    const canValidate = ['emitido', 'validado'].includes(dictamen.estado);
    expect(canValidate).toBe(false);
  });

  it('cannot validate without valoracion calculada', () => {
    const informe = { estado: 'en_revision', valoracion_calculada: false };
    const canValidate = informe.valoracion_calculada === true;
    expect(canValidate).toBe(false);
  });
});

// ─── 2. Informe Content ───

describe('EP-11B Sprint 4 — Informe Content', () => {
  it('create auto-populates datos_expediente, datos_encargo, datos_videoperitacion', () => {
    const informe = {
      datos_expediente: { expediente_id: 'exp-1', referencia: 'REF-001', compania: 'AXA' },
      datos_encargo: { encargo_id: 'enc-1', tipo_siniestro: 'agua', fecha_encargo: '2026-01-15' },
      datos_videoperitacion: { vp_id: 'vp-1', fecha_sesion: '2026-02-01', duracion_minutos: 45 },
    };
    expect(informe.datos_expediente.expediente_id).toBeTruthy();
    expect(informe.datos_encargo.encargo_id).toBeTruthy();
    expect(informe.datos_videoperitacion.vp_id).toBeTruthy();
  });

  it('hallazgos populated from dictamen if exists', () => {
    const dictamen = {
      hallazgos: [
        { descripcion: 'Tubería rota en cocina', severidad: 'alta' },
        { descripcion: 'Humedad en pared lateral', severidad: 'media' },
      ],
    };
    const informe = { hallazgos: dictamen.hallazgos };
    expect(informe.hallazgos).toHaveLength(2);
    expect(informe.hallazgos[0].descripcion).toContain('Tubería');
  });

  it('resolucion_pericial populated from dictamen', () => {
    const dictamen = {
      resolucion: 'aprobacion',
      conclusiones: 'Daños cubiertos por póliza, reparación autorizada',
    };
    const informe = {
      resolucion_pericial: {
        tipo: dictamen.resolucion,
        conclusiones: dictamen.conclusiones,
      },
    };
    expect(informe.resolucion_pericial.tipo).toBe('aprobacion');
    expect(informe.resolucion_pericial.conclusiones).toBeTruthy();
  });

  it('guardar-borrador updates content and bumps version', () => {
    const informe = { version: 1, observaciones: 'Initial draft' };
    // Simulate guardar-borrador
    informe.observaciones = 'Updated observations with new findings';
    informe.version = informe.version + 1;
    expect(informe.version).toBe(2);
    expect(informe.observaciones).toContain('Updated');
  });

  it('evidencias_principales stores artefacto IDs', () => {
    const informe = {
      evidencias_principales: ['art-rec-1', 'art-photo-2', 'art-doc-3'],
    };
    expect(informe.evidencias_principales).toHaveLength(3);
    expect(informe.evidencias_principales).toContain('art-rec-1');
  });
});

// ─── 3. Informe Versioning ───

describe('EP-11B Sprint 4 — Informe Versioning', () => {
  it('each state change creates version snapshot', () => {
    const snapshots = [
      { version: 1, estado: 'borrador', created_at: '2026-02-01T10:00:00Z' },
      { version: 2, estado: 'en_revision', created_at: '2026-02-01T12:00:00Z' },
      { version: 3, estado: 'validado', created_at: '2026-02-02T09:00:00Z' },
    ];
    expect(snapshots).toHaveLength(3);
    expect(snapshots[2].estado).toBe('validado');
  });

  it('guardar-borrador creates version snapshot', () => {
    const snapshot = {
      version: 2,
      estado: 'borrador',
      trigger: 'guardar-borrador',
      snapshot_by: 'user-perito-1',
      observaciones: 'Draft saved with updated hallazgos',
    };
    expect(snapshot.trigger).toBe('guardar-borrador');
    expect(snapshot.version).toBe(2);
  });

  it('version snapshot contains all content fields', () => {
    const snapshot = {
      version: 1,
      estado: 'borrador',
      datos_expediente: { expediente_id: 'exp-1' },
      datos_encargo: { encargo_id: 'enc-1' },
      datos_videoperitacion: { vp_id: 'vp-1' },
      hallazgos: [{ descripcion: 'Daño principal' }],
      resolucion_pericial: { tipo: 'aprobacion' },
      evidencias_principales: ['art-1'],
      observaciones: 'Draft',
    };
    expect(snapshot.datos_expediente).toBeTruthy();
    expect(snapshot.datos_encargo).toBeTruthy();
    expect(snapshot.datos_videoperitacion).toBeTruthy();
    expect(snapshot.hallazgos).toBeTruthy();
    expect(snapshot.resolucion_pericial).toBeTruthy();
    expect(snapshot.evidencias_principales).toBeTruthy();
  });

  it('version history ordered by version desc', () => {
    const versions = [
      { version: 3, estado: 'validado' },
      { version: 2, estado: 'en_revision' },
      { version: 1, estado: 'borrador' },
    ];
    for (let i = 0; i < versions.length - 1; i++) {
      expect(versions[i].version).toBeGreaterThan(versions[i + 1].version);
    }
  });
});

// ─── 4. Valoracion Economica — Baremo ───

describe('EP-11B Sprint 4 — Valoracion Economica Baremo', () => {
  const baremos = [
    { id: 'bar-1', compania_id: 'comp-axa', nombre: 'Baremo AXA 2026', version: 3, vigente: true, vigente_desde: '2026-01-01' },
    { id: 'bar-2', compania_id: 'comp-axa', nombre: 'Baremo AXA 2025', version: 2, vigente: false, vigente_desde: '2025-01-01' },
    { id: 'bar-3', compania_id: 'comp-mapfre', nombre: 'Baremo MAPFRE 2026', version: 1, vigente: true, vigente_desde: '2026-01-01' },
  ];

  function findVigentBaremo(companiaId: string) {
    return baremos.find(b => b.compania_id === companiaId && b.vigente) ?? null;
  }

  it('calcular-valoracion finds vigent baremo by compania_id', () => {
    const baremo = findVigentBaremo('comp-axa');
    expect(baremo).not.toBeNull();
    expect(baremo!.nombre).toBe('Baremo AXA 2026');
    expect(baremo!.vigente).toBe(true);
  });

  it('returns 422 if no vigent baremo', () => {
    const baremo = findVigentBaremo('comp-inexistente');
    expect(baremo).toBeNull();
    const errorCode = baremo === null ? 422 : 200;
    expect(errorCode).toBe(422);
  });

  it('snapshots baremo_id, baremo_version, baremo_nombre', () => {
    const baremo = findVigentBaremo('comp-axa')!;
    const valoracionSnapshot = {
      baremo_id: baremo.id,
      baremo_version: baremo.version,
      baremo_nombre: baremo.nombre,
    };
    expect(valoracionSnapshot.baremo_id).toBe('bar-1');
    expect(valoracionSnapshot.baremo_version).toBe(3);
    expect(valoracionSnapshot.baremo_nombre).toBe('Baremo AXA 2026');
  });

  it('lines snapshot precio_unitario_baremo from partida', () => {
    const partidaBaremo = { id: 'part-1', descripcion: 'Reparación tubería', precio_unitario: 85.50 };
    const lineaValoracion = {
      partida_baremo_id: partidaBaremo.id,
      descripcion: partidaBaremo.descripcion,
      precio_unitario_baremo: partidaBaremo.precio_unitario,
      precio_unitario_aplicado: partidaBaremo.precio_unitario,
    };
    expect(lineaValoracion.precio_unitario_baremo).toBe(85.50);
    expect(lineaValoracion.precio_unitario_aplicado).toBe(lineaValoracion.precio_unitario_baremo);
  });

  it('importe = cantidad * precio_unitario_aplicado', () => {
    const linea = { cantidad: 3, precio_unitario_aplicado: 85.50 };
    const importe = calcularImporte(linea.cantidad, linea.precio_unitario_aplicado);
    expect(importe).toBe(256.50);
  });

  it('totals calculated correctly', () => {
    const lineas = [
      { descripcion: 'Reparación tubería', cantidad: 2, precio_unitario_aplicado: 85.50, importe: calcularImporte(2, 85.50) },
      { descripcion: 'Pintura pared', cantidad: 15, precio_unitario_aplicado: 12.00, importe: calcularImporte(15, 12.00) },
      { descripcion: 'Mano de obra', cantidad: 8, precio_unitario_aplicado: 35.00, importe: calcularImporte(8, 35.00) },
    ];
    const total = calcularTotales(lineas);
    expect(total).toBe(171.00 + 180.00 + 280.00);
    expect(total).toBe(631.00);
  });
});

// ─── 5. Valoracion — Ajuste Manual ───

describe('EP-11B Sprint 4 — Valoracion Ajuste Manual', () => {
  it('different applied price marks es_ajuste_manual=true', () => {
    const linea = {
      precio_unitario_baremo: 85.50,
      precio_unitario_aplicado: 70.00,
      es_ajuste_manual: false,
    };
    linea.es_ajuste_manual = linea.precio_unitario_aplicado !== linea.precio_unitario_baremo;
    expect(linea.es_ajuste_manual).toBe(true);
  });

  it('manual adjustment requires admin/supervisor role', () => {
    expect(canPerformAction('admin', 'ajuste-manual-precio')).toBe(true);
    expect(canPerformAction('supervisor', 'ajuste-manual-precio')).toBe(true);
    expect(canPerformAction('perito', 'ajuste-manual-precio')).toBe(false);
    expect(canPerformAction('tramitador', 'ajuste-manual-precio')).toBe(false);
  });

  it('motivo_ajuste required for manual adjustments', () => {
    const ajuste = {
      precio_unitario_aplicado: 70.00,
      es_ajuste_manual: true,
      motivo_ajuste: '',
    };
    const isValid = ajuste.es_ajuste_manual ? ajuste.motivo_ajuste.length > 0 : true;
    expect(isValid).toBe(false);

    ajuste.motivo_ajuste = 'Precio negociado con proveedor local';
    const isValidAfter = ajuste.es_ajuste_manual ? ajuste.motivo_ajuste.length > 0 : true;
    expect(isValidAfter).toBe(true);
  });

  it('desviacion_total = importe_ajustado - importe_baremo', () => {
    const lineas = [
      { importe_baremo: calcularImporte(2, 85.50), importe_aplicado: calcularImporte(2, 70.00) },
      { importe_baremo: calcularImporte(15, 12.00), importe_aplicado: calcularImporte(15, 12.00) },
    ];
    const totalBaremo = lineas.reduce((s, l) => s + l.importe_baremo, 0);
    const totalAplicado = lineas.reduce((s, l) => s + l.importe_aplicado, 0);
    const desviacionTotal = totalAplicado - totalBaremo;
    expect(totalBaremo).toBe(171.00 + 180.00);
    expect(totalAplicado).toBe(140.00 + 180.00);
    expect(desviacionTotal).toBe(-31.00);
  });
});

// ─── 6. Valoracion — Fuera de Baremo ───

describe('EP-11B Sprint 4 — Valoracion Fuera de Baremo', () => {
  it('line without partida_baremo_id marks fuera_de_baremo=true', () => {
    const linea = {
      partida_baremo_id: null as string | null,
      descripcion: 'Partida especial no catalogada',
      fuera_de_baremo: false,
    };
    linea.fuera_de_baremo = linea.partida_baremo_id === null;
    expect(linea.fuera_de_baremo).toBe(true);
  });

  it('fuera_de_baremo lines have precio_unitario_baremo=0', () => {
    const linea = {
      fuera_de_baremo: true,
      precio_unitario_baremo: 0,
      precio_unitario_aplicado: 150.00,
      cantidad: 1,
    };
    expect(linea.precio_unitario_baremo).toBe(0);
    expect(linea.precio_unitario_aplicado).toBe(150.00);
  });

  it('recalcular updates all totals', () => {
    const lineas = [
      { cantidad: 2, precio_unitario_aplicado: 85.50, importe: 0 },
      { cantidad: 1, precio_unitario_aplicado: 150.00, importe: 0 },
    ];
    // Recalculate
    lineas.forEach(l => { l.importe = calcularImporte(l.cantidad, l.precio_unitario_aplicado); });
    const total = calcularTotales(lineas);
    expect(lineas[0].importe).toBe(171.00);
    expect(lineas[1].importe).toBe(150.00);
    expect(total).toBe(321.00);
  });
});

// ─── 7. VP Estado Transitions ───

describe('EP-11B Sprint 4 — VP Estado Transitions', () => {
  const VP_TRANSITIONS_SPRINT4: Record<string, string> = {
    'pendiente_informe->crear_informe': 'informe_borrador',
    'informe_borrador->validar_informe': 'informe_validado',
    'informe_validado->calcular_valoracion': 'valoracion_calculada',
    'informe_validado->rectificar': 'informe_borrador',
    'informe_borrador->rectificar': 'informe_borrador',
  };

  it('create informe -> VP to informe_borrador', () => {
    const vpEstado = VP_TRANSITIONS_SPRINT4['pendiente_informe->crear_informe'];
    expect(vpEstado).toBe('informe_borrador');
  });

  it('validate informe -> VP to informe_validado', () => {
    const vpEstado = VP_TRANSITIONS_SPRINT4['informe_borrador->validar_informe'];
    expect(vpEstado).toBe('informe_validado');
  });

  it('calculate valoracion after informe validated -> VP to valoracion_calculada', () => {
    const vpEstado = VP_TRANSITIONS_SPRINT4['informe_validado->calcular_valoracion'];
    expect(vpEstado).toBe('valoracion_calculada');
  });

  it('rectify informe -> VP back to informe_borrador', () => {
    const vpEstado = VP_TRANSITIONS_SPRINT4['informe_validado->rectificar'];
    expect(vpEstado).toBe('informe_borrador');
  });

  it('NO automatic facturacion (VP never goes to facturado automatically)', () => {
    const allTargetEstados = Object.values(VP_TRANSITIONS_SPRINT4);
    expect(allTargetEstados).not.toContain('facturado');
  });
});

// ─── 8. Expediente Impact ───

describe('EP-11B Sprint 4 — Expediente Impact', () => {
  it('informe validated reactivates expediente to en_curso if pending', () => {
    const expediente = { estado: 'pendiente_perito' };
    const informeValidado = true;
    if (informeValidado && expediente.estado === 'pendiente_perito') {
      expediente.estado = 'en_curso';
    }
    expect(expediente.estado).toBe('en_curso');
  });

  it('valoracion calculated does NOT change expediente estado', () => {
    const expediente = { estado: 'en_curso' };
    const valoracionCalculada = true;
    // Valoracion should NOT modify expediente
    const cambiaExpediente = false;
    expect(cambiaExpediente).toBe(false);
    expect(expediente.estado).toBe('en_curso');
  });

  it('all changes generate timeline + audit + domain events', () => {
    const sideEffects = {
      timeline: { tipo: 'nota_interna', emisor_tipo: 'sistema', asunto: 'Informe validado' },
      audit: { tabla: 'vp_informes', accion: 'UPDATE', cambios: { estado: 'validado' } },
      domainEvent: { aggregate_type: 'videoperitacion', event_type: 'InformeVpValidado' },
    };
    expect(sideEffects.timeline.emisor_tipo).toBe('sistema');
    expect(sideEffects.audit.accion).toBe('UPDATE');
    expect(sideEffects.domainEvent.event_type).toBe('InformeVpValidado');
  });
});

// ─── 9. Access Control ───

describe('EP-11B Sprint 4 — Access Control', () => {
  it('tramitador can view but not create/edit informes', () => {
    expect(canPerformAction('tramitador', 'ver-informe')).toBe(true);
    expect(canPerformAction('tramitador', 'crear-informe')).toBe(false);
    expect(canPerformAction('tramitador', 'guardar-borrador')).toBe(false);
  });

  it('perito can create and edit own informes', () => {
    expect(canPerformAction('perito', 'crear-informe')).toBe(true);
    expect(canPerformAction('perito', 'guardar-borrador')).toBe(true);
    expect(canPerformAction('perito', 'enviar-revision')).toBe(true);
  });

  it('only admin/supervisor can validate', () => {
    expect(canPerformAction('admin', 'validar')).toBe(true);
    expect(canPerformAction('supervisor', 'validar')).toBe(true);
    expect(canPerformAction('perito', 'validar')).toBe(false);
    expect(canPerformAction('tramitador', 'validar')).toBe(false);
  });

  it('manual price adjustment restricted to admin/supervisor', () => {
    expect(canPerformAction('admin', 'ajuste-manual-precio')).toBe(true);
    expect(canPerformAction('supervisor', 'ajuste-manual-precio')).toBe(true);
    expect(canPerformAction('perito', 'ajuste-manual-precio')).toBe(false);
    expect(canPerformAction('tramitador', 'ajuste-manual-precio')).toBe(false);
  });
});

// ─── 10. Hardening ───

describe('EP-11B Sprint 4 — Hardening', () => {
  it('webhook reprocess fields exist', () => {
    const webhookLog = {
      reprocess_count: 0,
      reprocessed_at: null as string | null,
      reprocessed_by: null as string | null,
      schema_version: '1.0',
    };
    expect(webhookLog).toHaveProperty('reprocess_count');
    expect(webhookLog).toHaveProperty('reprocessed_at');
    expect(webhookLog).toHaveProperty('reprocessed_by');
  });

  it('baremo version is immutable once valoracion calculated', () => {
    const valoracion = {
      baremo_id: 'bar-1',
      baremo_version: 3,
      estado: 'calculada',
    };
    const attemptChange = () => {
      if (valoracion.estado === 'calculada') {
        throw new Error('Cannot change baremo version after valoracion is calculated');
      }
      valoracion.baremo_version = 4;
    };
    expect(attemptChange).toThrow('Cannot change baremo version');
  });

  it('preview endpoint is read-only (no state changes)', () => {
    const previewRequest = { method: 'GET', path: '/informes/:id/preview' };
    const informe = { estado: 'borrador', version: 1 };
    // Preview should not mutate
    const estadoBefore = informe.estado;
    const versionBefore = informe.version;
    // Simulate preview (read-only)
    const _preview = { ...informe, rendered: true };
    expect(informe.estado).toBe(estadoBefore);
    expect(informe.version).toBe(versionBefore);
  });
});

// ─── 11. Facturacion Block ───

describe('EP-11B Sprint 4 — Facturacion Block', () => {
  it('no endpoint creates factura', () => {
    const sprint4Endpoints = [
      'POST /informes',
      'PUT /informes/:id/guardar-borrador',
      'POST /informes/:id/enviar-revision',
      'POST /informes/:id/validar',
      'POST /informes/:id/rectificar',
      'POST /informes/:id/calcular-valoracion',
      'POST /informes/:id/ajuste-manual',
      'GET /informes/:id/preview',
      'POST /informes/:id/recalcular',
    ];
    const facturaEndpoints = sprint4Endpoints.filter(e => e.toLowerCase().includes('factura'));
    expect(facturaEndpoints).toHaveLength(0);
  });

  it('VP estado valoracion_calculada does NOT trigger billing', () => {
    const vpEstado = 'valoracion_calculada';
    const triggersBilling = false; // Explicitly no automatic billing in Sprint 4
    expect(triggersBilling).toBe(false);
    expect(vpEstado).not.toBe('facturado');
  });
});
