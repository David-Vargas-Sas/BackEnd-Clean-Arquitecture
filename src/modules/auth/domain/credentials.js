import { text, validateFields } from '../../../shared/domain/validation.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { permissionsFor } from './roles.js';

export function validateCredentials(input) {
  validateFields(input, ['email', 'password']);
  const email = text(input.email, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('email inválido.');
  if (typeof input.password !== 'string' || !input.password.length || input.password.length > 128) {
    throw new ValidationError('password es obligatorio y admite hasta 128 caracteres.');
  }
  return { email, password: input.password };
}

export function publicUser(user) {
  return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, permisos: permissionsFor(user.rol) };
}
