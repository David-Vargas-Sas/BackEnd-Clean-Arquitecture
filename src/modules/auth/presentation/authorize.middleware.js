import { ForbiddenError } from '../../../shared/domain/errors.js';
import { hasPermission } from '../domain/roles.js';

const actions = { GET: 'read', HEAD: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

export function authorizeResource(resource) {
  return (req, res, next) => {
    if (resource === 'ventas' && req.method === 'DELETE') return next();
    const action = actions[req.method];
    if (action && !hasPermission(req.user?.rol, `${resource}:${action}`)) throw new ForbiddenError();
    next();
  };
}
