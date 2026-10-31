import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireActiveAccount } from '../../middleware/require-active-account.js';
import { validate } from '../../middleware/validate.js';
import { queryAssistantController, getAssistantStatusController, speakAssistantController } from './assistant.controller.js';
import { queryAssistantBodySchema, speakAssistantBodySchema } from './assistant.schema.js';

export const assistantRouter = Router();

assistantRouter.use(requireAuth);
assistantRouter.get('/status', getAssistantStatusController);
assistantRouter.post(
  '/query',
  requireActiveAccount,
  validate({ body: queryAssistantBodySchema }),
  queryAssistantController,
);
assistantRouter.post(
  '/speak',
  requireActiveAccount,
  validate({ body: speakAssistantBodySchema }),
  speakAssistantController,
);
