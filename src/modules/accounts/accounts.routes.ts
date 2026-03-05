// =========================================
// ECO MONTH — Accounts: Rotas
// =========================================

import { Router } from 'express';
import * as controller from './accounts.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createAccountSchema, updateAccountSchema } from './accounts.schema';

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', validate(createAccountSchema), controller.create);
router.patch('/:id', validate(updateAccountSchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
