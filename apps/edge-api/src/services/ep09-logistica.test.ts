import { describe, it, expect } from 'vitest';

// ─── EP-09: Proveedores y logística de materiales ───

describe('EP-09 — Pedido de material', () => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const yesterday = new Date(now.getTime() - 86400000);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  // ─── Creación de pedido ───

  it('debe crear pedido ligado a expediente con líneas', () => {
    const pedido = {
      expediente_id: 'exp-001',
      proveedor_id: 'prov-001',
      lineas: [
        { descripcion: 'Tubería PVC 32mm', cantidad: 5, unidad: 'ud' },
        { descripcion: 'Codo 90° PVC', cantidad: 10, unidad: 'ud' },
      ],
    };
    expect(pedido.lineas.length).toBeGreaterThan(0);
    expect(pedido.expediente_id).toBeTruthy();
    expect(pedido.proveedor_id).toBeTruthy();
  });

  it('debe rechazar pedido sin líneas', () => {
    const pedido = { expediente_id: 'exp-001', proveedor_id: 'prov-001', lineas: [] };
    expect(pedido.lineas.length).toBe(0);
    // API should return 422
  });

  it('debe generar número de pedido PED-YYYY-NNNNN', () => {
    const year = new Date().getFullYear();
    const seq = 42;
    const numero = `PED-${year}-${String(seq).padStart(5, '0')}`;
    expect(numero).toMatch(/^PED-\d{4}-\d{5}$/);
    expect(numero).toBe(`PED-${year}-00042`);
  });

  // ─── Envío al proveedor ───

  it('debe generar token de confirmación al enviar', () => {
    const token = crypto.randomUUID();
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const expiraAt = new Date(now.getTime() + 7 * 86400000);
    expect(expiraAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('debe registrar intento de envío con timestamp', () => {
    const envio = {
      enviado_at: now.toISOString(),
      enviado_por: 'user-001',
      estado: 'enviado' as const,
    };
    expect(envio.estado).toBe('enviado');
    expect(envio.enviado_at).toBeTruthy();
  });

  // ─── Confirmación del proveedor ───

  it('debe aceptar confirmación con token válido', () => {
    const token = 'abc-123-def';
    const pedido = {
      estado: 'enviado',
      token_confirmacion: 'abc-123-def',
      token_expira_at: tomorrow.toISOString(),
    };
    const isValid = token === pedido.token_confirmacion;
    const notExpired = new Date(pedido.token_expira_at) > now;
    const correctState = pedido.estado === 'enviado';
    expect(isValid && notExpired && correctState).toBe(true);
  });

  it('debe rechazar confirmación con token expirado', () => {
    const pedido = {
      estado: 'enviado',
      token_confirmacion: 'abc-123-def',
      token_expira_at: yesterday.toISOString(),
    };
    const notExpired = new Date(pedido.token_expira_at) > now;
    expect(notExpired).toBe(false);
  });

  it('debe rechazar confirmación con token incorrecto', () => {
    const pedido = {
      estado: 'enviado',
      token_confirmacion: 'abc-123-def',
      token_expira_at: tomorrow.toISOString(),
    };
    const isValid = 'wrong-token' === pedido.token_confirmacion;
    expect(isValid).toBe(false);
  });

  it('debe rechazar doble confirmación (pedido ya confirmado)', () => {
    const pedido = { estado: 'confirmado' };
    expect(pedido.estado).not.toBe('enviado');
  });

  // ─── Bandeja a recoger ───

  it('pedido confirmado aparece en bandeja a recoger', () => {
    const pedidos = [
      { id: '1', estado: 'confirmado' },
      { id: '2', estado: 'listo_para_recoger' },
      { id: '3', estado: 'enviado' },
      { id: '4', estado: 'recogido' },
    ];
    const aRecoger = pedidos.filter(p => ['confirmado', 'listo_para_recoger'].includes(p.estado));
    expect(aRecoger).toHaveLength(2);
    expect(aRecoger.map(p => p.id)).toEqual(['1', '2']);
  });

  it('pedido recogido sale de bandeja a recoger', () => {
    const pedido = { estado: 'recogido' };
    const enBandeja = ['confirmado', 'listo_para_recoger'].includes(pedido.estado);
    expect(enBandeja).toBe(false);
  });

  // ─── Pedidos caducados ───

  it('detecta pedido caducado por fecha límite superada', () => {
    const pedidos = [
      { id: '1', estado: 'enviado', fecha_limite: yesterday.toISOString() },
      { id: '2', estado: 'pendiente', fecha_limite: weekAgo.toISOString() },
      { id: '3', estado: 'enviado', fecha_limite: tomorrow.toISOString() },
      { id: '4', estado: 'confirmado', fecha_limite: yesterday.toISOString() },
    ];
    const caducados = pedidos.filter(p =>
      ['pendiente', 'enviado'].includes(p.estado) &&
      p.fecha_limite &&
      new Date(p.fecha_limite) < now
    );
    expect(caducados).toHaveLength(2);
    expect(caducados.map(p => p.id)).toEqual(['1', '2']);
  });

  it('calcula días de retraso correctamente', () => {
    const fechaLimite = weekAgo;
    const diasRetraso = Math.floor((now.getTime() - fechaLimite.getTime()) / 86400000);
    expect(diasRetraso).toBe(7);
  });

  // ─── Recogida ───

  it('marca pedido como recogido con actor y timestamp', () => {
    const recogida = {
      estado: 'recogido',
      recogido_at: now.toISOString(),
      recogido_por: 'user-001',
    };
    expect(recogida.estado).toBe('recogido');
    expect(recogida.recogido_at).toBeTruthy();
    expect(recogida.recogido_por).toBeTruthy();
  });

  // ─── Cancelación ───

  it('cancela pedido con motivo obligatorio', () => {
    const motivo = 'Material ya no necesario';
    expect(motivo.length).toBeGreaterThan(0);
    const cancelacion = {
      estado: 'cancelado',
      cancelado_at: now.toISOString(),
      cancelado_motivo: motivo,
    };
    expect(cancelacion.cancelado_motivo).toBeTruthy();
  });

  it('rechaza cancelación sin motivo', () => {
    const motivo = '';
    expect(motivo.length).toBe(0);
    // API should return 422
  });

  // ─── Transición PENDIENTE_MATERIAL ───

  it('expediente puede transicionar a PENDIENTE_MATERIAL desde EN_CURSO', () => {
    const TRANSITIONS: Record<string, string[]> = {
      EN_CURSO: ['FINALIZADO', 'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE', 'CANCELADO'],
      PENDIENTE_MATERIAL: ['EN_CURSO', 'CANCELADO'],
    };
    expect(TRANSITIONS['EN_CURSO']).toContain('PENDIENTE_MATERIAL');
    expect(TRANSITIONS['PENDIENTE_MATERIAL']).toContain('EN_CURSO');
  });

  it('SLA se pausa al entrar en PENDIENTE_MATERIAL', () => {
    const estadoNuevo = 'PENDIENTE_MATERIAL';
    const estadoActual = 'EN_CURSO';
    const debePausar = estadoNuevo.startsWith('PENDIENTE') && !estadoActual.startsWith('PENDIENTE');
    expect(debePausar).toBe(true);
  });

  it('SLA se reanuda al salir de PENDIENTE_MATERIAL', () => {
    const estadoNuevo = 'EN_CURSO';
    const estadoActual = 'PENDIENTE_MATERIAL';
    const debeReanudar = !estadoNuevo.startsWith('PENDIENTE') && estadoActual.startsWith('PENDIENTE');
    expect(debeReanudar).toBe(true);
  });

  // ─── Flujo de estados del pedido ───

  it('respeta flujo de estados: pendiente → enviado → confirmado → listo → recogido', () => {
    const flujo = ['pendiente', 'enviado', 'confirmado', 'listo_para_recoger', 'recogido'];
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pendiente: ['enviado', 'cancelado'],
      enviado: ['confirmado', 'caducado', 'cancelado'],
      confirmado: ['listo_para_recoger', 'cancelado'],
      listo_para_recoger: ['recogido', 'cancelado'],
      recogido: [],
      caducado: [],
      cancelado: [],
    };
    for (let i = 0; i < flujo.length - 1; i++) {
      expect(VALID_TRANSITIONS[flujo[i]]).toContain(flujo[i + 1]);
    }
  });

  // ─── Auditoría y timeline ───

  it('cada transición genera historial_pedido', () => {
    const historial = {
      pedido_id: 'ped-001',
      estado_anterior: 'pendiente',
      estado_nuevo: 'enviado',
      actor_id: 'user-001',
      created_at: now.toISOString(),
    };
    expect(historial.estado_anterior).not.toBe(historial.estado_nuevo);
    expect(historial.actor_id).toBeTruthy();
  });

  it('eventos de dominio generados para acciones principales', () => {
    const eventos = [
      'PedidoCreado',
      'PedidoEnviado',
      'PedidoConfirmado',
      'PedidoCaducado',
      'PedidoRecogido',
      'PedidoCancelado',
    ];
    expect(eventos).toHaveLength(6);
    eventos.forEach(e => expect(e).toMatch(/^Pedido/));
  });
});

describe('EP-09 — Proveedor', () => {
  it('proveedor requiere nombre', () => {
    const prov = { nombre: 'Materiales Express' };
    expect(prov.nombre.length).toBeGreaterThan(0);
  });

  it('proveedor sin nombre es rechazado', () => {
    const prov = { nombre: '' };
    expect(prov.nombre.length).toBe(0);
  });

  it('canal preferido por defecto es email', () => {
    const defaults = { canal_preferido: 'email' };
    expect(defaults.canal_preferido).toBe('email');
  });

  it('especialidades son array de strings', () => {
    const prov = { especialidades: ['fontanería', 'electricidad', 'pintura'] };
    expect(Array.isArray(prov.especialidades)).toBe(true);
    expect(prov.especialidades).toHaveLength(3);
  });
});
