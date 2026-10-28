import { createCrudController } from '../../../shared/presentation/http/crud-controller.js';

export function createVendedorController(useCases) {
  return createCrudController(useCases, '/api/vendedores');
}
