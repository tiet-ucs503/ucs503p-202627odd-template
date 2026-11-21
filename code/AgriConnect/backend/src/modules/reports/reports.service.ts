import type { Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';
import { moneyString, quantityString } from '../../common/decimal.js';
import { getPrismaClient } from '../../config/db.js';

const KG_PER_UNIT = {
  kg: 1,
  quintal: 100,
  ton: 1000,
} as const;

export async function getMyReport(userId: string, role: Role) {
  if (role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  if (role === 'FARMER') {
    const [totalListings, fulfilled] = await Promise.all([
      getPrismaClient().listing.count({
        where: { farmerProfile: { userId }, deletedAt: null },
      }),
      getPrismaClient().order.findMany({
        where: { farmerId: userId, status: 'fulfilled' },
        select: { quantity: true, unit: true, priceTotal: true },
      }),
    ]);

    const byUnit = { kg: 0, quintal: 0, ton: 0 };
    let revenue = 0;
    let kgEquivalent = 0;
    for (const order of fulfilled) {
      byUnit[order.unit] += Number(order.quantity);
      revenue += Number(order.priceTotal);
      kgEquivalent += Number(order.quantity) * KG_PER_UNIT[order.unit];
    }

    return {
      role,
      totalListings,
      totalQuantitySold: quantityString(kgEquivalent),
      totalQuantitySoldByUnit: {
        kg: quantityString(byUnit.kg),
        quintal: quantityString(byUnit.quintal),
        ton: quantityString(byUnit.ton),
      },
      revenue: moneyString(revenue),
    };
  }

  const [totalOrders, orders] = await Promise.all([
    getPrismaClient().order.count({ where: { buyerId: userId } }),
    getPrismaClient().order.findMany({
      where: { buyerId: userId, status: 'fulfilled' },
      select: { priceTotal: true },
    }),
  ]);
  const totalSpend = orders.reduce((sum, order) => sum + Number(order.priceTotal), 0);

  return {
    role,
    totalOrders,
    totalSpend: moneyString(totalSpend),
  };
}
