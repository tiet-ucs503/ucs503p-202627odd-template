import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import { AppError } from '../../common/app-error.js';
import { logger } from '../../config/logger.js';
import { getIceServers, resolveCallPermission, type CallActor } from './calls.service.js';

interface ActiveCall {
  callId: string;
  orderId: string;
  callerId: string;
  calleeId: string;
  startedAt: number;
  answered: boolean;
  ringTimer?: NodeJS.Timeout | undefined;
}

/**
 * One live call per order, tracked in memory. Signalling is peer-to-peer WebRTC, so the
 * server only relays offers/answers/ICE candidates and never carries audio. Single-process
 * only — a multi-instance deployment would need a shared store.
 */
const activeCalls = new Map<string, ActiveCall>();

/**
 * How long an unanswered invite may hold the order's single call slot.
 *
 * Without this, a callee who is not on the order page never rings, the caller sits on
 * "Ringing…" forever, and every later invite is refused with `CONFLICT` until the caller
 * disconnects.
 */
const RING_TIMEOUT_MS = 45_000;

/** Removes a call and cancels its ring timer. */
function clearCall(orderId: string, call: ActiveCall): void {
  if (call.ringTimer) {
    clearTimeout(call.ringTimer);
  }
  activeCalls.delete(orderId);
}

type Ack = (result: { ok: boolean; error?: string; code?: string; [key: string]: unknown }) => void;

interface CallEnvelope {
  orderId?: unknown;
  callId?: unknown;
}

interface SignalEnvelope extends CallEnvelope {
  description?: unknown;
  candidate?: unknown;
}

function room(orderId: string): string {
  return `order:${orderId}`;
}

function failure(error: unknown): { ok: false; error: string; code: string } {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: false, error: 'Call failed', code: 'INTERNAL_ERROR' };
}

function readEnvelope(payload: CallEnvelope): { orderId: string; callId: string } | null {
  if (typeof payload.orderId !== 'string' || !payload.orderId) return null;
  if (typeof payload.callId !== 'string' || !payload.callId) return null;
  return { orderId: payload.orderId, callId: payload.callId };
}

/** Only the two people on the call may drive it. */
function authorizedCall(
  payload: CallEnvelope,
  userId: string,
): { call: ActiveCall; orderId: string } | null {
  const envelope = readEnvelope(payload);
  if (!envelope) return null;
  const call = activeCalls.get(envelope.orderId);
  if (call?.callId !== envelope.callId) return null;
  if (call.callerId !== userId && call.calleeId !== userId) return null;
  return { call, orderId: envelope.orderId };
}

export function registerCallHandlers(socket: Socket, user: CallActor): void {
  socket.on('call:invite', async (payload: CallEnvelope, ack?: Ack) => {
    if (typeof payload.orderId !== 'string' || !payload.orderId) {
      ack?.({ ok: false, error: 'Invalid order id', code: 'VALIDATION_ERROR' });
      return;
    }
    const orderId = payload.orderId;

    try {
      const permission = await resolveCallPermission(user, orderId);

      const existing = activeCalls.get(orderId);
      if (existing) {
        ack?.({ ok: false, error: 'A call is already in progress', code: 'CONFLICT' });
        return;
      }

      const call: ActiveCall = {
        callId: randomUUID(),
        orderId,
        callerId: permission.callerId,
        calleeId: permission.calleeId,
        startedAt: Date.now(),
        answered: false,
      };
      // Both ends are told, because `socket.to()` skips the caller and the caller is the
      // one stuck on a ringing screen.
      call.ringTimer = setTimeout(() => {
        const current = activeCalls.get(orderId);
        if (current?.callId !== call.callId || current.answered) return;
        clearCall(orderId, current);
        const ended = {
          orderId,
          callId: current.callId,
          byUserId: current.calleeId,
          durationSeconds: 0,
          reason: 'unanswered' as const,
        };
        socket.to(room(orderId)).emit('call:ended', ended);
        socket.emit('call:ended', ended);
        logger.info({ orderId, callId: current.callId }, 'Call timed out unanswered');
      }, RING_TIMEOUT_MS);
      // Housekeeping only: never hold the process open on shutdown.
      call.ringTimer.unref();

      activeCalls.set(orderId, call);
      void socket.join(room(orderId));

      socket.to(room(orderId)).emit('call:incoming', {
        orderId,
        callId: call.callId,
        from: { id: permission.callerId, name: permission.callerName },
      });

      ack?.({ ok: true, callId: call.callId, iceServers: getIceServers() });
    } catch (error) {
      logger.warn({ err: error, orderId, userId: user.id }, 'Call invite rejected');
      ack?.(failure(error));
    }
  });

  socket.on('call:accept', async (payload: CallEnvelope, ack?: Ack) => {
    const authorized = authorizedCall(payload, user.id);
    if (authorized?.call.calleeId !== user.id) {
      ack?.({ ok: false, error: 'Call not found', code: 'NOT_FOUND' });
      return;
    }
    try {
      await resolveCallPermission(user, authorized.orderId);
      authorized.call.answered = true;
      // Answered, so the unanswered-ring timer must not fire mid-conversation.
      if (authorized.call.ringTimer) {
        clearTimeout(authorized.call.ringTimer);
        authorized.call.ringTimer = undefined;
      }
      void socket.join(room(authorized.orderId));
      socket.to(room(authorized.orderId)).emit('call:accepted', {
        orderId: authorized.orderId,
        callId: authorized.call.callId,
      });
      ack?.({ ok: true, iceServers: getIceServers() });
    } catch (error) {
      ack?.(failure(error));
    }
  });

  socket.on('call:decline', (payload: CallEnvelope) => {
    const authorized = authorizedCall(payload, user.id);
    if (!authorized) return;
    clearCall(authorized.orderId, authorized.call);
    socket.to(room(authorized.orderId)).emit('call:declined', {
      orderId: authorized.orderId,
      callId: authorized.call.callId,
      byUserId: user.id,
    });
  });

  socket.on('call:end', (payload: CallEnvelope) => {
    const authorized = authorizedCall(payload, user.id);
    if (!authorized) return;
    clearCall(authorized.orderId, authorized.call);
    socket.to(room(authorized.orderId)).emit('call:ended', {
      orderId: authorized.orderId,
      callId: authorized.call.callId,
      byUserId: user.id,
      durationSeconds: authorized.call.answered
        ? Math.round((Date.now() - authorized.call.startedAt) / 1000)
        : 0,
    });
  });

  // Relays SDP offers/answers and ICE candidates untouched; audio never reaches the server.
  socket.on('call:signal', (payload: SignalEnvelope) => {
    const authorized = authorizedCall(payload, user.id);
    if (!authorized) return;
    socket.to(room(authorized.orderId)).emit('call:signal', {
      orderId: authorized.orderId,
      callId: authorized.call.callId,
      fromUserId: user.id,
      description: payload.description ?? null,
      candidate: payload.candidate ?? null,
    });
  });

  socket.on('disconnect', () => {
    for (const [orderId, call] of activeCalls) {
      if (call.callerId !== user.id && call.calleeId !== user.id) continue;
      clearCall(orderId, call);
      socket.to(room(orderId)).emit('call:ended', {
        orderId,
        callId: call.callId,
        byUserId: user.id,
        durationSeconds: call.answered ? Math.round((Date.now() - call.startedAt) / 1000) : 0,
      });
    }
  });
}

/** Test seam: drops in-memory call state and any pending ring timers. */
export function resetActiveCallsForTests(): void {
  for (const [orderId, call] of activeCalls) {
    clearCall(orderId, call);
  }
  activeCalls.clear();
}
