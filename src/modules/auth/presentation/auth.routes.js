import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

export function createAuthRoutes(controller, authenticate) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res, next) {
      next(Object.assign(new Error('Límite de login'), { type: 'auth.rate.limit' }));
    },
  });
  router.post('/login', loginLimiter, controller.login);
  router.get('/me', authenticate, controller.me);
  return router;
}
