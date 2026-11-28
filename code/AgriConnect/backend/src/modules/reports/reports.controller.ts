import type { RequestHandler } from 'express';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import { getMyReport } from './reports.service.js';

export const getMyReportController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  sendSuccess(
    response,
    await getMyReport(request.user.id, request.user.role),
  );
};
