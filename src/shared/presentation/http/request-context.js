import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  // Se genera en el servidor para no confiar en identificadores del cliente.
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
