import { ValidationError } from './errors.js';
import { validateFields } from './validation.js';

// Valida únicamente campos presentes con las mismas reglas de la entidad.
export function partialInput(input, validate, defaults, stateField, validateState) {
  validateFields(input, [...Object.keys(defaults), stateField]);
  if (!Object.keys(input).length) throw new ValidationError('PATCH requiere al menos un campo.');
  const fields = Object.fromEntries(Object.entries(input).filter(([key]) => key !== stateField));
  const validated = validate({ ...defaults, ...fields });
  const result = Object.fromEntries(Object.keys(fields).map((key) => [key, validated[key]]));
  if (Object.hasOwn(input, stateField)) result[stateField] = validateState(input[stateField]);
  return result;
}

export function activeState(value) {
  if (typeof value !== 'boolean') throw new ValidationError('activo debe ser booleano.');
  return value;
}
