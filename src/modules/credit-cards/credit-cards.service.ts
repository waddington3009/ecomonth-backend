// =========================================
// ECO MONTH — Credit Cards: Service
// =========================================

import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { CreateCreditCardInput, UpdateCreditCardInput, CreatePurchaseInput, PayInvoiceInput } from './credit-cards.schema';

// ===== CARTÕES =====
export async function listCreditCards(userId: number) {
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });

  // Calcular limite disponível de cada cartão
  const cardsWithUsage = await Promise.all(
    cards.map(async (card) => {
      const openInvoices = await prisma.creditCardInvoice.findMany({
        where: { creditCardId: card.id, status: { in: ['aberta', 'fechada'] } },
      });
      const usedAmount = openInvoices.reduce((acc, inv) => acc + Number(inv.totalAmount) - Number(inv.paidAmount), 0);
      const availableLimit = Number(card.creditLimit) - usedAmount;
      return { ...card, usedAmount, availableLimit };
    })
  );

  return cardsWithUsage;
}

export async function getCreditCard(userId: number, cardId: number) {
  const card = await prisma.creditCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw ApiError.notFound('Cartão não encontrado');
  return card;
}

export async function createCreditCard(userId: number, data: CreateCreditCardInput) {
  return prisma.creditCard.create({
    data: {
      userId,
      name: data.name,
      brand: data.brand,
      lastFourDigits: data.lastFourDigits || null,
      creditLimit: data.creditLimit,
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      paymentAccountId: data.paymentAccountId || null,
      color: data.color,
    },
  });
}

export async function updateCreditCard(userId: number, cardId: number, data: UpdateCreditCardInput) {
  await getCreditCard(userId, cardId);
  return prisma.creditCard.update({ where: { id: cardId }, data });
}

export async function deleteCreditCard(userId: number, cardId: number) {
  await getCreditCard(userId, cardId);
  await prisma.creditCard.delete({ where: { id: cardId } });
}

// ===== FATURAS =====
export async function listInvoices(userId: number, cardId: number) {
  await getCreditCard(userId, cardId);
  return prisma.creditCardInvoice.findMany({
    where: { creditCardId: cardId },
    include: {
      transactions: {
        include: { category: { select: { name: true, icon: true, color: true } } },
        orderBy: { date: 'asc' },
      },
    },
    orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
  });
}

export async function getOrCreateInvoice(creditCardId: number, month: number, year: number) {
  const card = await prisma.creditCard.findUnique({ where: { id: creditCardId } });
  if (!card) throw ApiError.notFound('Cartão não encontrado');

  let invoice = await prisma.creditCardInvoice.findUnique({
    where: {
      creditCardId_referenceMonth_referenceYear: { creditCardId, referenceMonth: month, referenceYear: year },
    },
  });

  if (!invoice) {
    // Calcular datas de fechamento e vencimento
    const closingDate = new Date(year, month - 1, card.closingDay);
    const dueDate = new Date(year, month - 1, card.dueDay);
    // Se o dia de vencimento é antes do fechamento, a fatura vence no mês seguinte
    if (card.dueDay <= card.closingDay) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    invoice = await prisma.creditCardInvoice.create({
      data: {
        creditCardId,
        referenceMonth: month,
        referenceYear: year,
        closingDate,
        dueDate,
      },
    });
  }

  return invoice;
}

export async function payInvoice(userId: number, invoiceId: number, data: PayInvoiceInput) {
  const invoice = await prisma.creditCardInvoice.findUnique({
    where: { id: invoiceId },
    include: { creditCard: true },
  });
  if (!invoice || invoice.creditCard.userId !== userId) {
    throw ApiError.notFound('Fatura não encontrada');
  }

  const newPaidAmount = Number(invoice.paidAmount) + data.amount;
  const totalAmount = Number(invoice.totalAmount);

  let status: 'aberta' | 'fechada' | 'paga' | 'parcial' = 'parcial';
  if (newPaidAmount >= totalAmount) {
    status = 'paga';
  }

  const updated = await prisma.creditCardInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: newPaidAmount,
      status,
      paymentDate: new Date(data.paymentDate),
    },
  });

  // Se tem conta de pagamento vinculada, criar transação de despesa
  if (invoice.creditCard.paymentAccountId) {
    await prisma.transaction.create({
      data: {
        userId,
        accountId: invoice.creditCard.paymentAccountId,
        creditCardId: invoice.creditCardId,
        invoiceId: invoice.id,
        type: 'despesa',
        description: `Pagamento fatura ${invoice.creditCard.name} - ${invoice.referenceMonth}/${invoice.referenceYear}`,
        amount: data.amount,
        date: new Date(data.paymentDate),
        status: 'pago',
        paidDate: new Date(data.paymentDate),
      },
    });
  }

  return updated;
}

// ===== COMPRAS PARCELADAS =====
export async function createPurchase(userId: number, data: CreatePurchaseInput) {
  const card = await getCreditCard(userId, data.creditCardId);

  const installmentAmount = Math.round((data.totalAmount / data.totalInstallments) * 100) / 100;

  // Criar o registro mestre da compra
  const purchase = await prisma.creditCardPurchase.create({
    data: {
      userId,
      creditCardId: data.creditCardId,
      categoryId: data.categoryId || null,
      description: data.description,
      totalAmount: data.totalAmount,
      installmentAmount,
      totalInstallments: data.totalInstallments,
      purchaseDate: new Date(data.purchaseDate),
    },
  });

  // Gerar uma transação por parcela, vinculada à fatura do mês correspondente
  const purchaseDate = new Date(data.purchaseDate);

  for (let i = 0; i < data.totalInstallments; i++) {
    const installmentDate = new Date(purchaseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    const month = installmentDate.getMonth() + 1;
    const year = installmentDate.getFullYear();

    // Obter ou criar a fatura do mês
    const invoice = await getOrCreateInvoice(data.creditCardId, month, year);

    // Ajuste para última parcela (centavos residuais)
    const amount =
      i === data.totalInstallments - 1
        ? data.totalAmount - installmentAmount * (data.totalInstallments - 1)
        : installmentAmount;

    // Criar transação desta parcela
    await prisma.transaction.create({
      data: {
        userId,
        creditCardId: data.creditCardId,
        categoryId: data.categoryId || null,
        invoiceId: invoice.id,
        purchaseId: purchase.id,
        type: 'despesa',
        description:
          data.totalInstallments > 1
            ? `${data.description} (${i + 1}/${data.totalInstallments})`
            : data.description,
        amount,
        date: installmentDate,
        status: 'pendente',
        installmentInfo: data.totalInstallments > 1 ? `${i + 1}/${data.totalInstallments}` : null,
      },
    });

    // Atualizar total da fatura
    const invoiceTotal = await prisma.transaction.aggregate({
      where: { invoiceId: invoice.id, type: 'despesa' },
      _sum: { amount: true },
    });
    await prisma.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { totalAmount: invoiceTotal._sum.amount || 0 },
    });
  }

  return purchase;
}
