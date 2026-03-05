// =========================================
// ECO MONTH — Instância do Prisma Client
// =========================================

import { PrismaClient } from '@prisma/client';

// Evita múltiplas instâncias em dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
