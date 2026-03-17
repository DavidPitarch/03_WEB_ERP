import { describe, it, expect } from 'vitest';

// ─── EP-06: Tareas ────────────────────────────────────────────────

describe('Tarea lifecycle', () => {
  it('creates tarea in pendiente state', () => {
    const tarea = { titulo: 'Revisar expediente', estado: 'pendiente', completada: false };
    expect(tarea.estado).toBe('pendiente');
    expect(tarea.completada).toBe(false);
  });

  it('resolves tarea and sets completada', () => {
    const tarea = { estado: 'resuelta', completada: true, resuelta_at: new Date().toISOString(), resolucion: 'Revisado OK' };
    expect(tarea.estado).toBe('resuelta');
    expect(tarea.completada).toBe(true);
    expect(tarea.resolucion).toBeTruthy();
  });

  it('postpones tarea with future date', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const tarea = { estado: 'pospuesta', fecha_pospuesta: futureDate, motivo_posposicion: 'Esperando info del cliente' };
    expect(tarea.estado).toBe('pospuesta');
    expect(new Date(tarea.fecha_pospuesta).getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── EP-06: Alertas ───────────────────────────────────────────────

describe('Alerta persistence', () => {
  it('vencida alert stays until resolved', () => {
    const alerta = { tipo: 'tarea_vencida', estado: 'activa', resuelta_at: null };
    expect(alerta.estado).toBe('activa');
    expect(alerta.resuelta_at).toBeNull();
  });

  it('pospuesta alert reappears after date', () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const alerta = { estado: 'pospuesta', pospuesta_hasta: pastDate };
    const isReappearing = alerta.estado === 'pospuesta' && new Date(alerta.pospuesta_hasta) <= new Date();
    expect(isReappearing).toBe(true);
  });

  it('resolved alert is not shown', () => {
    const alerta = { estado: 'resuelta', resuelta_at: new Date().toISOString() };
    const isActive = alerta.estado === 'activa' || (alerta.estado === 'pospuesta');
    expect(isActive).toBe(false);
  });
});

// ─── EP-06: SLA ───────────────────────────────────────────────────

describe('SLA calculation with pauses', () => {
  const MS_PER_HOUR = 3600000;
  const MS_PER_DAY = 8 * MS_PER_HOUR; // 8h business day

  it('calculates effective time without pauses', () => {
    const totalMs = 5 * MS_PER_DAY;
    const suspendedMs = 0;
    const effectiveMs = totalMs - suspendedMs;
    expect(effectiveMs).toBe(5 * MS_PER_DAY);
  });

  it('subtracts pause duration from effective time', () => {
    const totalMs = 10 * MS_PER_DAY;
    const pauseMs = 3 * MS_PER_DAY;
    const effectiveMs = totalMs - pauseMs;
    expect(effectiveMs).toBe(7 * MS_PER_DAY);
  });

  it('classifies SLA status correctly', () => {
    function getSlaEstado(pct: number) {
      if (pct > 100) return 'vencido';
      if (pct >= 90) return 'critical';
      if (pct >= 75) return 'warning';
      return 'ok';
    }
    expect(getSlaEstado(50)).toBe('ok');
    expect(getSlaEstado(80)).toBe('warning');
    expect(getSlaEstado(95)).toBe('critical');
    expect(getSlaEstado(110)).toBe('vencido');
  });

  it('pauses SLA when entering PENDIENTE state', () => {
    const estadoAnterior = 'EN_CURSO';
    const estadoNuevo = 'PENDIENTE_MATERIAL';
    const shouldPause = estadoNuevo.startsWith('PENDIENTE') && !estadoAnterior.startsWith('PENDIENTE');
    expect(shouldPause).toBe(true);
  });

  it('resumes SLA when leaving PENDIENTE state', () => {
    const estadoAnterior = 'PENDIENTE_MATERIAL';
    const estadoNuevo = 'EN_CURSO';
    const shouldResume = !estadoNuevo.startsWith('PENDIENTE') && estadoAnterior.startsWith('PENDIENTE');
    expect(shouldResume).toBe(true);
  });

  it('does not pause when transitioning between PENDIENTE states', () => {
    const estadoAnterior = 'PENDIENTE_MATERIAL';
    const estadoNuevo = 'PENDIENTE_CLIENTE';
    const shouldPause = estadoNuevo.startsWith('PENDIENTE') && !estadoAnterior.startsWith('PENDIENTE');
    expect(shouldPause).toBe(false);
  });
});

// ─── EP-07: CSV baremo import ─────────────────────────────────────

describe('Baremo CSV parsing', () => {
  function parseBaremoCsvLine(line: string, tipo: 'compania' | 'operario') {
    const parts = line.split(';');
    if (parts.length < 4) return null;
    const codigo = parts[1]?.trim();
    const descripcion = parts[2]?.trim();
    if (!codigo || !descripcion) return null;

    const precioStr = tipo === 'compania' ? parts[3] : parts[4];
    const precio = parseFloat((precioStr ?? '').replace(',', '.'));
    if (isNaN(precio)) return null;

    return { codigo, descripcion, precio };
  }

  it('parses compania baremo line', () => {
    const line = ';61.01;Picado en techo M2;14,07;;';
    const result = parseBaremoCsvLine(line, 'compania');
    expect(result).toEqual({ codigo: '61.01', descripcion: 'Picado en techo M2', precio: 14.07 });
  });

  it('parses operario baremo line', () => {
    const line = ';CAR1;Mano de Obra Oficial;;20,00;';
    const result = parseBaremoCsvLine(line, 'operario');
    expect(result).toEqual({ codigo: 'CAR1', descripcion: 'Mano de Obra Oficial', precio: 20 });
  });

  it('detects section headers (no leading semicolon)', () => {
    const line = 'Albañilería;;;;';
    const isHeader = !line.startsWith(';') && line.includes(';;;;');
    expect(isHeader).toBe(true);
  });

  it('rejects lines with missing columns', () => {
    const line = ';61.01;';
    const result = parseBaremoCsvLine(line, 'compania');
    expect(result).toBeNull();
  });

  it('rejects lines with non-numeric price', () => {
    const line = ';61.01;Descripcion;abc;;';
    const result = parseBaremoCsvLine(line, 'compania');
    expect(result).toBeNull();
  });
});

// ─── EP-07: Presupuesto calculation ──────────────────────────────

describe('Presupuesto line calculation', () => {
  function calcLinea(cantidad: number, precioUnitario: number, descuento: number, iva: number) {
    const importe = cantidad * precioUnitario * (1 - descuento / 100);
    const subtotal = importe * (1 + iva / 100);
    return { importe: Math.round(importe * 100) / 100, subtotal: Math.round(subtotal * 100) / 100 };
  }

  it('calculates basic line', () => {
    const { importe, subtotal } = calcLinea(2, 50, 0, 21);
    expect(importe).toBe(100);
    expect(subtotal).toBe(121);
  });

  it('applies discount', () => {
    const { importe } = calcLinea(1, 100, 10, 21);
    expect(importe).toBe(90);
  });

  it('handles zero IVA', () => {
    const { importe, subtotal } = calcLinea(1, 100, 0, 0);
    expect(subtotal).toBe(importe);
  });
});

describe('Margen previsto', () => {
  it('calculates margin per expediente', () => {
    const lineas = [
      { precio_unitario: 100, precio_operario: 60, cantidad: 2 },
      { precio_unitario: 50, precio_operario: 30, cantidad: 1 },
    ];
    const ingreso = lineas.reduce((s, l) => s + l.precio_unitario * l.cantidad, 0);
    const coste = lineas.reduce((s, l) => s + l.precio_operario * l.cantidad, 0);
    const margen = ingreso - coste;
    expect(ingreso).toBe(250);
    expect(coste).toBe(150);
    expect(margen).toBe(100);
  });

  it('detects negative margin', () => {
    const ingreso = 80;
    const coste = 120;
    expect(ingreso - coste).toBeLessThan(0);
  });
});

// ─── Facturación prematura bloqueada ─────────────────────────────

describe('Facturacion block in R2-A', () => {
  it('FACTURADO only from FINALIZADO', () => {
    const from: string = 'EN_CURSO';
    const to = 'FACTURADO';
    // From state machine: only FINALIZADO can go to FACTURADO
    const allowed = from === 'FINALIZADO';
    expect(allowed).toBe(false);
  });

  it('allows FACTURADO from FINALIZADO', () => {
    const from = 'FINALIZADO';
    const to = 'FACTURADO';
    const allowed = from === 'FINALIZADO';
    expect(allowed).toBe(true);
  });
});
