import type { Server as HttpServer } from 'node:http';
import type { DefaultEventsMap, Socket } from 'socket.io';
import { Server } from 'socket.io';
import type { Role } from '../generated/prisma/client.js';
import { getPrismaClient } from './db.js';
import { getEnv } from './env.js';
import { logger } from './logger.js';
import { registerCallHandlers } from '../modules/calls/calls.gateway.js';
import { verifyAccessToken } from '../utils/jwt.js';

interface SocketUser {
  id: string;
  role: Role;
}

interface SocketData {
  user?: SocketUser;
}

type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

let io: Server | null = null;

async function canAccessOrder(user: SocketUser, orderId: string): Promise<boolean> {
  const order = await getPrismaClient().order.findFirst({
    where: {
      id: orderId,
      ...(user.role === 'BUYER'
        ? { buyerId: user.id }
        : user.role === 'FARMER'
          ? { farmerId: user.id }
          : {}),
    },
    select: { id: true },
  });
  return order != null;
}

export function initSocketIO(server: HttpServer): Server {
  const env = getEnv();
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const raw =
      typeof socket.handshake.auth.token === 'string'
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null;
    if (!raw) {
      // Allow unauthenticated connection for public broadcasts (e.g. marketplace)
      next();
      return;
    }
    try {
      const payload = verifyAccessToken(raw);
      (socket as AppSocket).data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      // If token expired or invalid, still allow connection as guest
      next();
    }
  });

  io.on('connection', (socket) => {
    const appSocket = socket as AppSocket;

    const attachUser = (authUser: SocketUser) => {
      appSocket.data.user = authUser;
      void appSocket.join(`user:${authUser.id}`);
      registerCallHandlers(appSocket, authUser);
      logger.info({ userId: authUser.id, role: authUser.role }, 'Socket authenticated');
    };

    appSocket.on(
      'authenticate',
      (token: string, ack?: (result: { ok: boolean; error?: string }) => void) => {
        if (typeof token !== 'string' || !token) {
          ack?.({ ok: false, error: 'Token missing' });
          return;
        }
        try {
          const payload = verifyAccessToken(token);
          const authUser: SocketUser = { id: payload.sub, role: payload.role };
          attachUser(authUser);
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false, error: 'Invalid token' });
        }
      },
    );

    if (appSocket.data.user) {
      attachUser(appSocket.data.user);
    }

    appSocket.on(
      'join:order',
      async (
        orderId: string,
        ack?: (result: { ok: boolean; error?: string }) => void,
      ) => {
        const currentUser = appSocket.data.user;
        if (!currentUser) {
          ack?.({ ok: false, error: 'Unauthorized' });
          return;
        }
        if (typeof orderId !== 'string' || !orderId) {
          ack?.({ ok: false, error: 'Invalid order id' });
          return;
        }
        try {
          const allowed = await canAccessOrder(currentUser, orderId);
          if (!allowed) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
          void appSocket.join(`order:${orderId}`);
          ack?.({ ok: true });
        } catch (error) {
          logger.warn({ err: error, orderId, userId: currentUser.id }, 'Socket join:order failed');
          ack?.({ ok: false, error: 'Failed to join order room' });
        }
      },
    );

    appSocket.on('leave:order', (orderId: string) => {
      if (typeof orderId === 'string') {
        void appSocket.leave(`order:${orderId}`);
      }
    });

    appSocket.on('typing:start', (orderId: string) => {
      const currentUser = appSocket.data.user;
      if (currentUser && typeof orderId === 'string') {
        appSocket.to(`order:${orderId}`).emit('typing', { orderId, userId: currentUser.id });
      }
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getSocketIO(): Server | null {
  return io;
}

export function emitOrderMessage(orderId: string, message: unknown): void {
  io?.to(`order:${orderId}`).emit('message:new', message);
}

export function emitMarketplaceListingUpdate(
  action: 'created' | 'updated' | 'deleted',
  data: unknown,
): void {
  io?.emit('marketplace:listing:change', { action, data });
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}
