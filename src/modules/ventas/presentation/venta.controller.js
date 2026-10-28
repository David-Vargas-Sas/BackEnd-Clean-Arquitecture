import { createCrudController } from '../../../shared/presentation/http/crud-controller.js';

export function createVentaController(useCases) {
  return createCrudController(useCases, '/api/ventas');
}
