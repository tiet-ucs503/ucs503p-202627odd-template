import { config } from 'dotenv';
import { hashPassword } from '../src/common/password.js';
import { disconnectDatabase, getPrismaClient } from '../src/config/db.js';

config();

const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'Demo@AgriConnect1';
if (demoPassword.length < 12) {
  throw new Error('DEMO_USER_PASSWORD must be at least 12 characters.');
}

const prisma = getPrismaClient();
const hash = await hashPassword(demoPassword);

const result = await prisma.user.updateMany({
  where: { email: { endsWith: '@demo.agriconnect.local' } },
  data: {
    passwordHash: hash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isSuspended: false,
    deletedAt: null,
  },
});

console.info(`Reset password for ${result.count} demo account(s) to: ${demoPassword}`);
await disconnectDatabase();
