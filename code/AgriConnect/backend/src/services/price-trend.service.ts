import { getPrismaClient } from '../config/db.js';
import type { PriceTrendSource, Unit } from '../generated/prisma/client.js';

export async function recordPriceTrend(input: {
  crop: string;
  state: string;
  district?: string | null;
  source: PriceTrendSource;
  pricePerUnit: string;
  unit: Unit;
  recordedAt?: Date;
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.priceTrend.create({
    data: {
      crop: input.crop,
      state: input.state,
      district: input.district ?? null,
      source: input.source,
      pricePerUnit: input.pricePerUnit,
      unit: input.unit,
      recordedAt: input.recordedAt ?? new Date(),
    },
  });
}

/** Seed reference mandi-style points when DB has few internal samples (dev/demo). */
export async function seedReferencePriceTrendsIfEmpty(): Promise<void> {
  const prisma = getPrismaClient();
  const count = await prisma.priceTrend.count();
  if (count > 0) return;

  const now = new Date();
  const samples = [
    { crop: 'Wheat', state: 'Punjab', price: '24.50', unit: 'kg' as Unit },
    { crop: 'Wheat', state: 'Haryana', price: '23.80', unit: 'kg' as Unit },
    { crop: 'Rice', state: 'Punjab', price: '32.00', unit: 'kg' as Unit },
    { crop: 'Tomato', state: 'Maharashtra', price: '18.00', unit: 'kg' as Unit },
    { crop: 'Onion', state: 'Maharashtra', price: '22.50', unit: 'kg' as Unit },
  ];

  for (const [index, sample] of samples.entries()) {
    const recordedAt = new Date(now);
    recordedAt.setDate(recordedAt.getDate() - index * 7);
    await prisma.priceTrend.create({
      data: {
        crop: sample.crop,
        state: sample.state,
        source: 'agmarknet',
        pricePerUnit: sample.price,
        unit: sample.unit,
        recordedAt,
      },
    });
  }
}
