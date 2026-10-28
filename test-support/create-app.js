import { createApp as createProductionApp } from '../src/app.js';

// Aislamiento explícito de autenticación en pruebas del CRUD.
export const jwtConfig = {
  secret: 'test-only-secret-not-for-production-0123456789',
  issuer: 'backend-ventas', audience: 'frontend-ventas', expiresIn: 900,
};

export function createApp(db) {
  return createProductionApp(db, { jwtConfig, authenticate: (req, res, next) => {
    req.user = { id: 1, nombre: 'Administrador de prueba', rol: 'ADMIN' };
    next();
  } });
}
