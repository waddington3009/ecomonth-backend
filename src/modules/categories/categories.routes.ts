// =========================================
// ECO MONTH — Categories: Rotas
// =========================================

import { Router } from 'express';
import * as controller from './categories.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schema';

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', validate(createCategorySchema), controller.create);
router.patch('/:id', validate(updateCategorySchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
