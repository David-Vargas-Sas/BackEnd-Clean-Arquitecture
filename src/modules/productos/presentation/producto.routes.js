import { createCrudRouter } from '../../../shared/presentation/http/crud-router.js';

export function createProductoRoutes(controller) {
  return createCrudRouter(controller);
}
