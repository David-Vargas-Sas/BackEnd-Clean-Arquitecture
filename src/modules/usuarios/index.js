import { Router } from 'express';
import { createUsuarioUseCases } from './application/usuario.use-cases.js';
import { createUsuarioRepository } from './infrastructure/usuario.postgres-repository.js';
import { hashPassword } from '../auth/infrastructure/password.service.js';
import { createCrudController } from '../../shared/presentation/http/crud-controller.js';

export function createUsuariosModule(db) {
  const useCases = createUsuarioUseCases(createUsuarioRepository(db), { hash: hashPassword });
  const controller = createCrudController(useCases, '/api/usuarios');
  const router = Router();
  router.route('/').get(controller.list).post(controller.create);
  router.route('/:id').get(controller.find).patch(controller.patch);
  return router;
}
