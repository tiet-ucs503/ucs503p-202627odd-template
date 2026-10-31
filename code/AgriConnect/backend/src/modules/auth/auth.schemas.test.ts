import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth.schemas.js';

describe('loginSchema', () => {
  it('rejects an empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'farmer@example.com', password: '' }).success,
    ).toBe(false);
  });

  it('accepts a non-empty password', () => {
    const parsed = loginSchema.parse({
      email: 'farmer@example.com',
      password: 'secret',
    });
    expect(parsed.password).toBe('secret');
  });

  it('trims copy/paste whitespace on email and password', () => {
    const parsed = loginSchema.parse({
      email: ' Farmer@Example.com ',
      password: ' Demo@AgriConnect1 \n',
    });
    expect(parsed.email).toBe('farmer@example.com');
    expect(parsed.password).toBe('Demo@AgriConnect1');
  });
});
