import { ValidationError } from './errors.js';

export function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new ValidationError(`${field} debe ser un entero positivo de hasta 2147483647.`);
  }
  return value;
}

export function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new ValidationError(`${field} es obligatorio y admite hasta ${max} caracteres.`);
  }
  return value.trim();
}

export function money(value, field) {
  if (!['number', 'string'].includes(typeof value) || !/^\d{1,10}(\.\d{1,2})?$/.test(String(value))) {
    throw new ValidationError(`${field} debe ser un importe no negativo con hasta dos decimales.`);
  }
  return String(value);
}

export function validateFields(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Se requiere un objeto JSON.');
  }
  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new ValidationError('El cuerpo contiene campos desconocidos.');
  }
}

export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value
      || value.startsWith('0000')) {
    throw new ValidationError('fecha debe ser una fecha válida con formato YYYY-MM-DD.');
  }
  return value;
}
