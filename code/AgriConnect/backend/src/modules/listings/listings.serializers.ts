import type {
  Listing,
  ListingPhoto,
  Prisma,
} from '../../generated/prisma/client.js';
import { moneyString, quantityString } from '../../common/decimal.js';

export interface ListingViewer {
  id?: string;
  role?: string;
}

type ListingWithRelations = Listing & {
  photos: Pick<ListingPhoto, 'id' | 'publicUrl' | 'sortOrder'>[];
  farmerProfile: {
    id: string;
    farmName: string | null;
    ratingAvg: Prisma.Decimal | null;
    user: {
      id: string;
      name: string;
      state: string | null;
      district: string | null;
      verified: boolean;
    };
  };
};

export function serializeListing(
  listing: ListingWithRelations,
  viewer?: ListingViewer,
  options: { includeVillage?: boolean } = {},
) {
  const isOwner = viewer?.id === listing.farmerProfile.user.id;
  const isAdmin = viewer?.role === 'ADMIN';
  const includeVillage = options.includeVillage ?? (isOwner || isAdmin);

  return {
    id: listing.id,
    farmerProfileId: listing.farmerProfileId,
    farmer: {
      userId: listing.farmerProfile.user.id,
      name: listing.farmerProfile.user.name,
      state: listing.farmerProfile.user.state,
      district: listing.farmerProfile.user.district,
      verified: listing.farmerProfile.user.verified,
      farmName: listing.farmerProfile.farmName,
      ratingAvg: listing.farmerProfile.ratingAvg
        ? moneyString(listing.farmerProfile.ratingAvg)
        : null,
    },
    crop: listing.crop,
    category: listing.category,
    variety: listing.variety,
    quantity: quantityString(listing.quantity),
    unit: listing.unit,
    pricePerUnit: moneyString(listing.pricePerUnit),
    harvestDate: listing.harvestDate.toISOString().slice(0, 10),
    state: listing.state,
    district: listing.district,
    village: includeVillage ? listing.village : null,
    description: listing.description,
    minimumOrderQuantity: quantityString(listing.minimumOrderQuantity),
    status: listing.status,
    perishable: listing.perishable,
    viewCount: listing.viewCount,
    interestCount: listing.interestCount,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    photos: listing.photos.map((photo) => ({
      id: photo.id,
      publicUrl: photo.publicUrl,
      sortOrder: photo.sortOrder,
    })),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}
