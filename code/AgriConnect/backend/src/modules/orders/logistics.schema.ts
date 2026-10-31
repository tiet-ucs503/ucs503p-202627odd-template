import { z } from 'zod';
import { LogisticsStatus } from '../../generated/prisma/client.js';

export const updateLogisticsBodySchema = z
  .object({
    logisticsStatus: z.enum([
      LogisticsStatus.dispatched,
      LogisticsStatus.in_transit,
      LogisticsStatus.delivered,
    ]),
  })
  .strict();

export type UpdateLogisticsInput = z.infer<typeof updateLogisticsBodySchema>;
