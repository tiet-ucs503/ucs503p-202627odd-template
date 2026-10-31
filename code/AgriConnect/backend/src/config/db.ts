import { PrismaClient } from '../generated/prisma/client.js';
import { getEnv } from './env.js';
import { createPrismaAdapter } from './pg-adapter.js';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = createPrismaAdapter(getEnv().DATABASE_URL);

  return new PrismaClient({
    adapter,
    log:
      getEnv().NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
}

export function getPrismaClient(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export async function connectDatabase(): Promise<void> {
  await getPrismaClient().$connect();
}

export async function disconnectDatabase(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    delete globalForPrisma.prisma;
  }
}

export async function isDatabaseReady(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
