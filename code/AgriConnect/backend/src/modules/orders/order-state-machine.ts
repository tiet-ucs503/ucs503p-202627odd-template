import type { OrderStatus, Role } from '../../generated/prisma/client.js';

export interface OrderActor {
  role: Role;
  isBuyerOwner: boolean;
  isFarmerOwner: boolean;
}

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['confirmed', 'cancelled'],
  confirmed: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderActor,
): boolean {
  if (!transitions[from].includes(to)) {
    return false;
  }

  if (actor.role === 'ADMIN') {
    return to === 'cancelled';
  }

  if (actor.role === 'BUYER') {
    return (
      actor.isBuyerOwner && from === 'pending' && to === 'cancelled'
    );
  }

  if (!actor.isFarmerOwner) {
    return false;
  }

  if (to === 'cancelled') {
    return true;
  }

  return (
    (from === 'pending' && to === 'accepted') ||
    (from === 'accepted' && to === 'confirmed') ||
    (from === 'confirmed' && to === 'fulfilled')
  );
}
