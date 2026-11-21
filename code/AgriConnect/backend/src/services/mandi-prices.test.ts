import { describe, expect, it } from 'vitest';
import {
  DATA_GOV_EXTRA_STATES,
  filterToLatestArrivalDay,
  isMandiApiSupportedState,
  isMandiLiveState,
  MANDI_API_SUPPORTED_STATES,
  normalizeArrivalDate,
  type MandiPriceRow,
} from '../services/mandi-prices.service.js';

function row(arrivalDate: string, commodity = 'Wheat'): MandiPriceRow {
  return {
    id: `Punjab|Market|${commodity}||${arrivalDate}`,
    state: 'Punjab',
    district: 'Ludhiana',
    market: 'Market',
    commodity,
    variety: null,
    grade: null,
    arrivalDate,
    minPrice: 2000,
    maxPrice: 2200,
    modalPrice: 2100,
    unit: 'quintal',
    pricePerKg: '21.00',
    source: 'agmarknet',
    fetchedAt: null,
  };
}

describe('normalizeArrivalDate', () => {
  it('converts DD/MM/YYYY from data.gov.in to ISO', () => {
    expect(normalizeArrivalDate('02/09/2026')).toBe('2026-09-02');
  });
});

describe('mandi live state coverage', () => {
  it('covers free-API states without data.gov.in key', () => {
    for (const state of MANDI_API_SUPPORTED_STATES) {
      expect(isMandiApiSupportedState(state)).toBe(true);
      expect(isMandiLiveState(state)).toBe(true);
    }
  });

  it('lists Haryana as a data.gov.in extra state', () => {
    expect(DATA_GOV_EXTRA_STATES).toContain('Haryana');
    expect(isMandiApiSupportedState('Haryana')).toBe(false);
  });

  it('rejects unknown states on the free API list', () => {
    expect(isMandiApiSupportedState('Goa')).toBe(false);
  });
});

describe('filterToLatestArrivalDay', () => {
  it('prefers today IST rows when present', () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const rows = [row('2026-09-01'), row(today)];
    const filtered = filterToLatestArrivalDay(rows);
    expect(filtered.every((item) => item.arrivalDate === today)).toBe(true);
  });

  it('falls back to the latest arrival date when today is missing', () => {
    const rows = [row('2026-09-01'), row('2026-08-30'), row('2026-09-01', 'Rice')];
    const filtered = filterToLatestArrivalDay(rows);
    expect(filtered.every((item) => item.arrivalDate === '2026-09-01')).toBe(true);
    expect(filtered.length).toBe(2);
  });

  it('uses latest price per market when the latest day has sparse rows', () => {
    const rows = [
      row('2026-08-28', 'Wheat'),
      row('2026-08-26', 'Wheat'),
      row('2026-08-20', 'Wheat'),
    ];
    const row0 = rows[0];
    const row1 = rows[1];
    const row2 = rows[2];
    if (!row0 || !row1 || !row2) throw new Error('Test setup failed');
    row0.market = 'Abohar APMC';
    row1.market = 'Nawanshahar APMC';
    row2.market = 'Nawanshahar APMC';
    const filtered = filterToLatestArrivalDay(rows);
    expect(filtered.length).toBe(2);
    expect(filtered.map((item) => item.market).sort()).toEqual(['Abohar APMC', 'Nawanshahar APMC']);
  });
});
