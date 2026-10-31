import { timingSafeEqual } from 'node:crypto';
import { hashToken } from './token.js';

export function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function tokenMatchesHash(token: string, tokenHash: string): boolean {
  return hashesMatch(hashToken(token), tokenHash);
}
