// =========================================
// ECO MONTH — Categories: Service
// =========================================

import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

export async function listCategories(userId: number) {
  // Retorna categorias padrão + categorias customizadas do usuário
  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { isDefault: true },
        { userId },
      ],
    },
    include: { children: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return categories;
}

export async function getCategory(userId: number, categoryId: number) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ isDefault: true }, { userId }],
    },
    include: { children: true },
  });
  if (!category) throw ApiError.notFound('Categoria não encontrada');
  return category;
}

export async function createCategory(userId: number, data: CreateCategoryInput) {
  return prisma.category.create({
    data: {
      userId,
      parentId: data.parentId || null,
      name: data.name,
      type: data.type,
      icon: data.icon,
      color: data.color,
      isDefault: false,
    },
  });
}

export async function updateCategory(userId: number, categoryId: number, data: UpdateCategoryInput) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) throw ApiError.notFound('Categoria não encontrada ou é uma categoria padrão');

  return prisma.category.update({
    where: { id: categoryId },
    data,
  });
}

export async function deleteCategory(userId: number, categoryId: number) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, isDefault: false },
  });
  if (!category) throw ApiError.notFound('Categoria não encontrada ou não pode ser deletada');

  await prisma.category.delete({ where: { id: categoryId } });
}
