import { Router } from 'express';
import { createInventarioUseCases } from './application/inventario.use-cases.js';
import { createInventarioRepository } from './infrastructure/inventario.postgres-repository.js';
import { createInventarioController } from './presentation/inventario.controller.js';

export function createInventarioModule(db) {
  const controller = createInventarioController(createInventarioUseCases(createInventarioRepository(db)));
  const router = Router();
  router.route('/movimientos').get(controller.list).post(controller.create);
  return router;
}
