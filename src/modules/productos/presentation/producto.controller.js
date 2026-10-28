import { createCrudController } from '../../../shared/presentation/http/crud-controller.js';

export function createProductoController(useCases) {
  return createCrudController(useCases, '/api/productos');
}
