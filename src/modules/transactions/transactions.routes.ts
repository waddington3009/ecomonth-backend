// =========================================
// ECO MONTH — Transactions: Rotas
// =========================================

import { Router } from 'express';
import * as controller from './transactions.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createTransactionSchema, updateTransactionSchema, transferSchema } from './transactions.schema';

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', validate(createTransactionSchema), controller.create);
router.patch('/:id', validate(updateTransactionSchema), controller.update);
router.delete('/:id', controller.remove);
router.patch('/:id/toggle-paid', controller.togglePaid);
router.post('/transfer', validate(transferSchema), controller.transfer);

export default router;
