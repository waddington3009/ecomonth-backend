// =========================================
// ECO MONTH — Categories: Schema
// =========================================

import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  type: z.enum(['receita', 'despesa']),
  parentId: z.number().int().positive().nullable().optional(),
  icon: z.string().max(50).default('tag'),
  color: z.string().max(7).default('#64748b'),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
