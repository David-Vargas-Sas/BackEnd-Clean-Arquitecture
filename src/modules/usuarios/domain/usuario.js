import { text, validateFields } from '../../../shared/domain/validation.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { validateCredentials } from '../../auth/domain/credentials.js';
import { validateRole } from '../../auth/domain/roles.js';

export function validateNewPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw new ValidationError('password debe tener entre 12 y 128 caracteres.');
  }
  return value;
}

export function validateUsuario(input) {
  validateFields(input, ['nombre', 'email', 'password', 'rol']);
  const credentials = validateCredentials({ email: input.email, password: input.password });
  return { nombre: text(input.nombre, 'nombre', 120), ...credentials,
    password: validateNewPassword(input.password), rol: validateRole(input.rol ?? 'VENDEDOR') };
}

export function validateUsuarioPatch(input) {
  validateFields(input, ['nombre', 'email', 'password', 'rol', 'activo']);
  if (!Object.keys(input).length) throw new ValidationError('PATCH requiere al menos un campo.');
  const data = {};
  if (Object.hasOwn(input, 'nombre')) data.nombre = text(input.nombre, 'nombre', 120);
  if (Object.hasOwn(input, 'email')) data.email = validateCredentials({ email: input.email, password: 'validation-only' }).email;
  if (Object.hasOwn(input, 'password')) data.password = validateNewPassword(input.password);
  if (Object.hasOwn(input, 'rol')) data.rol = validateRole(input.rol);
  if (Object.hasOwn(input, 'activo')) {
    if (typeof input.activo !== 'boolean') throw new ValidationError('activo debe ser booleano.');
    data.activo = input.activo;
  }
  return data;
}
