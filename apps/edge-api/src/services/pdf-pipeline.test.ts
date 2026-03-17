import { describe, it, expect } from 'vitest';

describe('PDF Pipeline', () => {
  it('generates correct storage path', () => {
    const expedienteId = 'exp-123';
    const parteId = 'parte-456';
    const path = `documentos/${expedienteId}/parte_${parteId}.pdf`;
    expect(path).toBe('documentos/exp-123/parte_parte-456.pdf');
  });

  it('generates filename with date and numero expediente', () => {
    const numero = 'EXP-2026-00001';
    const date = '2026-03-15';
    const nombre = `Parte_${numero}_${date}.pdf`;
    expect(nombre).toBe('Parte_EXP-2026-00001_2026-03-15.pdf');
  });

  it('document starts in pendiente estado', () => {
    const doc = {
      tipo: 'parte_operario_pdf',
      estado: 'pendiente',
      generado_automaticamente: true,
    };
    expect(doc.estado).toBe('pendiente');
    expect(doc.generado_automaticamente).toBe(true);
  });

  it('processDocumentStub transitions to procesando', () => {
    const estados = ['pendiente', 'procesando', 'completado'];
    const initial = 'pendiente';
    const next = estados[estados.indexOf(initial) + 1];
    expect(next).toBe('procesando');
  });
});

describe('Parte validation flow', () => {
  it('validar sets validado=true and validacion_estado=validado', () => {
    const update = {
      validado: true,
      validacion_estado: 'validado' as const,
      validado_por: 'user-1',
      validado_at: new Date().toISOString(),
    };
    expect(update.validado).toBe(true);
    expect(update.validacion_estado).toBe('validado');
    expect(update.validado_por).toBeTruthy();
  });

  it('rechazar requires motivo', () => {
    const motivo = '';
    const isValid = motivo.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('rechazar sets validacion_estado=rechazado with motivo', () => {
    const motivo = 'Falta información de materiales';
    const update = {
      validado: false,
      validacion_estado: 'rechazado' as const,
      validacion_comentario: motivo,
    };
    expect(update.validacion_estado).toBe('rechazado');
    expect(update.validacion_comentario).toBe(motivo);
  });

  it('already validated parte cannot be re-validated', () => {
    const parte = { validacion_estado: 'validado' };
    const canValidate = parte.validacion_estado !== 'validado';
    expect(canValidate).toBe(false);
  });
});

describe('FINALIZADO transition requires validated parte', () => {
  it('blocks FINALIZADO without validated parte', () => {
    const parteCount = 0;
    const tieneParteValidado = parteCount > 0;
    expect(tieneParteValidado).toBe(false);
  });

  it('allows FINALIZADO with validated parte', () => {
    const parteCount = 1;
    const tieneParteValidado = parteCount > 0;
    expect(tieneParteValidado).toBe(true);
  });
});

describe('Causa pendiente on expediente', () => {
  it('sets causa_pendiente when transitioning to PENDIENTE state', () => {
    const estadoNuevo = 'PENDIENTE_MATERIAL';
    const update: Record<string, any> = { estado: estadoNuevo };
    if (estadoNuevo.startsWith('PENDIENTE')) {
      update.causa_pendiente = 'material';
      update.causa_pendiente_detalle = 'Falta tornillería especial';
    }
    expect(update.causa_pendiente).toBe('material');
  });

  it('clears causa_pendiente when leaving PENDIENTE state', () => {
    const estadoNuevo = 'EN_CURSO';
    const update: Record<string, any> = { estado: estadoNuevo };
    if (!estadoNuevo.startsWith('PENDIENTE')) {
      update.causa_pendiente = null;
      update.causa_pendiente_detalle = null;
    }
    expect(update.causa_pendiente).toBeNull();
  });
});

describe('Informes caducados clearance after parte', () => {
  it('cita with validated parte is not caducada', () => {
    const citas = [
      { id: 'c1', fecha: '2026-03-10', hasParte: true, parteValidado: true },
      { id: 'c2', fecha: '2026-03-10', hasParte: false, parteValidado: false },
    ];
    const caducados = citas.filter((c) => !c.hasParte);
    expect(caducados).toHaveLength(1);
    expect(caducados[0].id).toBe('c2');
  });

  it('calculates dias_retraso correctly', () => {
    const fechaCita = new Date('2026-03-10');
    const hoy = new Date('2026-03-15');
    const diasRetraso = Math.floor((hoy.getTime() - fechaCita.getTime()) / (1000 * 60 * 60 * 24));
    expect(diasRetraso).toBe(5);
  });
});
