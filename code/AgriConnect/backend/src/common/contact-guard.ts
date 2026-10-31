/**
 * Anti-disintermediation guard for free text the counterparty reads.
 *
 * Farmers and buyers must stay on AgriConnect: price, stock, and order state live
 * on the platform, and escrow only protects trades that happen here. Swapping phone
 * numbers moves the deal off-platform, so contact details are rejected before the
 * text is stored. In-app voice calling exists so nobody needs to share a number.
 *
 * Guarding chat alone is not enough — order notes and listing copy reach the same
 * two people, so every write path that accepts prose runs this scan.
 */

import { AppError } from './app-error.js';

export type ContactViolation = 'phone' | 'email' | 'upi' | 'off_platform';

export interface ContactScanResult {
  blocked: boolean;
  violations: ContactViolation[];
}

/** Digit words, including common Hindi/Punjabi transliterations, to defeat "nine eight seven...". */
const DIGIT_WORDS: Readonly<Record<string, string>> = {
  zero: '0',
  oh: '0',
  shunya: '0',
  sunya: '0',
  one: '1',
  ek: '1',
  two: '2',
  do: '2',
  three: '3',
  teen: '3',
  four: '4',
  char: '4',
  chaar: '4',
  five: '5',
  paanch: '5',
  panch: '5',
  six: '6',
  chhe: '6',
  che: '6',
  seven: '7',
  saat: '7',
  sat: '7',
  eight: '8',
  aath: '8',
  ath: '8',
  nine: '9',
  nau: '9',
};

/** Characters people substitute for digits. */
const LOOKALIKE_DIGITS: Readonly<Record<string, string>> = {
  o: '0',
  q: '0',
  l: '1',
  i: '1',
  '|': '1',
  z: '2',
  e: '3',
  a: '4',
  s: '5',
  b: '8',
  g: '9',
};

const EMAIL_PATTERN = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[a-z]{2,}/i;

/** UPI virtual payment addresses: name@ybl, name@oksbi, name@paytm, ... */
const UPI_PATTERN =
  /\b[a-z0-9._-]{2,}@(?:ybl|ibl|axl|apl|okaxis|okhdfcbank|okicici|oksbi|paytm|upi|airtel|freecharge|jio|hdfcbank|icici|sbi|pnb|axisbank|barodampay|kotak|yesbank)\b/i;

/** Explicit attempts to move the conversation off AgriConnect. */
const OFF_PLATFORM_PATTERN =
  /\b(?:whats\s*app|whatsapp|whtsapp|wtsapp|telegram|signal\s+app|snapchat|instagram|insta\s+id|facebook|messenger|imo|skype|zoom\s+id|google\s*pay|gpay|phone\s*pe|phonepe|paytm\s+number)\b/i;

/** "call me on", "my number is", "ring me at" — solicitation even without digits. */
const CONTACT_SOLICITATION_PATTERN =
  /\b(?:my|mera|mere)\s+(?:mobile|phone|number|no|contact|numbr)\b|\b(?:call|ring|dial|message|msg|text|contact)\s+(?:me|us|kar)\s*(?:on|at|par|pe)\b|\b(?:mobile|phone|contact)\s*(?:no|number|num)\s*[:=-]/i;

/**
 * Collapse separators that sit between digits so "98765 43210", "9-8-7-6-5-4-3-2-1-0",
 * and "98765.43210" all normalise to one digit run. Letters are never bridged, so
 * "1000 kg at 2500 per quintal" stays as separate short runs.
 */
function joinDigitRuns(value: string): string {
  return value.replace(/(\d)[\s._\-()/+*]{1,3}(?=\d)/g, '$1');
}

function wordsToDigits(value: string): string {
  return value.replace(/[a-z]+/gi, (word) => DIGIT_WORDS[word.toLowerCase()] ?? word);
}

function lookalikesToDigits(value: string): string {
  // Only rewrite a letter when it is wedged between digits (e.g. "98o6543210").
  return value.replace(/(?<=\d)[a-z|](?=\d)/gi, (char) => LOOKALIKE_DIGITS[char.toLowerCase()] ?? char);
}

/**
 * Indian mobiles are 10 digits starting 6-9, optionally prefixed with 0 / 91 / +91.
 * Landlines are an STD code starting 0 plus 6-8 digits.
 */
function isPhoneShaped(run: string): boolean {
  if (run.length < 10 || run.length > 13) return false;
  // Junk or a country code may sit in front, so match the mobile at the end.
  if (/[6-9]\d{9}$/.test(run)) return true;
  return /^0\d{9,10}$/.test(run);
}

/**
 * True when the text carries a phone number.
 *
 * Two passes, because prices and quantities must stay sendable: an unbroken run of
 * 10+ digits is never trade talk, while separator-split runs ("98765 43210") are only
 * blocked when they normalise to a real Indian number shape. That keeps a message like
 * "1000 kg at 2500 per quintal" flowing.
 */
function hasPhoneNumber(raw: string): boolean {
  for (const candidate of [raw, wordsToDigits(raw)]) {
    const normalized = lookalikesToDigits(candidate);
    if (/\d{10,}/.test(normalized)) {
      return true;
    }
    for (const run of joinDigitRuns(normalized).match(/\d+/g) ?? []) {
      if (isPhoneShaped(run)) return true;
    }
  }
  return false;
}

/** Scan message text for contact details that would take the trade off-platform. */
export function scanForContactInfo(body: string): ContactScanResult {
  const text = body.normalize('NFKC');
  const violations: ContactViolation[] = [];

  if (hasPhoneNumber(text)) {
    violations.push('phone');
  }
  if (EMAIL_PATTERN.test(text)) {
    violations.push('email');
  }
  if (UPI_PATTERN.test(text)) {
    violations.push('upi');
  }
  if (OFF_PLATFORM_PATTERN.test(text) || CONTACT_SOLICITATION_PATTERN.test(text)) {
    violations.push('off_platform');
  }

  return { blocked: violations.length > 0, violations };
}

const VIOLATION_MESSAGES: Readonly<Record<ContactViolation, string>> = {
  phone: 'Phone numbers cannot be shared in order chat. Use the in-app voice call instead.',
  email: 'Email addresses cannot be shared in order chat.',
  upi: 'UPI IDs cannot be shared. Pay through AgriConnect so escrow protects the order.',
  off_platform:
    'Moving this deal to another app is not allowed. Keep chat and calls on AgriConnect.',
};

export function contactViolationMessage(violations: readonly ContactViolation[]): string {
  return violations.map((violation) => VIOLATION_MESSAGES[violation]).join(' ');
}

/** Copy for surfaces where "in order chat" would be the wrong place to name. */
const GENERIC_VIOLATION_MESSAGES: Readonly<Record<ContactViolation, string>> = {
  phone: 'Phone numbers cannot be shared here. Buyers and farmers talk on the in-app voice call.',
  email: 'Email addresses cannot be shared here.',
  upi: 'UPI IDs cannot be shared. Pay through AgriConnect so escrow protects the order.',
  off_platform:
    'Pointing the trade at another app is not allowed. Keep chat and calls on AgriConnect.',
};

/**
 * Rejects contact details in a named field, or does nothing when the text is clean.
 *
 * `field` is the request body key so the client can highlight the offending input, and
 * `undefined` / empty text passes because these fields are optional.
 */
export function assertNoContactInfo(text: string | null | undefined, field: string): void {
  if (!text) return;

  const scan = scanForContactInfo(text);
  if (!scan.blocked) return;

  const message = scan.violations
    .map((violation) => GENERIC_VIOLATION_MESSAGES[violation])
    .join(' ');
  throw new AppError(400, 'CONTACT_INFO_BLOCKED', message, {
    fields: { [field]: scan.violations.map((violation) => GENERIC_VIOLATION_MESSAGES[violation]) },
  });
}
