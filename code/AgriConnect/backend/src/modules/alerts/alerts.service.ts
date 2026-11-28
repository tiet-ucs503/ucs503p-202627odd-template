import { AppError } from '../../common/app-error.js';
import { getPrismaClient } from '../../config/db.js';
import type { BuyerAlertBody } from './alerts.schema.js';

export async function listMyAlerts(userId: string) {
  const rows = await getPrismaClient().buyerCropAlert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    id: row.id,
    crop: row.crop,
    state: row.state,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createAlert(userId: string, input: BuyerAlertBody) {
  try {
    const row = await getPrismaClient().buyerCropAlert.create({
      data: {
        userId,
        crop: input.crop ?? null,
        state: input.state ?? null,
        enabled: input.enabled ?? true,
      },
    });
    return {
      id: row.id,
      crop: row.crop,
      state: row.state,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
    };
  } catch {
    throw new AppError(409, 'CONFLICT', 'An identical alert already exists');
  }
}

export async function deleteAlert(userId: string, alertId: string) {
  const result = await getPrismaClient().buyerCropAlert.deleteMany({
    where: { id: alertId, userId },
  });
  if (result.count === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Alert not found');
  }
  return { deleted: true };
}
