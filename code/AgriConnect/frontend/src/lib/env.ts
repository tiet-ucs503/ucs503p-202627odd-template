import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:5001'),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5001',
  });
}

export const API_BASE_URL = getPublicEnv().NEXT_PUBLIC_API_BASE_URL.replace(
  /\/$/,
  '',
);
