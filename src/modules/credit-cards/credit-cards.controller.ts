// =========================================
// ECO MONTH — Credit Cards: Controller
// =========================================

import { Request, Response, NextFunction } from 'express';
import * as service from './credit-cards.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function listCards(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.listCreditCards(req.user!.userId)); } catch (e) { next(e); }
}

export async function getCard(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.getCreditCard(req.user!.userId, +req.params.id)); } catch (e) { next(e); }
}

export async function createCard(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.createCreditCard(req.user!.userId, req.body)); } catch (e) { next(e); }
}

export async function updateCard(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.updateCreditCard(req.user!.userId, +req.params.id, req.body), 'Cartão atualizado'); } catch (e) { next(e); }
}

export async function deleteCard(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteCreditCard(req.user!.userId, +req.params.id); sendNoContent(res); } catch (e) { next(e); }
}

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.listInvoices(req.user!.userId, +req.params.id)); } catch (e) { next(e); }
}

export async function payInvoice(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.payInvoice(req.user!.userId, +req.params.invoiceId, req.body), 'Fatura paga'); } catch (e) { next(e); }
}

export async function createPurchase(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.createPurchase(req.user!.userId, req.body), 'Compra registrada'); } catch (e) { next(e); }
}
