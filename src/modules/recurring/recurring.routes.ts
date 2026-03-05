// =========================================
// ECO MONTH — Recurring: Schema + Service + Controller + Routes
// =========================================

import { z } from 'zod';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';

// --- Schema ---
export const createRecurringSchema = z.object({
  accountId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  type: z.enum(['receita', 'despesa']),
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  frequency: z.enum(['semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida').nullable().optional(),
  autoMarkPaid: z.boolean().default(false),
});

export const updateRecurringSchema = createRecurringSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// --- Service ---
async function listRecurring(userId: number) {
  return prisma.recurringTransaction.findMany({
    where: { userId },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      account: { select: { id: true, name: true } },
    },
    orderBy: { description: 'asc' },
  });
}

async function createRecurring(userId: number, data: z.infer<typeof createRecurringSchema>) {
  return prisma.recurringTransaction.create({
    data: {
      userId,
      accountId: data.accountId || null,
      categoryId: data.categoryId || null,
      type: data.type,
      description: data.description,
      amount: data.amount,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      autoMarkPaid: data.autoMarkPaid,
    },
    include: { category: true, account: true },
  });
}

async function updateRecurring(userId: number, id: number, data: z.infer<typeof updateRecurringSchema>) {
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Recorrência não encontrada');

  const { startDate, endDate, ...rest } = data;
  return prisma.recurringTransaction.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    },
    include: { category: true, account: true },
  });
}

async function deleteRecurring(userId: number, id: number) {
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Recorrência não encontrada');
  await prisma.recurringTransaction.delete({ where: { id } });
}

/**
 * Gera transações automáticas para o mês/ano especificado.
 * Chamado no login ou manualmente pelo usuário.
 */
export async function generateRecurringForMonth(userId: number, month: number, year: number) {
  const recurrings = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      isActive: true,
      startDate: { lte: new Date(year, month, 0) }, // até o último dia do mês
    },
  });

  let created = 0;

  for (const rec of recurrings) {
    // Verificar se já existe transação dessa recorrência no mês
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    // Se tem endDate e já passou, pular
    if (rec.endDate && rec.endDate < startOfMonth) continue;

    const existing = await prisma.transaction.findFirst({
      where: {
        recurringId: rec.id,
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (!existing) {
      const day = rec.dayOfMonth || 1;
      const transactionDate = new Date(year, month - 1, Math.min(day, endOfMonth.getDate()));

      await prisma.transaction.create({
        data: {
          userId,
          accountId: rec.accountId,
          categoryId: rec.categoryId,
          recurringId: rec.id,
          type: rec.type,
          description: rec.description,
          amount: rec.amount,
          date: transactionDate,
          dueDate: transactionDate,
          status: rec.autoMarkPaid ? 'pago' : 'pendente',
          paidDate: rec.autoMarkPaid ? transactionDate : null,
        },
      });
      created++;
    }
  }

  return { created, month, year };
}

// --- Controller ---
async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listRecurring(req.user!.userId)); } catch (e) { next(e); }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createRecurring(req.user!.userId, req.body)); } catch (e) { next(e); }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateRecurring(req.user!.userId, +req.params.id, req.body), 'Recorrência atualizada'); } catch (e) { next(e); }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try { await deleteRecurring(req.user!.userId, +req.params.id); sendNoContent(res); } catch (e) { next(e); }
}

async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    if (!month || !year) throw ApiError.badRequest('Informe mês e ano');
    const result = await generateRecurringForMonth(req.user!.userId, month, year);
    sendSuccess(res, result, `${result.created} transações recorrentes geradas`);
  } catch (e) { next(e); }
}

// --- Routes ---
const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', validate(createRecurringSchema), create);
router.patch('/:id', validate(updateRecurringSchema), update);
router.delete('/:id', remove);
router.post('/generate', generate);

export default router;
