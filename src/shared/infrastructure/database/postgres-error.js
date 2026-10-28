import { ConflictError, ValidationError } from '../../domain/errors.js';

export function translatePostgresError(error, operation) {
  if (error.code === 'P1003') return new ConflictError('Stock insuficiente o fuera de rango.');
  if (error.code === 'P1004') return new ConflictError('Las ventas y los movimientos se conservan como historial.');
  if (error.code === 'P1005') return new ConflictError('Debe conservarse al menos un administrador activo.');
  if (['40P01', '40001', '55P03'].includes(error.code)) return new ConflictError('Conflicto concurrente. Reintenta la operación.');
  if (error.code === 'P1001') return new ConflictError('El producto o vendedor está inactivo.');
  if (error.code === 'P1002') return new ConflictError('Una venta anulada no se puede modificar.');
  if (error.code === '23505') return new ConflictError('Ya existe un registro con ese valor único.');
  if (['23503', '23001'].includes(error.code)) {
    return new ConflictError(operation === 'remove'
      ? 'El registro tiene ventas asociadas y no se puede eliminar.'
      : 'El producto o vendedor indicado no existe.');
  }
  if (['23514', '23502', '22003', '22007', '22008'].includes(error.code)) {
    return new ValidationError('Los datos no cumplen las restricciones de la base de datos.');
  }
  return error;
}
