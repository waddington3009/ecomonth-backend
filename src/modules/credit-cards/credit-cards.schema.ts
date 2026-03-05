// =========================================
// ECO MONTH — Credit Cards: Schema
// =========================================

import { z } from 'zod';

export const createCreditCardSchema = z.object({
  name: z.string().min(1).max(100),
  brand: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro']).default('outro'),
  lastFourDigits: z.string().length(4).nullable().optional(),
  creditLimit: z.number().positive('Limite deve ser positivo'),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  paymentAccountId: z.number().int().positive().nullable().optional(),
  color: z.string().max(7).default('#6366f1'),
});

export const updateCreditCardSchema = createCreditCardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createPurchaseSchema = z.object({
  creditCardId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullable().optional(),
  description: z.string().min(1).max(255),
  totalAmount: z.number().positive(),
  totalInstallments: z.number().int().min(1).max(48).default(1),
  purchaseDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
});

export const payInvoiceSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Data inválida'),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
