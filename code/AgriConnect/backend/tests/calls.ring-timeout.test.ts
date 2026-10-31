/**
 * An order allows one live call at a time, so an invite nobody answers must not keep the
 * slot forever. This drives the gateway through a stub socket with fake timers; call
 * permission is mocked because the rule under test is teardown, not authorisation.
 */

import type { Socket } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/calls/calls.service.js', () => ({
  getIceServers: () => [],
  resolveCallPermission: () =>
    Promise.resolve({
      callerId: 'buyer-1',
      calleeId: 'farmer-1',
      callerName: 'Test Buyer',
    }),
}));

const { registerCallHandlers, resetActiveCallsForTests } = await import(
  '../src/modules/calls/calls.gateway.js'
);

interface Emitted {
  scope: 'room' | 'self';
  event: string;
  payload: Record<string, unknown>;
}

type Handler = (...args: unknown[]) => unknown;
type Ack = (result: Record<string, unknown>) => void;

/** Minimal stand-in for the parts of a Socket.io socket the gateway touches. */
class StubSocket {
  readonly handlers = new Map<string, Handler>();
  readonly emitted: Emitted[] = [];

  on(event: string, handler: Handler): this {
    this.handlers.set(event, handler);
    return this;
  }

  join(): void {
    /* rooms are not modelled */
  }

  to(): { emit: (event: string, payload: Record<string, unknown>) => void } {
    return {
      emit: (event, payload) => {
        this.emitted.push({ scope: 'room', event, payload });
      },
    };
  }

  emit(event: string, payload: Record<string, unknown>): boolean {
    this.emitted.push({ scope: 'self', event, payload });
    return true;
  }

  async fire(event: string, ...args: unknown[]): Promise<void> {
    await this.handlers.get(event)?.(...args);
  }

  seen(event: string): Emitted[] {
    return this.emitted.filter((entry) => entry.event === event);
  }
}

function invite(socket: StubSocket, orderId: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const ack: Ack = (result) => resolve(result);
    void socket.fire('call:invite', { orderId }, ack);
  });
}

let socket: StubSocket;
let calleeSocket: StubSocket;

beforeEach(() => {
  vi.useFakeTimers();
  resetActiveCallsForTests();
  socket = new StubSocket();
  calleeSocket = new StubSocket();
  registerCallHandlers(socket as unknown as Socket, { id: 'buyer-1', role: 'BUYER' });
  // Only the callee may accept, so the answered case needs the other end too.
  registerCallHandlers(calleeSocket as unknown as Socket, { id: 'farmer-1', role: 'FARMER' });
});

afterEach(() => {
  resetActiveCallsForTests();
  vi.useRealTimers();
});

describe('unanswered call teardown', () => {
  it('ends the call and frees the order after the ring timeout', async () => {
    const first = await invite(socket, 'order-1');
    expect(first).toMatchObject({ ok: true });
    // Still ringing: the slot is taken.
    expect(await invite(socket, 'order-1')).toMatchObject({ code: 'CONFLICT' });

    await vi.advanceTimersByTimeAsync(45_000);

    const ended = socket.seen('call:ended');
    // Both ends are told, since `socket.to()` skips the caller who is left ringing.
    expect(ended.map((entry) => entry.scope).sort()).toEqual(['room', 'self']);
    expect(ended[0]?.payload).toMatchObject({
      orderId: 'order-1',
      callId: first.callId,
      reason: 'unanswered',
      durationSeconds: 0,
    });

    // Slot released, so the buyer can try again without reconnecting.
    expect(await invite(socket, 'order-1')).toMatchObject({ ok: true });
  });

  it('keeps an answered call alive past the ring timeout', async () => {
    const call = await invite(socket, 'order-2');
    await calleeSocket.fire('call:accept', { orderId: 'order-2', callId: call.callId });

    await vi.advanceTimersByTimeAsync(45_000);

    expect(socket.seen('call:ended')).toHaveLength(0);
    expect(await invite(socket, 'order-2')).toMatchObject({ code: 'CONFLICT' });
  });

  it('does not fire after the caller hangs up', async () => {
    const call = await invite(socket, 'order-3');
    await socket.fire('call:end', { orderId: 'order-3', callId: call.callId });
    const afterHangUp = socket.seen('call:ended').length;

    await vi.advanceTimersByTimeAsync(45_000);

    expect(socket.seen('call:ended')).toHaveLength(afterHangUp);
  });
});
