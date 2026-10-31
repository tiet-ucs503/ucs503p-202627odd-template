import type {
  BuyerProfile,
  FarmerProfile,
  Role,
  User,
} from '../generated/prisma/client.js';
import { moneyString } from './decimal.js';

type UserRecord = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'role'
  | 'phone'
  | 'languagePref'
  | 'state'
  | 'district'
  | 'village'
  | 'verified'
  | 'isSuspended'
  | 'createdAt'
>;

export function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    languagePref: user.languagePref,
    state: user.state,
    district: user.district,
    village: user.village,
    verified: user.verified,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeFarmerProfile(
  profile: Pick<FarmerProfile, 'id' | 'farmName' | 'region' | 'ratingAvg'> | null,
) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    farmName: profile.farmName,
    region: profile.region,
    ratingAvg: profile.ratingAvg ? moneyString(profile.ratingAvg) : null,
  };
}

export function serializeBuyerProfile(
  profile: Pick<
    BuyerProfile,
    'id' | 'businessName' | 'buyerType' | 'ratingAvg'
  > | null,
) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    businessName: profile.businessName,
    buyerType: profile.buyerType,
    ratingAvg: profile.ratingAvg ? moneyString(profile.ratingAvg) : null,
  };
}

export function serializeMe(user: UserRecord & {
  farmerProfile: Pick<FarmerProfile, 'id' | 'farmName' | 'region' | 'ratingAvg'> | null;
  buyerProfile: Pick<
    BuyerProfile,
    'id' | 'businessName' | 'buyerType' | 'ratingAvg'
  > | null;
}) {
  return {
    ...serializeUser(user),
    farmerProfile: serializeFarmerProfile(user.farmerProfile),
    buyerProfile: serializeBuyerProfile(user.buyerProfile),
  };
}

export function serializePublicFarmer(user: {
  id: string;
  name: string;
  role: Role;
  state: string | null;
  district: string | null;
  verified: boolean;
  farmerProfile: Pick<FarmerProfile, 'farmName' | 'ratingAvg'> | null;
}) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    state: user.state,
    district: user.district,
    verified: user.verified,
    farmName: user.farmerProfile?.farmName ?? null,
    ratingAvg: user.farmerProfile?.ratingAvg
      ? moneyString(user.farmerProfile.ratingAvg)
      : null,
  };
}
