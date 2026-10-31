import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { hashPassword, verifyPassword } from '../../common/password.js';
import { serializeMe, serializeUser } from '../../common/user-serializers.js';
import { getPrismaClient } from '../../config/db.js';
import { getEnv } from '../../config/env.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import { signAccessToken } from '../../utils/jwt.js';
import { createOpaqueToken, hashToken } from '../../utils/token.js';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from './auth.schemas.js';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = new AppError(
  401,
  'INVALID_CREDENTIALS',
  'Invalid email or password',
);
const dummyPasswordHash = hashPassword('agriconnect-dummy-password');

const userWithProfiles = {
  farmerProfile: true,
  buyerProfile: true,
} as const;

function splitRefreshCookie(value: string): { id: string; secret: string } | null {
  const separator = value.indexOf('.');
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  return {
    id: value.slice(0, separator),
    secret: value.slice(separator + 1),
  };
}

function composeRefreshCookie(id: string, secret: string): string {
  return `${id}.${secret}`;
}

async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string },
  client: Prisma.TransactionClient = getPrismaClient(),
): Promise<string> {
  const secret = createOpaqueToken();
  const token = await client.refreshToken.create({
    data: {
      userId,
      tokenHash: await hashPassword(secret),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return composeRefreshCookie(token.id, secret);
}

async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await getPrismaClient().refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function register(
  input: RegisterInput,
  meta: { userAgent?: string; ip?: string },
) {
  const existing = await getPrismaClient().user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const result = await getPrismaClient().$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        phone: input.phone,
        state: input.state,
        district: input.district,
        village: input.village ?? null,
        languagePref: input.languagePref,
        ...(input.role === 'FARMER'
          ? { farmerProfile: { create: {} } }
          : { buyerProfile: { create: { buyerType: 'trader' } } }),
      },
      include: userWithProfiles,
    });
    return {
      user: created,
      refreshToken: await issueRefreshToken(created.id, meta, transaction),
    };
  });

  return {
    accessToken: signAccessToken(result.user.id, result.user.role),
    refreshToken: result.refreshToken,
    user: serializeUser(result.user),
  };
}

export async function login(
  input: LoginInput,
  meta: { userAgent?: string; ip?: string },
) {
  const user = await getPrismaClient().user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  if (!user) {
    await verifyPassword(input.password, await dummyPasswordHash);
    throw INVALID_CREDENTIALS;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(input.password, user.passwordHash);
    throw INVALID_CREDENTIALS;
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    await getPrismaClient().user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= LOCKOUT_THRESHOLD ? 0 : attempts,
        lockedUntil:
          attempts >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
      },
    });
    throw INVALID_CREDENTIALS;
  }

  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  if (user.isSuspended) {
    throw new AppError(
      403,
      'ACCOUNT_SUSPENDED',
      'This account has been suspended',
    );
  }

  const refreshToken = await issueRefreshToken(user.id, meta);
  return {
    accessToken: signAccessToken(user.id, user.role),
    refreshToken,
    user: serializeUser(user),
  };
}

export async function refreshSession(
  cookieValue: string | undefined,
  meta: { userAgent?: string; ip?: string },
) {
  const parts = cookieValue ? splitRefreshCookie(cookieValue) : null;
  if (!parts) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }

  const stored = await getPrismaClient().refreshToken.findUnique({
    where: { id: parts.id },
  });
  if (!stored || !(await verifyPassword(parts.secret, stored.tokenHash))) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }

  if (stored.revokedAt) {
    await revokeAllRefreshTokens(stored.userId);
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }

  if (stored.expiresAt <= new Date()) {
    await getPrismaClient().refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }

  const user = await getPrismaClient().user.findFirst({
    where: { id: stored.userId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }

  const refreshToken = await getPrismaClient().$transaction(
    async (transaction) => {
      const claimed = await transaction.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }

      const replacement = await issueRefreshToken(user.id, meta, transaction);
      const replacementParts = splitRefreshCookie(replacement);
      if (!replacementParts) {
        throw new Error('Failed to create refresh token');
      }
      await transaction.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: replacementParts.id },
      });
      return replacement;
    },
  );
  if (!refreshToken) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
  }
  return {
    accessToken: signAccessToken(user.id, user.role),
    refreshToken,
  };
}

export async function logout(
  cookieValue: string | undefined,
  userId?: string,
): Promise<void> {
  const parts = cookieValue ? splitRefreshCookie(cookieValue) : null;
  if (parts) {
    const stored = await getPrismaClient().refreshToken.findUnique({
      where: { id: parts.id },
    });
    if (stored && (await verifyPassword(parts.secret, stored.tokenHash))) {
      await getPrismaClient().refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return;
    }
  }

  if (userId) {
    await revokeAllRefreshTokens(userId);
  }
}

export async function getCurrentUser(userId: string) {
  const user = await getPrismaClient().user.findFirst({
    where: { id: userId, deletedAt: null },
    include: userWithProfiles,
  });
  if (!user) {
    throw new AppError(401, 'TOKEN_INVALID', 'Invalid access token');
  }
  return serializeMe(user);
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await getPrismaClient().user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) {
    return;
  }

  await getPrismaClient().passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = createOpaqueToken();
  await getPrismaClient().passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const resetUrl = `${getEnv().CLIENT_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const stored = await getPrismaClient().passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, user: { deletedAt: null } },
  });
  if (!stored || stored.expiresAt <= new Date()) {
    throw new AppError(400, 'INVALID_REQUEST', 'Reset token is invalid or expired');
  }

  const passwordHash = await hashPassword(input.password);
  await getPrismaClient().$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppError(
        400,
        'INVALID_REQUEST',
        'Reset token is invalid or expired',
      );
    }
    await transaction.user.update({
      where: { id: stored.userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await transaction.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
