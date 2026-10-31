import type { Role } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: Role;
      isSuspended: boolean;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
