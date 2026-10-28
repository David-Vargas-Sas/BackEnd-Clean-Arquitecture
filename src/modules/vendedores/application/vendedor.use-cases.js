import { createCrudUseCases } from '../../../shared/application/crud-use-cases.js';
import { validateVendedor, validateVendedorPatch } from '../domain/vendedor.js';

export function createVendedorUseCases(repository) {
  return createCrudUseCases(repository, validateVendedor, validateVendedorPatch);
}
