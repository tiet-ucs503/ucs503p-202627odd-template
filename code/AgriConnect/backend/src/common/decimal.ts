import { Prisma } from '../generated/prisma/client.js';

export function moneyString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export function quantityString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(3);
}

export function toDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}
