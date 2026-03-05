// =========================================
// ECO MONTH — Resposta Padronizada da API
// =========================================

import { Response } from 'express';

interface ApiResponseData {
  success: boolean;
  message?: string;
  data?: unknown;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

export function sendSuccess(res: Response, data: unknown, message?: string, statusCode = 200) {
  const response: ApiResponseData = { success: true };
  if (message) response.message = message;
  response.data = data;
  return res.status(statusCode).json(response);
}

export function sendPaginated(
  res: Response,
  data: unknown,
  total: number,
  page: number,
  perPage: number,
) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}

export function sendCreated(res: Response, data: unknown, message = 'Criado com sucesso') {
  return sendSuccess(res, data, message, 201);
}

export function sendNoContent(res: Response) {
  return res.status(204).send();
}
