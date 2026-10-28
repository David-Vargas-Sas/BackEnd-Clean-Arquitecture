import { parseId, parsePagination } from '../../../shared/presentation/http/request-parsers.js';

export function createInventarioController(useCases) {
  return {
    async list(req, res) {
      const pagination = parsePagination(req.query);
      const productoId = req.query.producto_id === undefined ? undefined : parseId(req.query.producto_id);
      res.json({ data: await useCases.list(pagination, productoId), pagination });
    },
    async create(req, res) {
      res.status(201).json({ data: await useCases.create(req.body, req.user) });
    },
  };
}
