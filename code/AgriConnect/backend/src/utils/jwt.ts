import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import type { Role } from '../generated/prisma/client.js';
import { getEnv } from '../config/env.js';

const ALGORITHM = 'HS256' as const;
const ACCESS_TOKEN_TTL: NonNullable<SignOptions['expiresIn']> = '15m';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: Role;
  typ: 'access';
}

function isRole(value: unknown): value is Role {
  return value === 'FARMER' || value === 'BUYER' || value === 'ADMIN';
}

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign(
    { role, typ: 'access' },
    getEnv().JWT_ACCESS_SECRET,
    {
      algorithm: ALGORITHM,
      expiresIn: ACCESS_TOKEN_TTL,
      subject: userId,
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(
    token,
    getEnv().JWT_ACCESS_SECRET,
    { algorithms: [ALGORITHM], complete: false },
  );

  if (
    typeof payload === 'string' ||
    payload.typ !== 'access' ||
    typeof payload.sub !== 'string' ||
    !isRole(payload.role)
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token claims');
  }

  return payload as AccessTokenPayload;
}

export function isAccessTokenExpiredError(error: unknown): boolean {
  return (
    error instanceof jwt.TokenExpiredError ||
    (error instanceof Error && error.name === 'TokenExpiredError')
  );
}

export function isAccessTokenInvalidError(error: unknown): boolean {
  return (
    error instanceof jwt.JsonWebTokenError ||
    (error instanceof Error && error.name === 'JsonWebTokenError')
  );
}
