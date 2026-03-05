// =========================================
// ECO MONTH — Auth: Rotas
// =========================================

import { Router } from 'express';
import * as controller from './auth.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema';

const router = Router();

// Rotas públicas
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refreshToken);

// Rotas protegidas
router.post('/logout', authMiddleware, controller.logout);
router.get('/profile', authMiddleware, controller.getProfile);
router.patch('/profile', authMiddleware, validate(updateProfileSchema), controller.updateProfile);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), controller.changePassword);

export default router;
