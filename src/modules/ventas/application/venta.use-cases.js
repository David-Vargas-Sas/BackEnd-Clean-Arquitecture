import { createCrudUseCases } from '../../../shared/application/crud-use-cases.js';
import { validateVenta, validateVentaPatch } from '../domain/venta.js';
import { positiveInteger } from '../../../shared/domain/validation.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export function createVentaUseCases(repository) {
  return {
    ...createCrudUseCases(repository, validateVenta, validateVentaPatch),
    create(input, actor) {
      const data = validateVenta(input);
      return repository.create({ ...data, registrado_por: positiveInteger(actor?.id, 'usuario autenticado') });
    },
    async update(id, input, actor) {
      positiveInteger(id, 'id');
      const data = validateVenta(input);
      const row = await repository.update(id, { ...data, modificado_por: positiveInteger(actor?.id, 'usuario autenticado') });
      if (!row) throw new NotFoundError();
      return row;
    },
    async patch(id, input, actor) {
      positiveInteger(id, 'id');
      const data = validateVentaPatch(input);
      const row = await repository.patch(id, { ...data, modificado_por: positiveInteger(actor?.id, 'usuario autenticado') });
      if (!row) throw new NotFoundError();
      return row;
    },
  };
}
