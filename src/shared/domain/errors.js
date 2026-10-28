export class ValidationError extends Error {}
export class NotFoundError extends Error {
  constructor(message = 'Registro no encontrado.') { super(message); }
}
export class ConflictError extends Error {}
export class ForbiddenError extends Error {
  constructor(message = 'No tienes permisos para realizar esta operación.') { super(message); }
}
export class AuthenticationError extends Error {
  constructor(message = 'Se requiere un token de acceso válido.') { super(message); }
}
