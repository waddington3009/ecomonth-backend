// =========================================
// ECO MONTH — SEED: Categorias padrão
// =========================================

import { PrismaClient, CategoryType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  // Receitas
  { name: 'Salário', type: CategoryType.receita, icon: 'briefcase', color: '#22c55e' },
  { name: 'Freelance', type: CategoryType.receita, icon: 'laptop', color: '#10b981' },
  { name: 'Investimentos', type: CategoryType.receita, icon: 'trending-up', color: '#14b8a6' },
  { name: 'Presente', type: CategoryType.receita, icon: 'gift', color: '#06b6d4' },
  { name: 'Outras Receitas', type: CategoryType.receita, icon: 'plus-circle', color: '#8b5cf6' },

  // Despesas
  { name: 'Alimentação', type: CategoryType.despesa, icon: 'utensils', color: '#f97316' },
  { name: 'Moradia', type: CategoryType.despesa, icon: 'home', color: '#3b82f6' },
  { name: 'Transporte', type: CategoryType.despesa, icon: 'car', color: '#8b5cf6' },
  { name: 'Saúde', type: CategoryType.despesa, icon: 'heart-pulse', color: '#ec4899' },
  { name: 'Educação', type: CategoryType.despesa, icon: 'graduation-cap', color: '#14b8a6' },
  { name: 'Lazer', type: CategoryType.despesa, icon: 'gamepad-2', color: '#f59e0b' },
  { name: 'Contas Fixas', type: CategoryType.despesa, icon: 'file-text', color: '#6366f1' },
  { name: 'Vestuário', type: CategoryType.despesa, icon: 'shirt', color: '#a855f7' },
  { name: 'Assinaturas', type: CategoryType.despesa, icon: 'repeat', color: '#0ea5e9' },
  { name: 'Outras Despesas', type: CategoryType.despesa, icon: 'circle-minus', color: '#64748b' },
];

async function main() {
  console.log('🌱 Iniciando seed...');

  // Criar categorias padrão (sem user_id, is_default = true)
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: {
        id: defaultCategories.indexOf(cat) + 1, // Upsert por ID sequencial
      },
      update: {
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
      create: {
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        userId: null,
      },
    });
  }

  console.log(`✅ ${defaultCategories.length} categorias padrão criadas/atualizadas.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
