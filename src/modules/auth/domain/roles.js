import { ValidationError } from '../../../shared/domain/errors.js';

export const ROLES = Object.freeze({ ADMIN: 'ADMIN', VENDEDOR: 'VENDEDOR', INVENTARIO: 'INVENTARIO' });

const grants = {
  ADMIN: ['productos:read', 'productos:create', 'productos:update', 'productos:delete',
    'vendedores:read', 'vendedores:create', 'vendedores:update', 'vendedores:delete',
    'ventas:read', 'ventas:create', 'ventas:update',
    'inventario:read', 'inventario:create', 'usuarios:read', 'usuarios:create', 'usuarios:update', 'auditoria:read'],
  VENDEDOR: ['productos:read', 'vendedores:read', 'ventas:read', 'ventas:create'],
  INVENTARIO: ['productos:read', 'productos:create', 'productos:update', 'inventario:read', 'inventario:create'],
};

export function validateRole(value) {
  if (!Object.hasOwn(ROLES, value)) throw new ValidationError('rol debe ser ADMIN, VENDEDOR o INVENTARIO.');
  return value;
}

export function hasPermission(role, permission) {
  return Object.hasOwn(grants, role) && grants[role].includes(permission);
}

export function permissionsFor(role) {
  return Object.hasOwn(grants, role) ? [...grants[role]] : [];
}
