import { createVentaUseCases } from './application/venta.use-cases.js';
import { createVentaPostgresRepository } from './infrastructure/venta.postgres-repository.js';
import { createVentaController } from './presentation/venta.controller.js';
import { createVentaRoutes } from './presentation/venta.routes.js';

// Composición del módulo: las dependencias se inyectan desde afuera.
export function createVentaModule(db) {
  const repository = createVentaPostgresRepository(db);
  const useCases = createVentaUseCases(repository);
  const controller = createVentaController(useCases);
  return createVentaRoutes(controller);
}
