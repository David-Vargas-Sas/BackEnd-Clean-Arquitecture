import { createVendedorUseCases } from './application/vendedor.use-cases.js';
import { createVendedorPostgresRepository } from './infrastructure/vendedor.postgres-repository.js';
import { createVendedorController } from './presentation/vendedor.controller.js';
import { createVendedorRoutes } from './presentation/vendedor.routes.js';

// Composición del módulo: las dependencias se inyectan desde afuera.
export function createVendedorModule(db) {
  const repository = createVendedorPostgresRepository(db);
  const useCases = createVendedorUseCases(repository);
  const controller = createVendedorController(useCases);
  return createVendedorRoutes(controller);
}
