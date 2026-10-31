import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import type { QueryAssistantBody, SpeakAssistantBody } from './assistant.schema.js';
import { getAssistantStatus, queryAssistant } from './assistant.service.js';
import { synthesizeSpeech } from './assistant-tts.js';

export const getAssistantStatusController = asyncHandler((_request, response) => {
  sendSuccess(response, getAssistantStatus());
});

export const queryAssistantController = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const body = request.body as QueryAssistantBody;
  sendSuccess(
    response,
    await queryAssistant({
      message: body.message,
      history: body.history,
      role: request.user.role,
      userId: request.user.id,
      language: body.language,
    }),
  );
});

export const speakAssistantController = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const body = request.body as SpeakAssistantBody;
  const wav = await synthesizeSpeech({
    text: body.text,
    language: body.language,
  });
  response.setHeader('Content-Type', 'audio/wav');
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).end(wav);
});
