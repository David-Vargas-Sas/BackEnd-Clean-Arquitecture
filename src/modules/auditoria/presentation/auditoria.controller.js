import { parsePagination, parseId } from '../../../shared/presentation/http/request-parsers.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export function createAuditoriaController(useCases) {
  return {
    async list(req, res) {
      const pagination = parsePagination(req.query);
      const entidad = req.query.entidad ?? null;
      if (entidad !== null && !['ventas', 'usuarios'].includes(entidad)) throw new ValidationError('entidad debe ser ventas o usuarios.');
      const registroId = req.query.registro_id === undefined ? null : parseId(req.query.registro_id);
      res.json({ data: await useCases.list({ entidad, registroId, ...pagination }), pagination });
    },
  };
}
