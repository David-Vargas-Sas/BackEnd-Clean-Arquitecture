import { ValidationError } from '../../domain/errors.js';
import { positiveInteger } from '../../domain/validation.js';

export function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new ValidationError('ID inválido.');
  return positiveInteger(Number(value), 'id');
}

function parseInteger(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new ValidationError('Paginación inválida.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ValidationError('Paginación fuera de rango.');
  }
  return number;
}

export function parsePagination(query) {
  return {
    limit: parseInteger(query.limit, 10, 1, 100),
    offset: parseInteger(query.offset, 0, 0, 2147483647),
  };
}
