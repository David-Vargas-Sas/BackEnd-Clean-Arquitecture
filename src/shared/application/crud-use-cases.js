import { NotFoundError } from '../domain/errors.js';
import { positiveInteger } from '../domain/validation.js';

// Contrato del repositorio: list(limit, offset), find(id), create(data),
// update(id, data) y remove(id). No depende de Express ni de PostgreSQL.
export function createCrudUseCases(repository, validateInput, validatePatch) {
  function requireRecord(record) {
    if (!record) throw new NotFoundError();
    return record;
  }

  return {
    list({ limit, offset }, filters = {}) { return Object.keys(filters).length ? repository.list(limit, offset, filters) : repository.list(limit, offset); },
    async find(id) {
      return requireRecord(await repository.find(positiveInteger(id, 'id')));
    },
    create(input) { return repository.create(validateInput(input)); },
    async update(id, input) {
      positiveInteger(id, 'id');
      return requireRecord(await repository.update(id, validateInput(input)));
    },
    async remove(id) {
      requireRecord(await repository.remove(positiveInteger(id, 'id')));
    },
    async patch(id, input) {
      positiveInteger(id, 'id');
      return requireRecord(await repository.patch(id, validatePatch(input)));
    },
  };
}
