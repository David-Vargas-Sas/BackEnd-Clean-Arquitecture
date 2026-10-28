import { createProductoUseCases } from './application/producto.use-cases.js';
import { createProductoPostgresRepository } from './infrastructure/producto.postgres-repository.js';
import { createProductoController } from './presentation/producto.controller.js';
import { createProductoRoutes } from './presentation/producto.routes.js';

// Composición del módulo: las dependencias se inyectan desde afuera.
export function createProductoModule(db) {
  const repository = createProductoPostgresRepository(db);
  const useCases = createProductoUseCases(repository);
  const controller = createProductoController(useCases);
  return createProductoRoutes(controller);
}
