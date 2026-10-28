import { validateUsuario, validateUsuarioPatch } from '../domain/usuario.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { positiveInteger } from '../../../shared/domain/validation.js';

export function createUsuarioUseCases(repository, passwords) {
  return {
    list(pagination, filters = {}) { return repository.list(pagination, filters); },
    async find(id) {
      const user = await repository.find(positiveInteger(id, 'id'));
      if (!user) throw new NotFoundError();
      return user;
    },
    async create(input, actor) {
      const { password, ...data } = validateUsuario(input);
      return repository.create({ ...data, password_hash: await passwords.hash(password), modificado_por: positiveInteger(actor?.id, 'actor') });
    },
    async patch(id, input, actor) {
      positiveInteger(id, 'id');
      const { password, ...data } = validateUsuarioPatch(input);
      if (password !== undefined) data.password_hash = await passwords.hash(password);
      data.modificado_por = positiveInteger(actor?.id, 'actor');
      const user = await repository.patch(id, data);
      if (!user) throw new NotFoundError();
      return user;
    },
  };
}
