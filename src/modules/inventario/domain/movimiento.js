import { positiveInteger, text, validateFields } from '../../../shared/domain/validation.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export function validateMovimiento(input) {
  validateFields(input, ['producto_id', 'tipo', 'cantidad', 'motivo']);
  if (!['ENTRADA', 'SALIDA'].includes(input.tipo)) throw new ValidationError('tipo debe ser ENTRADA o SALIDA.');
  return {
    producto_id: positiveInteger(input.producto_id, 'producto_id'),
    tipo: input.tipo,
    cantidad: positiveInteger(input.cantidad, 'cantidad') * (input.tipo === 'SALIDA' ? -1 : 1),
    motivo: text(input.motivo, 'motivo', 500),
  };
}
