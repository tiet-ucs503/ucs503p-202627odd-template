import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatQty } from '@/lib/format';

describe('formatMoney', () => {
  it('renders rupees with Latin digits in every locale', () => {
    for (const locale of ['en', 'hi', 'pa', 'ta', 'ur']) {
      const value = formatMoney('44000', locale);
      expect(value).toContain('44,000');
      expect(value).toMatch(/[₹]|INR/);
      expect(value).not.toMatch(/[\u0966-\u096F\u0BE6-\u0BEF\u06F0-\u06F9]/);
    }
  });

  it('passes through values that are not numbers', () => {
    expect(formatMoney('n/a')).toBe('n/a');
  });
});

describe('formatQty', () => {
  it('keeps the localized unit next to a Latin-digit amount', () => {
    expect(formatQty('100', 'ਕੁਇੰਟਲ', 'pa')).toBe('100 ਕੁਇੰਟਲ');
    expect(formatQty('1500', 'क्विंटल', 'hi')).toBe('1,500 क्विंटल');
  });
});

describe('formatDate', () => {
  const iso = '2026-03-01T00:00:00.000Z';

  it('uses month names from the requested locale', () => {
    expect(formatDate(iso, 'en')).toMatch(/Mar/);
    expect(formatDate(iso, 'hi')).toMatch(/[\u0900-\u097F]/);
    expect(formatDate(iso, 'pa')).toMatch(/[\u0A00-\u0A7F]/);
  });

  it('always writes the day and year in Latin digits', () => {
    expect(formatDate(iso, 'hi')).toMatch(/2026/);
    expect(formatDate(iso, 'ta')).toMatch(/2026/);
  });
});
