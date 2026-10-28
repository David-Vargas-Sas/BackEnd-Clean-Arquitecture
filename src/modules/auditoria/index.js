import { Router } from 'express';
import { createAuditoriaUseCases } from './application/auditoria.use-cases.js';
import { createAuditoriaRepository } from './infrastructure/auditoria.postgres-repository.js';
import { createAuditoriaController } from './presentation/auditoria.controller.js';

export function createAuditoriaModule(db) {
  const router = Router();
  const controller = createAuditoriaController(createAuditoriaUseCases(createAuditoriaRepository(db)));
  router.get('/', controller.list);
  return router;
}
