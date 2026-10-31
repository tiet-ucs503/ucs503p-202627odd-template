import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';
import {
  assertNoContactInfo,
  contactViolationMessage,
  scanForContactInfo,
} from './contact-guard.js';

function violations(body: string) {
  return scanForContactInfo(body).violations;
}

describe('scanForContactInfo — phone numbers', () => {
  it.each([
    ['plain 10 digit mobile', 'call me 9876543210'],
    ['with country code', 'my no is +91 9876543210'],
    ['leading zero', '09876543210'],
    ['spaced halves', '98765 43210'],
    ['dashed', '98765-43210'],
    ['dotted', '98765.43210'],
    ['every digit spaced', '9 8 7 6 5 4 3 2 1 0'],
    ['every digit dashed', '9-8-7-6-5-4-3-2-1-0'],
    ['bracketed prefix', '(+91) 9876543210'],
    ['digit words', 'nine eight seven six five four three two one zero'],
    ['hindi digit words', 'nau aath saat chhe paanch char teen do ek shunya'],
    ['lookalike zero', '98o6543210'],
    ['padded with junk digits', '12 98765 43210'],
    ['landline with STD code', '0161 2345678'],
  ])('blocks %s', (_label, body) => {
    expect(violations(body)).toContain('phone');
  });

  it.each([
    ['quantities and prices', 'I can supply 1000 kg at 2500 per quintal'],
    ['order quantity', 'Need 250 kg tomatoes, budget 40000 total'],
    ['pincode alone', 'We are in Ludhiana 141001'],
    ['short digit run', 'Rate is 2200 for 50 bags'],
    ['plain trade talk', 'Wheat is ready, can you pick up tomorrow morning?'],
    ['a list of rates', 'Rates this week: 1000 2500 3000 4000'],
    ['rates starting with 9', 'Offers were 9000 8000 7000 6000 last month'],
    ['invoice with separators', 'Invoice 2026/09/07 for 300 kg'],
  ])('allows %s', (_label, body) => {
    expect(scanForContactInfo(body).blocked).toBe(false);
  });
});

describe('scanForContactInfo — other contact channels', () => {
  it('blocks email addresses', () => {
    expect(violations('mail me at kabir@example.com')).toContain('email');
  });

  it('blocks obfuscated email addresses', () => {
    expect(violations('kabir (at) example (dot) com')).toContain('email');
  });

  it('blocks UPI ids', () => {
    expect(violations('send to farmer99@oksbi')).toContain('upi');
  });

  it('blocks off-platform app names', () => {
    expect(violations('lets talk on whatsapp')).toContain('off_platform');
    expect(violations('ping me on Telegram')).toContain('off_platform');
  });

  it('blocks contact solicitation without digits', () => {
    expect(violations('my number is in the invoice')).toContain('off_platform');
    expect(violations('call me on that line')).toContain('off_platform');
  });

  it('reports every channel found in one message', () => {
    const result = scanForContactInfo('whatsapp me on 9876543210 or kabir@example.com');
    expect(result.blocked).toBe(true);
    expect(result.violations).toEqual(
      expect.arrayContaining(['phone', 'email', 'off_platform']),
    );
  });
});

describe('contactViolationMessage', () => {
  it('points the user at in-app calling', () => {
    expect(contactViolationMessage(['phone'])).toMatch(/in-app voice call/i);
  });

  it('points the user at escrow for UPI', () => {
    expect(contactViolationMessage(['upi'])).toMatch(/escrow/i);
  });
});

describe('assertNoContactInfo', () => {
  it('passes clean text through', () => {
    expect(() => {
      assertNoContactInfo('Grade A wheat, 1000 kg at 2500 per quintal', 'description');
    }).not.toThrow();
  });

  it('treats an empty or absent value as nothing to check', () => {
    // These fields are optional, so a missing value must not look like a violation.
    expect(() => {
      assertNoContactInfo(null, 'notes');
    }).not.toThrow();
    expect(() => {
      assertNoContactInfo(undefined, 'notes');
    }).not.toThrow();
    expect(() => {
      assertNoContactInfo('', 'notes');
    }).not.toThrow();
  });

  it('throws 400 CONTACT_INFO_BLOCKED naming the offending field', () => {
    let thrown: unknown;
    try {
      assertNoContactInfo('deliver fast, call 98765 43210', 'notes');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    const appError = thrown as AppError;
    expect(appError.statusCode).toBe(400);
    expect(appError.code).toBe('CONTACT_INFO_BLOCKED');
    // Field-keyed so the form can highlight the input that has to change.
    expect(appError.fields?.notes?.[0]).toMatch(/phone numbers cannot be shared/i);
  });

  it('does not name order chat outside chat', () => {
    expect(() => {
      assertNoContactInfo('mail me at kabir@example.com', 'description');
    }).toThrow(/cannot be shared here/i);
  });
});
