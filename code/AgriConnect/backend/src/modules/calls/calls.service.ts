import { AppError } from '../../common/app-error.js';
import { getPrismaClient } from '../../config/db.js';
import { getEnv } from '../../config/env.js';
import type { Role } from '../../generated/prisma/client.js';

export interface CallActor {
  id: string;
  role: Role;
}

export interface CallPermission {
  orderId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
}

/** STUN servers used by the browser to discover its public address. */
export function getIceServers(): { urls: string[] }[] {
  const configured = getEnv().WEBRTC_ICE_SERVERS;
  const urls = configured
    ? configured
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
  return [{ urls }];
}

/**
 * Voice calls are only for the two parties on a live order. Admins may read chat for
 * moderation but never join a call, and suspended accounts cannot start one.
 */
export async function resolveCallPermission(
  actor: CallActor,
  orderId: string,
): Promise<CallPermission> {
  if (actor.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Admins cannot join order calls');
  }

  const order = await getPrismaClient().order.findFirst({
    where: {
      id: orderId,
      ...(actor.role === 'BUYER' ? { buyerId: actor.id } : { farmerId: actor.id }),
    },
    select: { id: true, buyerId: true, farmerId: true, status: true },
  });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  if (order.status === 'cancelled') {
    throw new AppError(400, 'INVALID_REQUEST', 'Cannot call on a cancelled order');
  }

  const caller = await getPrismaClient().user.findFirst({
    where: { id: actor.id, deletedAt: null },
    select: { id: true, name: true, isSuspended: true },
  });
  if (!caller) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (caller.isSuspended) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Suspended accounts cannot start calls');
  }

  return {
    orderId: order.id,
    callerId: caller.id,
    callerName: caller.name,
    calleeId: actor.id === order.buyerId ? order.farmerId : order.buyerId,
  };
}
