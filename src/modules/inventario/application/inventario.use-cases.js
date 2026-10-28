import { validateMovimiento } from '../domain/movimiento.js';
import { positiveInteger } from '../../../shared/domain/validation.js';

export function createInventarioUseCases(repository) {
  return {
    list(pagination, productoId) { return repository.list(pagination, productoId); },
    create(input, actor) {
      const data = validateMovimiento(input);
      return repository.create({ ...data, registrado_por: positiveInteger(actor?.id, 'usuario autenticado') });
    },
  };
}
