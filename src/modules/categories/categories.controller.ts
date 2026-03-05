// =========================================
// ECO MONTH — Categories: Controller
// =========================================

import { Request, Response, NextFunction } from 'express';
import * as service from './categories.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await service.listCategories(req.user!.userId);
    sendSuccess(res, categories);
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await service.getCategory(req.user!.userId, Number(req.params.id));
    sendSuccess(res, category);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await service.createCategory(req.user!.userId, req.body);
    sendCreated(res, category);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await service.updateCategory(req.user!.userId, Number(req.params.id), req.body);
    sendSuccess(res, category, 'Categoria atualizada');
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteCategory(req.user!.userId, Number(req.params.id));
    sendNoContent(res);
  } catch (err) { next(err); }
}
