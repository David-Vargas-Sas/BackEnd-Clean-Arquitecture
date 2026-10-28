import { Router } from 'express';

export function createCrudRouter(controller) {
  const router = Router();
  router.route('/').get(controller.list).post(controller.create);
  router.route('/:id').get(controller.find).put(controller.update).patch(controller.patch).delete(controller.remove);
  return router;
}
