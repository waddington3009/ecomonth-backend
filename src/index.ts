// =========================================
// ECO MONTH — Entry Point do Servidor
// =========================================

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';

// Rotas dos módulos
import authRoutes from './modules/auth/auth.routes';
import accountsRoutes from './modules/accounts/accounts.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import tagsRoutes from './modules/tags/tags.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';
import creditCardsRoutes from './modules/credit-cards/credit-cards.routes';
import recurringRoutes from './modules/recurring/recurring.routes';
import budgetsRoutes from './modules/budgets/budgets.routes';
import goalsRoutes from './modules/goals/goals.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

// ===== MIDDLEWARES GLOBAIS =====
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile, Postman, etc.)
    if (!origin) return callback(null, true);
    const allowed = env.FRONTEND_URL.split(',').map(u => u.trim());
    if (allowed.includes(origin) || allowed.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting (proteção contra abuso)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { success: false, message: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', limiter);

// Rate limit mais restrito para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

// ===== ROTAS =====
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/credit-cards', creditCardsRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ===== HEALTH CHECK =====
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Eco Month API running', timestamp: new Date().toISOString() });
});

// ===== ERROR HANDLER =====
app.use(errorHandler);

// ===== INICIAR SERVIDOR =====
app.listen(env.PORT, () => {
  console.log(`\n🌿 Eco Month API rodando em http://localhost:${env.PORT}`);
  console.log(`📋 Ambiente: ${env.NODE_ENV}`);
  console.log(`🗄️  Banco: MySQL via Prisma\n`);
});

export default app;
