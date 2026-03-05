// =========================================
// ECO MONTH — Transactions: Controller
// =========================================

import { Request, Response, NextFunction } from 'express';
import * as service from './transactions.service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listTransactions(req.user!.userId, req.query as any);
    sendPaginated(res, result.transactions, result.total, result.page, result.perPage);
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await service.getTransaction(req.user!.userId, +req.params.id);
    sendSuccess(res, transaction);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await service.createTransaction(req.user!.userId, req.body);
    sendCreated(res, transaction);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await service.updateTransaction(req.user!.userId, +req.params.id, req.body);
    sendSuccess(res, transaction, 'Transação atualizada');
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteTransaction(req.user!.userId, +req.params.id);
    sendNoContent(res);
  } catch (err) { next(err); }
}

export async function togglePaid(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await service.togglePaidStatus(req.user!.userId, +req.params.id);
    sendSuccess(res, transaction, 'Status atualizado');
  } catch (err) { next(err); }
}

export async function transfer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createTransfer(req.user!.userId, req.body);
    sendCreated(res, result, 'Transferência realizada');
  } catch (err) { next(err); }
}
