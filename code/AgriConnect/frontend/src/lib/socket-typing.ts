import { connectSocket } from './socket';

export function emitTyping(orderId: string): void {
  const client = connectSocket();
  client.emit('typing:start', orderId);
}
