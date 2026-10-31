import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import { getPrismaClient } from '../../config/db.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { validate } from '../../middleware/validate.js';
import { createNotification } from '../../services/notification.service.js';

const updateSchema = z
  .object({
    status: z.enum(['claimed', 'resolved']),
    resolution: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'resolved' && !value.resolution) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolution'],
        message: 'Resolution note is required when resolving',
      });
    }
  });

export const agronomistRouter = Router();

agronomistRouter.use(requireAuth, roleGuard('AGRONOMIST', 'ADMIN'));

agronomistRouter.get(
  '/escalations',
  asyncHandler(async (request, response) => {
    const statusRaw = typeof request.query.status === 'string' ? request.query.status : undefined;
    const status =
      statusRaw === 'pending' || statusRaw === 'claimed' || statusRaw === 'resolved'
        ? statusRaw
        : undefined;

    const rows = await getPrismaClient().advisoryEscalation.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        farmer: {
          select: { id: true, name: true, email: true, phone: true, state: true, district: true },
        },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    sendSuccess(response, rows);
  }),
);

agronomistRouter.patch(
  '/escalations/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (request, response) => {
    if (!request.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const id = typeof request.params.id === 'string' ? request.params.id : request.params.id?.[0];
    if (!id) throw new AppError(400, 'INVALID_REQUEST', 'Missing escalation id');

    const body = request.body as z.infer<typeof updateSchema>;
    const existing = await getPrismaClient().advisoryEscalation.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Escalation not found');

    const updated = await getPrismaClient().advisoryEscalation.update({
      where: { id },
      data: {
        status: body.status,
        resolution: body.resolution ?? existing.resolution,
        assignedToId: request.user.id,
      },
    });

    if (body.status === 'resolved' && body.resolution) {
      await createNotification({
        userId: existing.farmerId,
        type: 'ADVISORY_ESCALATION',
        title: 'Agronomist replied',
        body: body.resolution,
        params: { variant: 'resolved', preview: body.resolution.slice(0, 160) },
        relatedEntityType: 'AdvisoryEscalation',
        relatedEntityId: id,
      });
    }

    sendSuccess(response, updated);
  }),
);
