import { AuthenticationError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Error interno del servidor.';
  if (error instanceof ForbiddenError) { status = 403; code = 'FORBIDDEN'; message = error.message; }
  if (error instanceof AuthenticationError) {
    status = 401; code = 'UNAUTHENTICATED'; message = error.message;
    res.setHeader('WWW-Authenticate', 'Bearer');
  }
  if (error.type === 'auth.rate.limit') {
    status = 429; code = 'TOO_MANY_REQUESTS'; message = 'Demasiados intentos. Intenta de nuevo más tarde.';
  }
  if (error instanceof ValidationError) { status = 400; code = 'VALIDATION_ERROR'; message = error.message; }
  if (error instanceof NotFoundError) { status = 404; code = 'NOT_FOUND'; message = error.message; }
  if (error instanceof ConflictError) { status = 409; code = 'CONFLICT'; message = error.message; }
  if (error.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'JSON inválido.'; }
  if (error.type === 'entity.too.large') { status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'El cuerpo excede el tamaño permitido.'; }
  if (error.status >= 400 && error.status < 500 && status === 500) {
    status = error.status;
    code = 'INVALID_REQUEST';
    message = 'Petición HTTP inválida.';
  }
  if (status >= 500) {
    // No registrar cuerpos, credenciales, consultas SQL ni mensajes del driver.
    console.error(JSON.stringify({
      level: 'error', event: 'request_failed', requestId: req.requestId,
      method: req.method, status,
    }));
  }
  res.status(status).json({ error: { code, message, requestId: req.requestId } });
}
