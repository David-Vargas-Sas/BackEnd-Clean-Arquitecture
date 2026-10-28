import { createCrudRouter } from '../../../shared/presentation/http/crud-router.js';

export function createVendedorRoutes(controller) {
  return createCrudRouter(controller);
}
