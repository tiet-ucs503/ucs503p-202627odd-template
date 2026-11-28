/**
 * Verifies API writes are reflected in Supabase (read-back via Prisma).
 * Run: npx tsx scripts/integration-crud-check.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase, getPrismaClient } from '../src/config/db.ts';

const BASE = process.env.API_BASE ?? 'http://localhost:5001';
const stamp = Date.now();
const farmerEmail = `audit-farmer-${stamp}@agriconnect.test`;
const buyerEmail = `audit-buyer-${stamp}@agriconnect.test`;
const password = 'AuditPass123!';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  return { status: response.status, body };
}

function assert(label: string, ok: boolean, detail?: string) {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(label);
}

async function main() {
  await connectDatabase();
  const prisma = getPrismaClient();
  const beforeUsers = await prisma.user.count();

  // Register farmer
  const regFarmer = await api<{ accessToken: string; user: { id: string } }>(
    '/api/v1/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        email: farmerEmail,
        password,
        name: 'Audit Farmer',
        role: 'FARMER',
        phone: '+919876543210',
        state: 'Punjab',
        district: 'Amritsar',
      }),
    },
  );
  assert('register farmer', regFarmer.status === 201, String(regFarmer.status));
  const farmerToken = regFarmer.body.data?.accessToken ?? '';
  const farmerId = regFarmer.body.data?.user.id ?? '';

  const farmerInDb = await prisma.user.findUnique({ where: { email: farmerEmail } });
  assert('farmer in DB', farmerInDb?.role === 'FARMER');

  // Register buyer
  const regBuyer = await api<{ accessToken: string }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerEmail,
      password,
      name: 'Audit Buyer',
      role: 'BUYER',
      phone: '+919876543211',
      state: 'Punjab',
      district: 'Ludhiana',
    }),
  });
  assert('register buyer', regBuyer.status === 201);
  const buyerToken = regBuyer.body.data?.accessToken ?? '';

  // Create listing (draft — active requires photo first)
  const harvest = new Date();
  harvest.setDate(harvest.getDate() + 14);
  const listingRes = await api<{ id: string; status: string }>('/api/v1/listings', {
    method: 'POST',
    token: farmerToken,
    body: JSON.stringify({
      crop: `Audit Wheat ${stamp}`,
      category: 'grains',
      quantity: '500',
      unit: 'kg',
      pricePerUnit: '25.00',
      harvestDate: harvest.toISOString().slice(0, 10),
      state: 'Punjab',
      district: 'Amritsar',
      minimumOrderQuantity: '10',
      perishable: false,
      status: 'draft',
    }),
  });
  assert('create listing', listingRes.status === 201);
  const listingId = listingRes.body.data?.id ?? '';

  const listingDb = await prisma.listing.findUnique({ where: { id: listingId } });
  assert('listing in DB', listingDb?.crop.includes('Audit Wheat'));

  // Upload a real crop JPEG (1×1 smoke pixels look broken in the marketplace UI)
  const wheatPhotoPath = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../frontend/public/crops/wheat.jpg',
  );
  const jpegBytes = await fs.readFile(wheatPhotoPath);
  const photoForm = new FormData();
  photoForm.append('files', new Blob([jpegBytes], { type: 'image/jpeg' }), 'wheat.jpg');
  const photoUpload = await fetch(`${BASE}/api/v1/listings/${listingId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${farmerToken}` },
    body: photoForm,
  });
  assert('upload listing photo', photoUpload.status === 201 || photoUpload.status === 200);

  const activate = await api<{ status: string }>(`/api/v1/listings/${listingId}`, {
    method: 'PATCH',
    token: farmerToken,
    body: JSON.stringify({ status: 'active' }),
  });
  assert('activate listing', activate.status === 200 && activate.body.data?.status === 'active');

  // Place order
  const orderRes = await api<{ id: string; status: string }>('/api/v1/orders', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      listingId,
      quantity: '50',
      deliveryMode: 'pickup',
      notes: 'Audit integration order',
    }),
  });
  assert('create order', orderRes.status === 201);
  const orderId = orderRes.body.data?.id ?? '';

  const orderDb = await prisma.order.findUnique({ where: { id: orderId } });
  assert('order in DB', orderDb?.notes === 'Audit integration order');

  // Message
  const msgRes = await api<{ id: string; body: string }>(
    `/api/v1/orders/${orderId}/messages`,
    {
      method: 'POST',
      token: buyerToken,
      body: JSON.stringify({ body: 'Audit chat message' }),
    },
  );
  assert('create message', msgRes.status === 201);
  const msgDb = await prisma.message.findFirst({ where: { orderId } });
  assert('message in DB', msgDb?.body === 'Audit chat message');

  // Fulfill order (farmer flow)
  await api(`/api/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    token: farmerToken,
    body: JSON.stringify({ status: 'accepted' }),
  });
  await api(`/api/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    token: farmerToken,
    body: JSON.stringify({ status: 'confirmed' }),
  });
  const fulfill = await api(`/api/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    token: farmerToken,
    body: JSON.stringify({ status: 'fulfilled' }),
  });
  assert('fulfill order', fulfill.status === 200);

  // Review
  const reviewRes = await api<{ id: string; rating: number }>(
    `/api/v1/orders/${orderId}/reviews`,
    {
      method: 'POST',
      token: buyerToken,
      body: JSON.stringify({ rating: 5, comment: 'Audit review' }),
    },
  );
  assert('create review', reviewRes.status === 201);
  const reviewDb = await prisma.review.findFirst({ where: { orderId } });
  assert('review in DB', reviewDb?.rating === 5);

  const afterUsers = await prisma.user.count();
  assert('user count increased', afterUsers >= beforeUsers + 2);

  console.log('\nAll CRUD checks passed — frontend API paths write to Supabase correctly.');

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
