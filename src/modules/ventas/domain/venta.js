import { positiveInteger, money, date, validateFields } from '../../../shared/domain/validation.js';
import { partialInput } from '../../../shared/domain/partial-input.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export function validateVentaPatch(input) {
  if (input && Object.hasOwn(input, 'estado')) {
    validateFields(input, ['estado', 'motivo_anulacion']);
    if (input.estado !== 'ANULADA') throw new ValidationError('Solo se permite cambiar estado a ANULADA.');
    if (typeof input.motivo_anulacion !== 'string' || !input.motivo_anulacion.trim() || input.motivo_anulacion.trim().length > 500) {
      throw new ValidationError('motivo_anulacion es obligatorio y admite hasta 500 caracteres.');
    }
    return { estado: 'ANULADA', motivo_anulacion: input.motivo_anulacion.trim() };
  }
  return partialInput(input, validateVenta,
    { producto_id: 1, vendedor_id: 1, cantidad: 1, precio_unitario: '0', fecha: '2026-01-01' },
    'estado', (value) => {
      if (value !== 'ANULADA') throw new ValidationError('Solo se permite cambiar estado a ANULADA.');
      if (Object.keys(input).length !== 1) throw new ValidationError('La anulación debe enviarse sin otros campos.');
      return value;
    });
}

export function validateVenta(input) {
  validateFields(input, ["producto_id","vendedor_id","cantidad","precio_unitario","fecha"]);
  return {
    producto_id: positiveInteger(input.producto_id, 'producto_id'),
    vendedor_id: positiveInteger(input.vendedor_id, 'vendedor_id'),
    cantidad: positiveInteger(input.cantidad, 'cantidad'),
    precio_unitario: money(input.precio_unitario, 'precio_unitario'),
    fecha: date(input.fecha),
  };
}
