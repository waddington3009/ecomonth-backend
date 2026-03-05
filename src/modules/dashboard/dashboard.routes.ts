// =========================================
// ECO MONTH — Dashboard: Service + Controller + Routes
// =========================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { sendSuccess } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth';
import { generateRecurringForMonth } from '../recurring/recurring.routes';

// --- Service ---

/**
 * Resumo mensal completo (KPIs, gastos por categoria, pendentes, etc.)
 */
async function getMonthSummary(userId: number, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Gerar recorrências automaticamente (se ainda não existem)
  await generateRecurringForMonth(userId, month, year);

  // Receitas do mês
  const receitas = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'receita',
      date: { gte: startDate, lte: endDate },
      status: { not: 'cancelado' },
    },
    _sum: { amount: true },
    _count: true,
  });

  // Despesas do mês
  const despesas = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'despesa',
      date: { gte: startDate, lte: endDate },
      status: { not: 'cancelado' },
    },
    _sum: { amount: true },
    _count: true,
  });

  const totalReceitas = Number(receitas._sum.amount || 0);
  const totalDespesas = Number(despesas._sum.amount || 0);
  const saldo = totalReceitas - totalDespesas;
  const taxaEconomia = totalReceitas > 0 ? Math.round(((totalReceitas - totalDespesas) / totalReceitas) * 100) : 0;

  // Contas pendentes
  const pendentes = await prisma.transaction.findMany({
    where: {
      userId,
      status: 'pendente',
      date: { gte: startDate, lte: endDate },
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  // Gastos por categoria (despesas)
  const gastosPorCategoria = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'despesa',
      date: { gte: startDate, lte: endDate },
      status: { not: 'cancelado' },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  // Preencher nomes das categorias
  const categoryIds = gastosPorCategoria.map((g) => g.categoryId).filter(Boolean) as number[];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const despesasPorCategoria = gastosPorCategoria.map((g) => ({
    categoryId: g.categoryId,
    category: g.categoryId ? categoryMap.get(g.categoryId) || null : null,
    amount: Number(g._sum.amount || 0),
  }));

  // Receitas por categoria
  const receitasPorCategoria = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'receita',
      date: { gte: startDate, lte: endDate },
      status: { not: 'cancelado' },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const recCatIds = receitasPorCategoria.map((g) => g.categoryId).filter(Boolean) as number[];
  const recCategories = await prisma.category.findMany({
    where: { id: { in: recCatIds } },
    select: { id: true, name: true, icon: true, color: true },
  });
  const recCatMap = new Map(recCategories.map((c) => [c.id, c]));

  // Saúde financeira (score 0-100)
  let healthScore = 50;
  if (totalReceitas > 0) {
    healthScore = Math.min(100, Math.max(0,
      Math.round((saldo / totalReceitas) * 100 + 50)
    ));
  }

  return {
    month,
    year,
    kpis: {
      totalReceitas,
      totalDespesas,
      saldo,
      taxaEconomia,
      totalTransacoes: (receitas._count || 0) + (despesas._count || 0),
      totalPendentes: pendentes.length,
    },
    healthScore,
    despesasPorCategoria,
    receitasPorCategoria: receitasPorCategoria.map((g) => ({
      categoryId: g.categoryId,
      category: g.categoryId ? recCatMap.get(g.categoryId) || null : null,
      amount: Number(g._sum.amount || 0),
    })),
    pendentes,
  };
}

/**
 * Evolução mensal (últimos N meses) para gráfico de tendência
 */
async function getMonthlyTrend(userId: number, months: number = 6) {
  const now = new Date();
  const data = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [receitas, despesas] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'receita',
          date: { gte: date, lte: endDate },
          status: { not: 'cancelado' },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'despesa',
          date: { gte: date, lte: endDate },
          status: { not: 'cancelado' },
        },
        _sum: { amount: true },
      }),
    ]);

    data.push({
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      label: `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear()}`,
      receitas: Number(receitas._sum.amount || 0),
      despesas: Number(despesas._sum.amount || 0),
      saldo: Number(receitas._sum.amount || 0) - Number(despesas._sum.amount || 0),
    });
  }

  return data;
}

/**
 * Fluxo de caixa projetado (próximos N dias)
 */
async function getCashFlow(userId: number, days: number = 30) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  // Saldo atual (todas transações pagas)
  const [receitasPagas, despesasPagas] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'receita', status: 'pago' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'despesa', status: 'pago' },
      _sum: { amount: true },
    }),
  ]);

  // Saldo inicial das contas
  const contas = await prisma.account.aggregate({
    where: { userId, isActive: true },
    _sum: { initialBalance: true },
  });

  const saldoAtual =
    Number(contas._sum.initialBalance || 0) +
    Number(receitasPagas._sum.amount || 0) -
    Number(despesasPagas._sum.amount || 0);

  // Transações pendentes no período
  const pendentes = await prisma.transaction.findMany({
    where: {
      userId,
      status: 'pendente',
      date: { gte: today, lte: futureDate },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      type: true,
      description: true,
      amount: true,
      date: true,
    },
  });

  // Projeção dia a dia
  let saldoProjetado = saldoAtual;
  const projecao = pendentes.map((t) => {
    const amount = Number(t.amount);
    if (t.type === 'receita') {
      saldoProjetado += amount;
    } else {
      saldoProjetado -= amount;
    }
    return { ...t, amount, saldoProjetado };
  });

  return {
    saldoAtual,
    saldoProjetado,
    projecao,
  };
}

/**
 * Totais das contas (saldos atuais)
 */
async function getAccountBalances(userId: number) {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
  });

  const balances = await Promise.all(
    accounts.map(async (acc) => {
      const [receitas, despesas] = await Promise.all([
        prisma.transaction.aggregate({
          where: { accountId: acc.id, userId, status: 'pago', type: 'receita' },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { accountId: acc.id, userId, status: 'pago', type: 'despesa' },
          _sum: { amount: true },
        }),
      ]);

      const currentBalance =
        Number(acc.initialBalance) +
        Number(receitas._sum.amount || 0) -
        Number(despesas._sum.amount || 0);

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        color: acc.color,
        icon: acc.icon,
        initialBalance: Number(acc.initialBalance),
        currentBalance,
      };
    })
  );

  const totalBalance = balances.reduce((acc, b) => acc + b.currentBalance, 0);

  return { accounts: balances, totalBalance };
}

// --- Controller ---
async function summaryCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    sendSuccess(res, await getMonthSummary(req.user!.userId, month, year));
  } catch (e) { next(e); }
}

async function trendCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const months = Number(req.query.months) || 6;
    sendSuccess(res, await getMonthlyTrend(req.user!.userId, months));
  } catch (e) { next(e); }
}

async function cashFlowCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const days = Number(req.query.days) || 30;
    sendSuccess(res, await getCashFlow(req.user!.userId, days));
  } catch (e) { next(e); }
}

async function balancesCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await getAccountBalances(req.user!.userId));
  } catch (e) { next(e); }
}

// --- Routes ---
const router = Router();
router.use(authMiddleware);

router.get('/summary', summaryCtrl);
router.get('/trend', trendCtrl);
router.get('/cash-flow', cashFlowCtrl);
router.get('/balances', balancesCtrl);

export default router;
