import type { Response } from 'supertest';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { disconnectDatabase } from '../src/config/db.js';
import { hashesMatch, tokenMatchesHash } from '../src/utils/token-compare.js';
import { createOpaqueToken, hashToken } from '../src/utils/token.js';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';

interface ApiErrorBody {
  success: boolean;
  data?: unknown;
  error?: { code: string };
}

function jsonBody(response: Response): ApiErrorBody {
  return response.body as ApiErrorBody;
}

describe('health endpoint', () => {
  it('returns liveness without a database call', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(jsonBody(response)).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('rejects unknown routes with the standard error envelope', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(jsonBody(response)).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('rejects unauthenticated protected routes with 401', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
    expect(jsonBody(response)).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects buyer-only order creation without a token', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .send({ listingId: '11111111-1111-4111-8111-111111111111', quantity: '1', deliveryMode: 'pickup' });
    expect(response.status).toBe(401);
  });

  it('rejects a malformed JSON body with 400 INVALID_REQUEST', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(jsonBody(response)).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });

  it('rejects a body over the 10 kb JSON limit with 413, not 500', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(20_000) }));
    expect(response.status).toBe(413);
    expect(jsonBody(response)).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });
});

describe('token helpers', () => {
  it('hashes and compares opaque tokens in constant time', () => {
    const token = createOpaqueToken();
    expect(tokenMatchesHash(token, hashToken(token))).toBe(true);
    expect(tokenMatchesHash(token, hashToken('other'))).toBe(false);
    expect(hashesMatch(hashToken(token), hashToken(token))).toBe(true);
  });

  it('signs and verifies access tokens with HS256 claims', () => {
    const token = signAccessToken('11111111-1111-4111-8111-111111111111', 'FARMER');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.role).toBe('FARMER');
    expect(payload.typ).toBe('access');
  });
});

afterAll(async () => {
  await disconnectDatabase();
});
