import { text, validateFields } from '../../../shared/domain/validation.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { partialInput, activeState } from '../../../shared/domain/partial-input.js';

export function validateVendedorPatch(input) {
  return partialInput(input, validateVendedor, { nombre: 'Vendedor', email: 'vendedor@example.com' }, 'activo', activeState);
}

export function validateVendedor(input) {
  validateFields(input, ["nombre","email"]);
  const email = text(input.email, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('email inválido.');
  return { nombre: text(input.nombre, 'nombre', 120), email };
}
