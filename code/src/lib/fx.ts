/**
 * Static, approximate conversion rates, used to express a figure in whichever
 * currency the traveller picked. These are NOT live exchange rates: every amount
 * the app shows is an estimate, and this is one more reason it says so. Replacing
 * them needs a real FX source, not a change anywhere else.
 */
const RATES_PER_INR: Record<string, number> = {
  INR: 1,
  USD: 1 / 83,
  EUR: 1 / 90,
  GBP: 1 / 105,
};

export function fromInr(amountInInr: number, currency: string): number {
  const rate = RATES_PER_INR[currency] ?? 1;
  return Math.round(amountInInr * rate);
}
