// =========================================
// ECO MONTH — Accounts: Schema
// =========================================

import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  type: z.enum(['carteira', 'conta_corrente', 'poupanca', 'investimento', 'outro']),
  initialBalance: z.number().default(0),
  color: z.string().max(7).default('#3b82f6'),
  icon: z.string().max(50).default('wallet'),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
