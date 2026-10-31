/**
 * Live smoke test for in-app call signalling.
 * Connects the buyer and the farmer of one order and walks a full call handshake.
 * Run against a local dev server: npx tsx scripts/smoke-call-signaling.ts
 */
import { io, type Socket } from 'socket.io-client';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5001';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Demo@AgriConnect1';
const BUYER = 'aman.singh@demo.agriconnect.local';
const FARMER_CANDIDATES = [
  'kabir.manchanda@demo.agriconnect.local',
  'ravi.kumar@demo.agriconnect.local',
];

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}`, detail ? JSON.stringify(detail) : '');
}

async function login(email: string): Promise<{ token: string; userId: string }> {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = (await response.json()) as any;
  return { token: json?.data?.accessToken ?? '', userId: json?.data?.user?.id ?? '' };
}

function connect(token: string): Promise<Socket> {
  const socket = io(BASE, { path: '/socket.io', transports: ['websocket'], auth: { token } });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Waits for one event, or resolves null after a timeout. */
function waitFor<T>(socket: Socket, event: string, ms = 5000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (ack: T) => resolve(ack));
  });
}

async function main(): Promise<void> {
  const buyer = await login(BUYER);
  if (!buyer.token) {
    console.error('Buyer login failed — is the demo data seeded?');
    process.exit(1);
  }

  const ordersResponse = await fetch(`${BASE}/api/v1/orders?limit=20`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  const orders = ((await ordersResponse.json()) as any).data ?? [];
  const order = orders.find((o: any) => o.status !== 'cancelled');
  if (!order) {
    console.error('No usable order for this buyer.');
    process.exit(1);
  }

  let farmer = { token: '', userId: '' };
  for (const email of FARMER_CANDIDATES) {
    const candidate = await login(email);
    if (candidate.userId === order.farmerId) {
      farmer = candidate;
      break;
    }
  }
  if (!farmer.token) {
    console.error('Could not log in as the farmer on this order.');
    process.exit(1);
  }

  const buyerSocket = await connect(buyer.token);
  const farmerSocket = await connect(farmer.token);
  console.log(`Both parties connected for order ${order.id.slice(0, 8)}\n`);

  // The farmer must be in the order room to receive the ring.
  await emitWithAck(farmerSocket, 'join:order', order.id);

  console.log('Call handshake');
  const incomingPromise = waitFor<any>(farmerSocket, 'call:incoming');
  const invite = await emitWithAck<any>(buyerSocket, 'call:invite', { orderId: order.id });
  check('invite is acked with a callId', invite?.ok === true && Boolean(invite.callId), invite);
  check('invite returns ICE servers', Array.isArray(invite?.iceServers) && invite.iceServers.length > 0, invite?.iceServers);

  const incoming = await incomingPromise;
  check('farmer receives call:incoming', incoming?.callId === invite?.callId, incoming);
  check('incoming names the caller, not a phone number', Boolean(incoming?.from?.name) && !('phone' in (incoming?.from ?? {})), incoming?.from);

  const busy = await emitWithAck<any>(buyerSocket, 'call:invite', { orderId: order.id });
  check('second concurrent call is rejected', busy?.ok === false && busy.code === 'CONFLICT', busy);

  const acceptedPromise = waitFor<any>(buyerSocket, 'call:accepted');
  const accept = await emitWithAck<any>(farmerSocket, 'call:accept', {
    orderId: order.id,
    callId: invite.callId,
  });
  check('accept is acked', accept?.ok === true, accept);
  const accepted = await acceptedPromise;
  check('caller receives call:accepted', accepted?.callId === invite.callId, accepted);

  console.log('\nSignal relay');
  const offerPromise = waitFor<any>(farmerSocket, 'call:signal');
  buyerSocket.emit('call:signal', {
    orderId: order.id,
    callId: invite.callId,
    description: { type: 'offer', sdp: 'v=0 fake-offer' },
  });
  const offer = await offerPromise;
  check('offer reaches the callee', offer?.description?.type === 'offer', offer);
  check('relay tags the sender', offer?.fromUserId === buyer.userId, offer?.fromUserId);

  const candidatePromise = waitFor<any>(buyerSocket, 'call:signal');
  farmerSocket.emit('call:signal', {
    orderId: order.id,
    callId: invite.callId,
    candidate: { candidate: 'candidate:fake', sdpMid: '0' },
  });
  const candidate = await candidatePromise;
  check('ICE candidate reaches the caller', Boolean(candidate?.candidate), candidate);

  console.log('\nAuthorisation and teardown');
  const forged = await emitWithAck<any>(farmerSocket, 'call:accept', {
    orderId: order.id,
    callId: '00000000-0000-0000-0000-000000000000',
  });
  check('unknown callId is rejected', forged?.ok === false, forged);

  const endedPromise = waitFor<any>(farmerSocket, 'call:ended');
  buyerSocket.emit('call:end', { orderId: order.id, callId: invite.callId });
  const ended = await endedPromise;
  check('callee is told the call ended', ended?.callId === invite.callId, ended);

  const afterEnd = await emitWithAck<any>(buyerSocket, 'call:invite', { orderId: order.id });
  check('a new call can start after hang-up', afterEnd?.ok === true, afterEnd);
  buyerSocket.emit('call:end', { orderId: order.id, callId: afterEnd.callId });

  buyerSocket.disconnect();
  farmerSocket.disconnect();

  console.log(`\n${failures === 0 ? 'All call signalling checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
