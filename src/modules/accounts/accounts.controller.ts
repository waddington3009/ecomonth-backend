// =========================================
// ECO MONTH — Accounts: Controller
// =========================================

import { Request, Response, NextFunction } from 'express';
import * as service from './accounts.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await service.listAccounts(req.user!.userId);
    sendSuccess(res, accounts);
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await service.getAccount(req.user!.userId, Number(req.params.id));
    sendSuccess(res, account);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await service.createAccount(req.user!.userId, req.body);
    sendCreated(res, account);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await service.updateAccount(req.user!.userId, Number(req.params.id), req.body);
    sendSuccess(res, account, 'Conta atualizada');
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteAccount(req.user!.userId, Number(req.params.id));
    sendNoContent(res);
  } catch (err) { next(err); }
}
