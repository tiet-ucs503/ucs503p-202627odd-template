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
  user: SocketUser;
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
      next(new Error('Unauthorized'));
      return;
    }
    try {
      const payload = verifyAccessToken(raw);
      (socket as AppSocket).data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const appSocket = socket as AppSocket;
    const user = appSocket.data.user;

    appSocket.on(
      'join:order',
      async (
        orderId: string,
        ack?: (result: { ok: boolean; error?: string }) => void,
      ) => {
        if (typeof orderId !== 'string' || !orderId) {
          ack?.({ ok: false, error: 'Invalid order id' });
          return;
        }
        try {
          const allowed = await canAccessOrder(user, orderId);
          if (!allowed) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
          void appSocket.join(`order:${orderId}`);
          ack?.({ ok: true });
        } catch (error) {
          logger.warn({ err: error, orderId, userId: user.id }, 'Socket join:order failed');
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
      if (typeof orderId === 'string') {
        appSocket.to(`order:${orderId}`).emit('typing', { orderId, userId: user.id });
      }
    });

    registerCallHandlers(appSocket, user);
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
