// =========================================
// ECO MONTH — Accounts: Service
// =========================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { CreateAccountInput, UpdateAccountInput } from './accounts.schema';

export async function listAccounts(userId: number) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  // Calcular saldo atual de cada conta
  const accountsWithBalance = await Promise.all(
    accounts.map(async (acc) => {
      const result = await prisma.transaction.aggregate({
        where: {
          accountId: acc.id,
          userId,
          status: 'pago',
        },
        _sum: { amount: true },
      });

      // Receitas somam, despesas subtraem
      const receitas = await prisma.transaction.aggregate({
        where: { accountId: acc.id, userId, status: 'pago', type: 'receita' },
        _sum: { amount: true },
      });
      const despesas = await prisma.transaction.aggregate({
        where: { accountId: acc.id, userId, status: 'pago', type: 'despesa' },
        _sum: { amount: true },
      });

      const currentBalance =
        Number(acc.initialBalance) +
        Number(receitas._sum.amount || 0) -
        Number(despesas._sum.amount || 0);

      return { ...acc, currentBalance };
    })
  );

  return accountsWithBalance;
}

export async function getAccount(userId: number, accountId: number) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw ApiError.notFound('Conta não encontrada');
  return account;
}

export async function createAccount(userId: number, data: CreateAccountInput) {
  return prisma.account.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      initialBalance: data.initialBalance,
      color: data.color,
      icon: data.icon,
    },
  });
}

export async function updateAccount(userId: number, accountId: number, data: UpdateAccountInput) {
  await getAccount(userId, accountId); // verifica se existe
  return prisma.account.update({
    where: { id: accountId },
    data,
  });
}

export async function deleteAccount(userId: number, accountId: number) {
  await getAccount(userId, accountId);
  await prisma.account.delete({ where: { id: accountId } });
}
