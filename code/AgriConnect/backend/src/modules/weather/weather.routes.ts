import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler.js';
import { AppError } from '../../common/app-error.js';
import { sendSuccess } from '../../common/response.js';
import { getPrismaClient } from '../../config/db.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import { fetchLiveWeather } from '../assistant/knowledge/weather.js';

const querySchema = z
  .object({
    language: z
      .enum(['en', 'hi', 'pa', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'as', 'ur'])
      .optional(),
  })
  .strict();

export const weatherRouter = Router();

weatherRouter.get(
  '/',
  requireAuth,
  validate({ query: querySchema }),
  asyncHandler(async (request, response) => {
    if (!request.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

    const language =
      typeof request.query.language === 'string' ? request.query.language : 'en';

    const profile = await getPrismaClient().user.findUnique({
      where: { id: request.user.id },
      select: { state: true, district: true, village: true },
    });

    const live = await fetchLiveWeather(language, profile ?? undefined);
    if (!live) {
      throw new AppError(
        503,
        'WEATHER_UNAVAILABLE',
        'Live weather is not configured or OpenWeatherMap did not respond.',
      );
    }

    sendSuccess(response, {
      place: live.place,
      profilePlace: live.profilePlace,
      description: live.description,
      tempC: live.tempC,
      humidity: live.humidity,
      rainOutlook: live.rainOutlook,
      alertLine: live.alertLine,
      days: live.days,
      source: live.citation.source,
      fetchedAt: live.fetchedAt,
    });
  }),
);
