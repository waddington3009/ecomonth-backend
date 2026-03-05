// =========================================
// ECO MONTH — Transactions: Schema
// =========================================

import { z } from 'zod';

export const createTransactionSchema = z.object({
  accountId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  creditCardId: z.number().int().positive().nullable().optional(),
  type: z.enum(['receita', 'despesa', 'transferencia']),
  description: z.string().min(1, 'Descrição é obrigatória').max(255),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida').nullable().optional(),
  status: z.enum(['pendente', 'pago', 'cancelado']).default('pendente'),
  notes: z.string().max(1000).nullable().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z.object({
  month: z.string().optional(),
  year: z.string().optional(),
  type: z.enum(['receita', 'despesa', 'transferencia']).optional(),
  status: z.enum(['pendente', 'pago', 'cancelado']).optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  search: z.string().optional(),
  page: z.string().default('1'),
  perPage: z.string().default('50'),
  sortBy: z.enum(['date', 'amount', 'description', 'created_at']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const transferSchema = z.object({
  fromAccountId: z.number().int().positive(),
  toAccountId: z.number().int().positive(),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
  description: z.string().max(255).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
