import type { ListingStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../common/app-error.js';

const FARMER_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ['active'],
  active: ['draft'],
  sold_out: ['active'],
  expired: ['active'],
  removed: [],
};

export function assertFarmerStatusTransition(
  current: ListingStatus,
  next: ListingStatus,
): void {
  if (current === next) {
    return;
  }

  if (!FARMER_TRANSITIONS[current].includes(next)) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      `Listing status cannot change from ${current} to ${next}`,
    );
  }
}

export function assertListingCanActivate(input: {
  photoCount: number;
  quantity: string;
  minimumOrderQuantity: string;
}): void {
  if (input.photoCount < 1) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Active listings require at least one photo',
    );
  }
  if (Number(input.quantity) <= 0) {
    throw new AppError(400, 'INVALID_REQUEST', 'Active listings require available stock');
  }
  if (Number(input.minimumOrderQuantity) > Number(input.quantity)) {
    throw new AppError(
      400,
      'INVALID_REQUEST',
      'Minimum order quantity cannot exceed available quantity',
    );
  }
}
