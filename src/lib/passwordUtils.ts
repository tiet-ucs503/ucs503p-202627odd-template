import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { MAX_PASSWORD_LENGTH, evaluatePasswordPolicy } from './passwordPolicy';
export { MAX_PASSWORD_LENGTH, evaluatePasswordPolicy };
export type { PasswordPolicyCheck } from './passwordPolicy';

export const BCRYPT_SALT_ROUNDS = 12;

function assertPasswordLength(pwd: string): void {
  if (typeof pwd !== 'string' || pwd.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  }
}

function timingSafeEqualBuffers(expected: Buffer, actual: Buffer): boolean {
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}


export async function hashPasswordBcrypt(pwd: string): Promise<string> {
  assertPasswordLength(pwd);
  return bcrypt.hash(pwd, BCRYPT_SALT_ROUNDS);
}

export function hashPasswordBcryptSync(pwd: string): string {
  assertPasswordLength(pwd);
  return bcrypt.hashSync(pwd, BCRYPT_SALT_ROUNDS);
}

export async function hashPasswordScrypt(pwd: string): Promise<string> {
  assertPasswordLength(pwd);
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pwd, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function hashPasswordLegacy(pwd: string): Promise<string> {
  assertPasswordLength(pwd);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + pwd).digest('hex');
  return `sha256:${salt}:${hash}`;
}

export async function verifyPassword(
  pwd: string,
  hash: string
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  if (!hash || typeof hash !== 'string' || typeof pwd !== 'string' || pwd.length > MAX_PASSWORD_LENGTH) {
    return { isValid: false, needsRehash: false };
  }

  // 1. Bcrypt verification
  if (hash.startsWith('$2')) {
    const isValid = await bcrypt.compare(pwd, hash);
    if (!isValid) return { isValid: false, needsRehash: false };
    const match = hash.match(/^\$2[aby]?\$(\d+)\$/);
    const cost = match ? parseInt(match[1], 10) : BCRYPT_SALT_ROUNDS;
    const needsRehash = cost < BCRYPT_SALT_ROUNDS;
    return { isValid: true, needsRehash };
  }

  // 2. Scrypt verification
  if (hash.startsWith('scrypt:')) {
    const parts = hash.split(':');
    if (parts.length === 3) {
      const [, salt, expectedHex] = parts;
      return new Promise((resolve) => {
        crypto.scrypt(pwd, salt, 64, (err, derivedKey) => {
          if (err) {
            resolve({ isValid: false, needsRehash: false });
            return;
          }
          try {
            const matches = timingSafeEqualBuffers(Buffer.from(expectedHex, 'hex'), derivedKey);
            resolve({ isValid: matches, needsRehash: true });
          } catch {
            resolve({ isValid: false, needsRehash: false });
          }
        });
      });
    }
  }

  // 3. Legacy SHA-256 verification
  if (hash.startsWith('sha256:')) {
    const parts = hash.split(':');
    if (parts.length === 3) {
      const [, salt, expectedHex] = parts;
      const computed = crypto.createHash('sha256').update(salt + pwd).digest('hex');
      const matches = timingSafeEqualBuffers(Buffer.from(expectedHex, 'hex'), Buffer.from(computed, 'hex'));
      return { isValid: matches, needsRehash: true };
    }
  }

  const fallbackComputed = crypto.createHash('sha256').update(pwd).digest('hex');
  if (timingSafeEqualBuffers(Buffer.from(hash, 'utf8'), Buffer.from(fallbackComputed, 'utf8'))) {
    return { isValid: true, needsRehash: true };
  }

  return { isValid: false, needsRehash: false };
}

export function hashPasswordScryptSync(pwd: string): string {
  assertPasswordLength(pwd);
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pwd, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export function hashPasswordLegacySync(pwd: string): string {
  assertPasswordLength(pwd);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + pwd).digest('hex');
  return `sha256:${salt}:${hash}`;
}

export function verifyPasswordSync(
  pwd: string,
  hash: string
): { isValid: boolean; needsRehash: boolean; detectedAlgorithm?: string } {
  if (!hash || typeof hash !== 'string' || typeof pwd !== 'string' || pwd.length > MAX_PASSWORD_LENGTH) {
    return { isValid: false, needsRehash: false, detectedAlgorithm: 'unknown' };
  }
  if (hash.startsWith('$2')) {
    const isValid = bcrypt.compareSync(pwd, hash);
    if (!isValid) return { isValid: false, needsRehash: false, detectedAlgorithm: 'bcrypt' };
    const match = hash.match(/^\$2[aby]?\$(\d+)\$/);
    const cost = match ? parseInt(match[1], 10) : BCRYPT_SALT_ROUNDS;
    return { isValid: true, needsRehash: cost < BCRYPT_SALT_ROUNDS, detectedAlgorithm: 'bcrypt' };
  }
  if (hash.startsWith('scrypt:')) {
    const parts = hash.split(':');
    if (parts.length === 3) {
      const [, salt, expectedHex] = parts;
      try {
        const derivedKey = crypto.scryptSync(pwd, salt, 64);
        const matches = timingSafeEqualBuffers(Buffer.from(expectedHex, 'hex'), derivedKey);
        return { isValid: matches, needsRehash: true, detectedAlgorithm: 'scrypt' };
      } catch {
        return { isValid: false, needsRehash: false, detectedAlgorithm: 'scrypt' };
      }
    }
  }
  if (hash.startsWith('sha256:')) {
    const parts = hash.split(':');
    if (parts.length === 3) {
      const [, salt, expectedHex] = parts;
      const computed = crypto.createHash('sha256').update(salt + pwd).digest('hex');
      const matches = timingSafeEqualBuffers(Buffer.from(expectedHex, 'hex'), Buffer.from(computed, 'hex'));
      return { isValid: matches, needsRehash: true, detectedAlgorithm: 'sha256' };
    }
  }
  return { isValid: false, needsRehash: false, detectedAlgorithm: 'unknown' };
}
