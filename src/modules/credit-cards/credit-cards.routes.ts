// =========================================
// ECO MONTH — Credit Cards: Rotas
// =========================================

import { Router } from 'express';
import * as controller from './credit-cards.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createCreditCardSchema, updateCreditCardSchema, createPurchaseSchema, payInvoiceSchema } from './credit-cards.schema';

const router = Router();
router.use(authMiddleware);

// Cartões
router.get('/', controller.listCards);
router.get('/:id', controller.getCard);
router.post('/', validate(createCreditCardSchema), controller.createCard);
router.patch('/:id', validate(updateCreditCardSchema), controller.updateCard);
router.delete('/:id', controller.deleteCard);

// Faturas
router.get('/:id/invoices', controller.listInvoices);
router.post('/invoices/:invoiceId/pay', validate(payInvoiceSchema), controller.payInvoice);

// Compras parceladas
router.post('/purchases', validate(createPurchaseSchema), controller.createPurchase);

export default router;
