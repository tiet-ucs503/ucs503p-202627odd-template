import { describe, expect, it } from 'vitest';
import { canTransitionOrder } from './order-state-machine.js';

describe('order state machine', () => {
  it.each([
    ['pending', 'accepted'],
    ['accepted', 'confirmed'],
    ['confirmed', 'fulfilled'],
    ['pending', 'cancelled'],
    ['accepted', 'cancelled'],
    ['confirmed', 'cancelled'],
  ] as const)('allows farmer transition %s -> %s', (from, to) => {
    expect(
      canTransitionOrder(from, to, {
        role: 'FARMER',
        isBuyerOwner: false,
        isFarmerOwner: true,
      }),
    ).toBe(true);
  });

  it('allows a buyer owner to cancel only a pending order', () => {
    const buyer = {
      role: 'BUYER' as const,
      isBuyerOwner: true,
      isFarmerOwner: false,
    };
    expect(canTransitionOrder('pending', 'cancelled', buyer)).toBe(true);
    expect(canTransitionOrder('accepted', 'cancelled', buyer)).toBe(false);
    expect(canTransitionOrder('pending', 'accepted', buyer)).toBe(false);
  });

  it('allows admins to cancel any non-terminal order but not advance it', () => {
    const admin = {
      role: 'ADMIN' as const,
      isBuyerOwner: false,
      isFarmerOwner: false,
    };
    expect(canTransitionOrder('pending', 'cancelled', admin)).toBe(true);
    expect(canTransitionOrder('accepted', 'cancelled', admin)).toBe(true);
    expect(canTransitionOrder('confirmed', 'cancelled', admin)).toBe(true);
    expect(canTransitionOrder('pending', 'accepted', admin)).toBe(false);
  });

  it('rejects terminal, skipped, repeated, and non-owner transitions', () => {
    const farmer = {
      role: 'FARMER' as const,
      isBuyerOwner: false,
      isFarmerOwner: true,
    };
    expect(canTransitionOrder('fulfilled', 'cancelled', farmer)).toBe(false);
    expect(canTransitionOrder('cancelled', 'accepted', farmer)).toBe(false);
    expect(canTransitionOrder('pending', 'fulfilled', farmer)).toBe(false);
    expect(canTransitionOrder('accepted', 'accepted', farmer)).toBe(false);
    expect(
      canTransitionOrder('pending', 'accepted', {
        ...farmer,
        isFarmerOwner: false,
      }),
    ).toBe(false);
  });
});
