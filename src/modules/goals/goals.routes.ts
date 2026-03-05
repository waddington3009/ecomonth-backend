// =========================================
// ECO MONTH — Savings Goals: Schema + Service + Controller + Routes
// =========================================

import { z } from 'zod';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';

// --- Schema ---
export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  deadline: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida').nullable().optional(),
  icon: z.string().max(50).default('piggy-bank'),
  color: z.string().max(7).default('#22c55e'),
});

export const updateGoalSchema = createGoalSchema.partial();

export const contributionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['deposito', 'retirada']),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
  note: z.string().max(255).nullable().optional(),
});

// --- Service ---
async function listGoals(userId: number) {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    include: {
      contributions: { orderBy: { date: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return goals.map((goal) => {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const percentage = targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0;
    return { ...goal, percentage };
  });
}

async function getGoal(userId: number, goalId: number) {
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId },
    include: {
      contributions: { orderBy: { date: 'desc' } },
    },
  });
  if (!goal) throw ApiError.notFound('Meta não encontrada');

  const targetAmount = Number(goal.targetAmount);
  const currentAmount = Number(goal.currentAmount);
  const percentage = targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0;
  return { ...goal, percentage };
}

async function createGoal(userId: number, data: z.infer<typeof createGoalSchema>) {
  return prisma.savingsGoal.create({
    data: {
      userId,
      name: data.name,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : null,
      icon: data.icon,
      color: data.color,
    },
  });
}

async function updateGoal(userId: number, goalId: number, data: z.infer<typeof updateGoalSchema>) {
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw ApiError.notFound('Meta não encontrada');

  const { deadline, ...rest } = data;
  return prisma.savingsGoal.update({
    where: { id: goalId },
    data: {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    },
  });
}

async function deleteGoal(userId: number, goalId: number) {
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw ApiError.notFound('Meta não encontrada');
  await prisma.savingsGoal.delete({ where: { id: goalId } });
}

async function addContribution(userId: number, goalId: number, data: z.infer<typeof contributionSchema>) {
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw ApiError.notFound('Meta não encontrada');

  const currentAmount = Number(goal.currentAmount);
  let newAmount: number;

  if (data.type === 'deposito') {
    newAmount = currentAmount + data.amount;
  } else {
    newAmount = currentAmount - data.amount;
    if (newAmount < 0) throw ApiError.badRequest('Saldo insuficiente na meta');
  }

  const isCompleted = newAmount >= Number(goal.targetAmount);

  // Criar contribuição e atualizar meta em transação
  const [contribution] = await prisma.$transaction([
    prisma.savingsGoalContribution.create({
      data: {
        goalId,
        amount: data.amount,
        type: data.type,
        date: new Date(data.date),
        note: data.note || null,
      },
    }),
    prisma.savingsGoal.update({
      where: { id: goalId },
      data: { currentAmount: newAmount, isCompleted },
    }),
  ]);

  return contribution;
}

// --- Controller & Routes ---
async function listCtrl(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listGoals(req.user!.userId)); } catch (e) { next(e); }
}
async function getCtrl(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getGoal(req.user!.userId, +req.params.id)); } catch (e) { next(e); }
}
async function createCtrl(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createGoal(req.user!.userId, req.body)); } catch (e) { next(e); }
}
async function updateCtrl(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateGoal(req.user!.userId, +req.params.id, req.body), 'Meta atualizada'); } catch (e) { next(e); }
}
async function removeCtrl(req: Request, res: Response, next: NextFunction) {
  try { await deleteGoal(req.user!.userId, +req.params.id); sendNoContent(res); } catch (e) { next(e); }
}
async function contributeCtrl(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await addContribution(req.user!.userId, +req.params.id, req.body), 'Contribuição registrada'); } catch (e) { next(e); }
}

const router = Router();
router.use(authMiddleware);

router.get('/', listCtrl);
router.get('/:id', getCtrl);
router.post('/', validate(createGoalSchema), createCtrl);
router.patch('/:id', validate(updateGoalSchema), updateCtrl);
router.delete('/:id', removeCtrl);
router.post('/:id/contributions', validate(contributionSchema), contributeCtrl);

export default router;
