// =========================================
// ECO MONTH — Middleware de Autenticação JWT
// =========================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export interface AuthPayload {
  userId: number;
  email: string;
}

// Estende o tipo Request do Express para incluir dados do usuário
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Token não fornecido');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token expirado'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Token inválido'));
    } else {
      next(ApiError.unauthorized());
    }
  }
}
