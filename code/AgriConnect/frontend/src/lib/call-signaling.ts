import { tt } from '@/lib/i18n/active-locale';
import { connectSocket } from './socket';

/** Locale-aware ack for when the socket never answers. */
function noResponse(): CallAck {
  return { ok: false, code: 'NO_RESPONSE', error: tt('order.call.errors.noResponse') };
}

export interface IceServerConfig {
  urls: string[];
}

export interface CallAck {
  ok: boolean;
  error?: string;
  code?: string;
  callId?: string;
  iceServers?: IceServerConfig[];
}

export interface IncomingCall {
  orderId: string;
  callId: string;
  from: { id: string; name: string };
}

export interface CallSignal {
  orderId: string;
  callId: string;
  fromUserId: string;
  description: RTCSessionDescriptionInit | null;
  candidate: RTCIceCandidateInit | null;
}

export interface CallClosed {
  orderId: string;
  callId: string;
  byUserId: string;
  durationSeconds?: number;
}

export interface CallHandlers {
  onIncoming: (payload: IncomingCall) => void;
  onAccepted: (payload: { orderId: string; callId: string }) => void;
  onDeclined: (payload: CallClosed) => void;
  onEnded: (payload: CallClosed) => void;
  onSignal: (payload: CallSignal) => void;
}

/** Subscribes to call events for the shared socket. Returns an unsubscribe. */
export function subscribeToCalls(handlers: CallHandlers): () => void {
  const client = connectSocket();

  client.on('call:incoming', handlers.onIncoming);
  client.on('call:accepted', handlers.onAccepted);
  client.on('call:declined', handlers.onDeclined);
  client.on('call:ended', handlers.onEnded);
  client.on('call:signal', handlers.onSignal);

  return () => {
    client.off('call:incoming', handlers.onIncoming);
    client.off('call:accepted', handlers.onAccepted);
    client.off('call:declined', handlers.onDeclined);
    client.off('call:ended', handlers.onEnded);
    client.off('call:signal', handlers.onSignal);
  };
}

export function inviteToCall(orderId: string): Promise<CallAck> {
  return new Promise((resolve) => {
    connectSocket().emit('call:invite', { orderId }, (ack?: CallAck) =>
      resolve(ack ?? noResponse()),
    );
  });
}

export function acceptCall(orderId: string, callId: string): Promise<CallAck> {
  return new Promise((resolve) => {
    connectSocket().emit('call:accept', { orderId, callId }, (ack?: CallAck) =>
      resolve(ack ?? noResponse()),
    );
  });
}

export function declineCall(orderId: string, callId: string): void {
  connectSocket().emit('call:decline', { orderId, callId });
}

export function endCall(orderId: string, callId: string): void {
  connectSocket().emit('call:end', { orderId, callId });
}

export function sendCallSignal(
  orderId: string,
  callId: string,
  payload: {
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  },
): void {
  connectSocket().emit('call:signal', { orderId, callId, ...payload });
}
