// =========================================
// ECO MONTH — Auth: Service (Lógica de negócio)
// =========================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import type { RegisterInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from './auth.schema';

// Gera tokens JWT
function generateAccessToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

function getRefreshExpiry(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN) || 7;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

// ===== REGISTRO =====
export async function register(data: RegisterInput) {
  // Verifica se email já existe
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw ApiError.conflict('Este email já está cadastrado');
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Criar usuário
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
    },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });

  // Criar conta padrão "Carteira"
  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Carteira',
      type: 'carteira',
      initialBalance: 0,
      color: '#22c55e',
      icon: 'wallet',
    },
  });

  // Gerar tokens
  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshExpiry(),
    },
  });

  return { user, accessToken, refreshToken };
}

// ===== LOGIN =====
export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw ApiError.unauthorized('Email ou senha incorretos');
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Email ou senha incorretos');
  }

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken();

  // Limpar tokens antigos (manter apenas 5 sessões)
  const tokens = await prisma.refreshToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (tokens.length >= 5) {
    const idsToDelete = tokens.slice(4).map((t) => t.id);
    await prisma.refreshToken.deleteMany({ where: { id: { in: idsToDelete } } });
  }

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshExpiry(),
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken,
  };
}

// ===== REFRESH TOKEN =====
export async function refresh(refreshTokenValue: string) {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenValue },
    include: { user: true },
  });

  if (!storedToken) {
    throw ApiError.unauthorized('Refresh token inválido');
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw ApiError.unauthorized('Refresh token expirado. Faça login novamente.');
  }

  // Rotacionar: deletar o antigo e criar um novo
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const newAccessToken = generateAccessToken(storedToken.user.id, storedToken.user.email);
  const newRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: storedToken.user.id,
      token: newRefreshToken,
      expiresAt: getRefreshExpiry(),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ===== LOGOUT =====
export async function logout(refreshTokenValue: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshTokenValue } });
}

// ===== PERFIL =====
export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });
  if (!user) throw ApiError.notFound('Usuário não encontrado');
  return user;
}

export async function updateProfile(userId: number, data: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });
  return user;
}

export async function changePassword(userId: number, data: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isValid) throw ApiError.badRequest('Senha atual incorreta');

  const newHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Invalidar todos os refresh tokens (forçar re-login em todos dispositivos)
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
