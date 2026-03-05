// =========================================
// ECO MONTH — Transactions: Service
// =========================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { CreateTransactionInput, UpdateTransactionInput, TransactionFilter, TransferInput } from './transactions.schema';

// ===== LISTAR COM FILTROS =====
export async function listTransactions(userId: number, filters: TransactionFilter) {
  const page = parseInt(filters.page) || 1;
  const perPage = Math.min(parseInt(filters.perPage) || 50, 200);
  const skip = (page - 1) * perPage;

  const where: Prisma.TransactionWhereInput = { userId };

  // Filtro por mês/ano
  if (filters.month && filters.year) {
    const m = parseInt(filters.month);
    const y = parseInt(filters.year);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0); // último dia do mês
    where.date = { gte: startDate, lte: endDate };
  } else if (filters.year) {
    const y = parseInt(filters.year);
    where.date = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) };
  }

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categoryId = parseInt(filters.categoryId);
  if (filters.accountId) where.accountId = parseInt(filters.accountId);
  if (filters.search) {
    where.description = { contains: filters.search };
  }

  const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
  const sortField = filters.sortBy === 'created_at' ? 'createdAt' : filters.sortBy;
  (orderBy as any)[sortField] = filters.sortOrder;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true, type: true } },
        account: { select: { id: true, name: true, color: true, icon: true } },
        creditCard: { select: { id: true, name: true, color: true, lastFourDigits: true } },
        transactionTags: { include: { tag: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, perPage };
}

// ===== OBTER UMA =====
export async function getTransaction(userId: number, transactionId: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: {
      category: true,
      account: true,
      creditCard: true,
      transactionTags: { include: { tag: true } },
    },
  });
  if (!transaction) throw ApiError.notFound('Transação não encontrada');
  return transaction;
}

// ===== CRIAR =====
export async function createTransaction(userId: number, data: CreateTransactionInput) {
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      accountId: data.accountId || null,
      categoryId: data.categoryId || null,
      creditCardId: data.creditCardId || null,
      type: data.type,
      description: data.description,
      amount: data.amount,
      date: new Date(data.date),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status || 'pendente',
      notes: data.notes || null,
      ...(data.tagIds && data.tagIds.length > 0
        ? {
            transactionTags: {
              create: data.tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: {
      category: true,
      account: true,
      transactionTags: { include: { tag: true } },
    },
  });

  // Atualizar fatura do cartão se vinculada
  if (data.creditCardId) {
    await updateInvoiceTotal(data.creditCardId, new Date(data.date));
  }

  return transaction;
}

// ===== ATUALIZAR =====
export async function updateTransaction(userId: number, transactionId: number, data: UpdateTransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!existing) throw ApiError.notFound('Transação não encontrada');

  // Atualizar tags se fornecidas
  if (data.tagIds !== undefined) {
    await prisma.transactionTag.deleteMany({ where: { transactionId } });
    if (data.tagIds && data.tagIds.length > 0) {
      await prisma.transactionTag.createMany({
        data: data.tagIds.map((tagId) => ({ transactionId, tagId })),
      });
    }
  }

  const { tagIds, ...updateData } = data;

  const transaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      ...updateData,
      ...(updateData.date ? { date: new Date(updateData.date) } : {}),
      ...(updateData.dueDate !== undefined
        ? { dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null }
        : {}),
    },
    include: {
      category: true,
      account: true,
      transactionTags: { include: { tag: true } },
    },
  });

  return transaction;
}

// ===== DELETAR =====
export async function deleteTransaction(userId: number, transactionId: number) {
  const existing = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!existing) throw ApiError.notFound('Transação não encontrada');

  await prisma.transaction.delete({ where: { id: transactionId } });

  // Atualizar fatura se vinculada a cartão
  if (existing.creditCardId) {
    await updateInvoiceTotal(existing.creditCardId, existing.date);
  }
}

// ===== MARCAR COMO PAGO =====
export async function togglePaidStatus(userId: number, transactionId: number) {
  const existing = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!existing) throw ApiError.notFound('Transação não encontrada');

  const newStatus = existing.status === 'pago' ? 'pendente' : 'pago';
  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: newStatus,
      paidDate: newStatus === 'pago' ? new Date() : null,
    },
    include: { category: true, account: true },
  });
}

// ===== TRANSFERÊNCIA =====
export async function createTransfer(userId: number, data: TransferInput) {
  return prisma.$transaction(async (tx) => {
    // Criar transação de saída
    const fromTx = await tx.transaction.create({
      data: {
        userId,
        accountId: data.fromAccountId,
        type: 'transferencia',
        description: data.description || 'Transferência enviada',
        amount: data.amount,
        date: new Date(data.date),
        status: 'pago',
        paidDate: new Date(data.date),
      },
    });

    // Criar transação de entrada
    const toTx = await tx.transaction.create({
      data: {
        userId,
        accountId: data.toAccountId,
        type: 'transferencia',
        description: data.description || 'Transferência recebida',
        amount: data.amount,
        date: new Date(data.date),
        status: 'pago',
        paidDate: new Date(data.date),
      },
    });

    // Vincular na tabela transfers
    const transfer = await tx.transfer.create({
      data: {
        userId,
        fromTransactionId: fromTx.id,
        toTransactionId: toTx.id,
        amount: data.amount,
        date: new Date(data.date),
        description: data.description,
      },
    });

    return transfer;
  });
}

// ===== HELPER: Atualizar total da fatura =====
async function updateInvoiceTotal(creditCardId: number, date: Date) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const invoice = await prisma.creditCardInvoice.findUnique({
    where: {
      creditCardId_referenceMonth_referenceYear: {
        creditCardId,
        referenceMonth: month,
        referenceYear: year,
      },
    },
  });

  if (invoice) {
    const total = await prisma.transaction.aggregate({
      where: { invoiceId: invoice.id, type: 'despesa' },
      _sum: { amount: true },
    });
    await prisma.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { totalAmount: total._sum.amount || 0 },
    });
  }
}
