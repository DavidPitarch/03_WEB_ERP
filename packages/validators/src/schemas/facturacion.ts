import type { SchemaShape } from '../engine';

export const emitirFacturaSchema: SchemaShape = {
  expediente_id:          { required: true, isUuid: true },
  empresa_facturadora_id: { required: true, isUuid: true },
  serie_id:               { required: true, isUuid: true },
};

export const registrarPagoSchema: SchemaShape = {
  importe:          { required: true, isNumber: true, isPositive: true },
  fecha_pago:       { required: true, minLength: 10 },
  metodo_pago:      { isEnum: ['transferencia', 'cheque', 'efectivo', 'domiciliacion', 'otros'] },
  referencia_pago:  { maxLength: 200 },
};
