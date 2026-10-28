import { createAuthUseCases } from './application/auth.use-cases.js';
import { createJwtService } from './infrastructure/jwt.service.js';
import { verifyPassword } from './infrastructure/password.service.js';
import { createUsuarioPostgresRepository } from './infrastructure/usuario.postgres-repository.js';
import { createAuthController } from './presentation/auth.controller.js';
import { createAuthenticate } from './presentation/auth.middleware.js';
import { createAuthRoutes } from './presentation/auth.routes.js';

export function createAuthModule(db, jwtConfig) {
  const useCases = createAuthUseCases({
    users: createUsuarioPostgresRepository(db),
    passwords: { verify: verifyPassword },
    tokens: createJwtService(jwtConfig),
  });
  const authenticate = createAuthenticate(useCases);
  const routes = createAuthRoutes(createAuthController(useCases), authenticate);
  return { routes, authenticate };
}
