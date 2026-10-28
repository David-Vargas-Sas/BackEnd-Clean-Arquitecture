import { parseId, parsePagination } from './request-parsers.js';

export function createCrudController(useCases, basePath) {
  return {
    async list(req, res) {
      const pagination = parsePagination(req.query);
      res.json({ data: await useCases.list(pagination, req.query), pagination });
    },
    async find(req, res) {
      res.json({ data: await useCases.find(parseId(req.params.id)) });
    },
    async create(req, res) {
      const record = await useCases.create(req.body, req.user);
      res.location(`${basePath}/${record.id}`).status(201).json({ data: record });
    },
    async update(req, res) {
      res.json({ data: await useCases.update(parseId(req.params.id), req.body, req.user) });
    },
    async remove(req, res) {
      await useCases.remove(parseId(req.params.id));
      res.status(204).end();
    },
    async patch(req, res) {
      res.json({ data: await useCases.patch(parseId(req.params.id), req.body, req.user) });
    },
  };
}
