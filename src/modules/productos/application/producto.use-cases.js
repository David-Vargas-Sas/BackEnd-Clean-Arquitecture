import { createCrudUseCases } from '../../../shared/application/crud-use-cases.js';
import { validateProducto, validateProductoPatch } from '../domain/producto.js';

export function createProductoUseCases(repository) {
  return createCrudUseCases(repository, validateProducto, validateProductoPatch);
}
