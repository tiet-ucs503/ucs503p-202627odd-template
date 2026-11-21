import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './env';
import { refreshAccessToken } from './api/client';
import { tokenStore } from './api/token-store';

let socket: Socket | null = null;
/** Guards against a refresh/reconnect loop when the server keeps refusing the token. */
let retriedAfterRefresh = false;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      autoConnect: false,
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // A function, not an object: the handshake is re-read on every reconnect attempt,
      // so a token rotated by the REST client is picked up instead of the stale one the
      // socket was first opened with. Access tokens expire in ~15 minutes, and a page
      // left open easily outlives that.
      auth: (cb: (data: { token: string | null }) => void) => {
        cb({ token: tokenStore.get() });
      },
    });

    socket.on('connect', () => {
      retriedAfterRefresh = false;
    });

    // The handshake is rejected with "Unauthorized" once the access token expires.
    // Without this, chat and incoming calls go quietly dead while REST keeps working.
    socket.on('connect_error', (error: Error) => {
      if (retriedAfterRefresh || !/unauthorized/i.test(error.message)) return;
      retriedAfterRefresh = true;
      void refreshAccessToken().then((token) => {
        if (token) socket?.connect();
      });
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
  return client;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinOrderRoom(
  orderId: string,
  onMessage: (message: unknown) => void,
  onTyping?: (payload: { orderId: string; userId: string }) => void,
): () => void {
  const client = connectSocket();

  const onNew = (message: unknown) => onMessage(message);
  const onTypingEvent = (payload: { orderId: string; userId: string }) => {
    onTyping?.(payload);
  };
  client.on('message:new', onNew);
  client.on('typing', onTypingEvent);

  client.emit('join:order', orderId, (result?: { ok: boolean }) => {
    if (!result?.ok) {
      client.emit('join:order', orderId);
    }
  });

  return () => {
    client.off('message:new', onNew);
    client.off('typing', onTypingEvent);
    client.emit('leave:order', orderId);
  };
}
