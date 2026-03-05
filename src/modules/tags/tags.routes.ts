// =========================================
// ECO MONTH — Tags: Schema + Service + Controller + Routes
// =========================================

import { z } from 'zod';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';

// --- Schema ---
export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).default('#8b5cf6'),
});
export const updateTagSchema = createTagSchema.partial();

// --- Service ---
async function listTags(userId: number) {
  return prisma.tag.findMany({ where: { userId }, orderBy: { name: 'asc' } });
}

async function createTag(userId: number, data: z.infer<typeof createTagSchema>) {
  const existing = await prisma.tag.findUnique({
    where: { userId_name: { userId, name: data.name } },
  });
  if (existing) throw ApiError.conflict('Tag já existe');
  return prisma.tag.create({ data: { userId, ...data } });
}

async function updateTag(userId: number, tagId: number, data: z.infer<typeof updateTagSchema>) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!tag) throw ApiError.notFound('Tag não encontrada');
  return prisma.tag.update({ where: { id: tagId }, data });
}

async function deleteTag(userId: number, tagId: number) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!tag) throw ApiError.notFound('Tag não encontrada');
  await prisma.tag.delete({ where: { id: tagId } });
}

// --- Controller ---
async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listTags(req.user!.userId)); } catch (e) { next(e); }
}
async function create(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createTag(req.user!.userId, req.body)); } catch (e) { next(e); }
}
async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateTag(req.user!.userId, +req.params.id, req.body)); } catch (e) { next(e); }
}
async function remove(req: Request, res: Response, next: NextFunction) {
  try { await deleteTag(req.user!.userId, +req.params.id); sendNoContent(res); } catch (e) { next(e); }
}

// --- Routes ---
const router = Router();
router.use(authMiddleware);
router.get('/', list);
router.post('/', validate(createTagSchema), create);
router.patch('/:id', validate(updateTagSchema), update);
router.delete('/:id', remove);

export default router;
