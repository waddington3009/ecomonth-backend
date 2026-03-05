// =========================================
// ECO MONTH — Budgets: Schema + Service + Controller + Routes
// =========================================

import { z } from 'zod';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';

// --- Schema ---
export const createBudgetSchema = z.object({
  categoryId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2099),
  limitAmount: z.number().positive(),
  alertPercentage: z.number().int().min(0).max(100).default(80),
});

export const updateBudgetSchema = z.object({
  limitAmount: z.number().positive().optional(),
  alertPercentage: z.number().int().min(0).max(100).optional(),
});

// --- Service ---
async function listBudgets(userId: number, month?: number, year?: number) {
  const where: any = { userId };
  if (month) where.month = month;
  if (year) where.year = year;

  const budgets = await prisma.budget.findMany({
    where,
    include: { category: { select: { id: true, name: true, icon: true, color: true, type: true } } },
    orderBy: { category: { name: 'asc' } },
  });

  // Calcular gastos atuais por categoria
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const startDate = new Date(budget.year, budget.month - 1, 1);
      const endDate = new Date(budget.year, budget.month, 0);

      const spent = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: 'despesa',
          status: { in: ['pago', 'pendente'] },
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      const spentAmount = Number(spent._sum.amount || 0);
      const limitAmount = Number(budget.limitAmount);
      const percentage = limitAmount > 0 ? Math.round((spentAmount / limitAmount) * 100) : 0;
      const isOverBudget = spentAmount > limitAmount;
      const isAlerted = percentage >= budget.alertPercentage;

      return { ...budget, spentAmount, percentage, isOverBudget, isAlerted };
    })
  );

  return budgetsWithSpent;
}

async function createBudget(userId: number, data: z.infer<typeof createBudgetSchema>) {
  // Verificar se já existe
  const existing = await prisma.budget.findUnique({
    where: {
      userId_categoryId_month_year: {
        userId,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
      },
    },
  });
  if (existing) throw ApiError.conflict('Já existe um orçamento para esta categoria neste mês');

  return prisma.budget.create({
    data: { userId, ...data },
    include: { category: true },
  });
}

async function updateBudget(userId: number, budgetId: number, data: z.infer<typeof updateBudgetSchema>) {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, userId } });
  if (!budget) throw ApiError.notFound('Orçamento não encontrado');
  return prisma.budget.update({
    where: { id: budgetId },
    data,
    include: { category: true },
  });
}

async function deleteBudget(userId: number, budgetId: number) {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, userId } });
  if (!budget) throw ApiError.notFound('Orçamento não encontrado');
  await prisma.budget.delete({ where: { id: budgetId } });
}

// --- Controller ---
async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.query;
    sendSuccess(res, await listBudgets(
      req.user!.userId,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    ));
  } catch (e) { next(e); }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createBudget(req.user!.userId, req.body)); } catch (e) { next(e); }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateBudget(req.user!.userId, +req.params.id, req.body), 'Orçamento atualizado'); } catch (e) { next(e); }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try { await deleteBudget(req.user!.userId, +req.params.id); sendNoContent(res); } catch (e) { next(e); }
}

// --- Routes ---
const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', validate(createBudgetSchema), create);
router.patch('/:id', validate(updateBudgetSchema), update);
router.delete('/:id', remove);

export default router;
