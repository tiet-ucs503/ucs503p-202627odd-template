import pino from 'pino';

const sensitivePaths = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: sensitivePaths,
    censor: '[REDACTED]',
  },
  base: {
    service: 'agriconnect-backend',
  },
});
