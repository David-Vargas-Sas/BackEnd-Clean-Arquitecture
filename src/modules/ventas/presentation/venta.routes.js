import { Router } from 'express';

export function createVentaRoutes(controller) {
  const router = Router();
  router.route('/').get(controller.list).post(controller.create);
  router.route('/:id').get(controller.find).put(controller.update).patch(controller.patch).delete((req, res) => {
    res.setHeader('Allow', 'GET, HEAD, PUT, PATCH');
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Las ventas se anulan mediante PATCH; no se eliminan.', requestId: req.requestId } });
  });
  return router;
}
