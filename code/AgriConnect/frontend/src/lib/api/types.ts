export type Role = 'FARMER' | 'BUYER' | 'ADMIN' | 'AGRONOMIST';
export type ListingStatus = 'draft' | 'active' | 'sold_out' | 'expired' | 'removed';
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled';
export type Unit = 'kg' | 'quintal' | 'ton';
export type DeliveryMode = 'pickup' | 'delivery';
export type BuyerType = 'trader' | 'retailer' | 'bulk' | 'horeca';

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FarmerProfile {
  id: string;
  farmName: string | null;
  region: string | null;
  ratingAvg: string | number | null;
}

export interface BuyerProfile {
  id: string;
  businessName: string | null;
  buyerType: BuyerType;
  ratingAvg: string | number | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  languagePref: string;
  state: string | null;
  district: string | null;
  village: string | null;
  verified: boolean;
  isSuspended: boolean;
  createdAt: string;
  farmerProfile?: FarmerProfile | null;
  buyerProfile?: BuyerProfile | null;
}

export interface ListingPhoto {
  id: string;
  publicUrl: string;
  sortOrder: number;
}

export interface ListingFarmer {
  userId: string;
  name: string;
  state: string | null;
  district: string | null;
  verified: boolean;
  farmName: string | null;
  ratingAvg: string | number | null;
}

export interface Listing {
  id: string;
  farmerProfileId: string;
  farmer?: ListingFarmer;
  crop: string;
  category: string;
  variety: string | null;
  quantity: string;
  unit: Unit;
  pricePerUnit: string;
  harvestDate: string;
  state: string;
  district: string;
  village: string | null;
  description: string | null;
  minimumOrderQuantity: string;
  status: ListingStatus;
  perishable: boolean;
  viewCount: number;
  interestCount: number;
  expiresAt: string | null;
  photos: ListingPhoto[];
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'held'
  | 'released'
  | 'refunded'
  | 'failed';

export interface OrderPayment {
  id: string;
  status: PaymentStatus;
  provider: string;
  amount: string;
  method: PaymentMethod | null;
  methodLabel: string | null;
  failureReason: string | null;
  heldAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
}

export interface PaymentMethodOption {
  method: PaymentMethod;
  label: string;
  /** UPI / card / net banking hold funds in escrow; cash on delivery does not. */
  escrow: boolean;
}

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  farmerId: string;
  quantity: string;
  unit: Unit;
  pricePerUnit: string;
  priceTotal: string;
  status: OrderStatus;
  deliveryMode: DeliveryMode;
  notes: string | null;
  cancellationReason: string | null;
  logisticsStatus?: 'none' | 'dispatched' | 'in_transit' | 'delivered';
  dispatchedAt?: string | null;
  inTransitAt?: string | null;
  logisticsDeliveredAt?: string | null;
  payment?: OrderPayment | null;
  listing?: Pick<Listing, 'id' | 'crop' | 'status' | 'photos'>;
  buyer?: { id: string; name: string; ratingAvg?: string | number | null };
  farmer?: { id: string; name: string; ratingAvg?: string | number | null };
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  /** Values behind title/body so the client can render them in the reader's language. */
  params?: Record<string, string | number> | null;
  readAt: string | null;
  createdAt: string;
}

export interface FarmerReport {
  role: 'FARMER';
  totalListings: number;
  totalQuantitySold: string;
  revenue: string;
}

export interface BuyerReport {
  role: 'BUYER';
  totalOrders: number;
  totalSpend: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  usersByRole?: Record<string, number>;
  totalListings: number;
  activeListings?: number;
  totalOrders: number;
  gmv: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  verified: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';

export interface Bid {
  id: string;
  listingId: string;
  buyerId: string;
  farmerId: string;
  pricePerUnit: string;
  quantity: string;
  unit: Unit;
  priceTotal: string;
  status: BidStatus;
  counterPrice: string | null;
  notes: string | null;
  rejectionReason: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    crop: string;
    variety: string | null;
    unit: Unit;
    pricePerUnit: string;
    quantity: string;
    minimumOrderQuantity: string;
    status: ListingStatus;
    state: string;
    district: string;
    photo: string | null;
  };
  buyer?: {
    id: string;
    name: string;
    businessName: string | null;
    ratingAvg: number | null;
  };
  farmer?: {
    id: string;
    name: string;
    farmName: string | null;
    ratingAvg: number | null;
  };
}

export interface CreateBidInput {
  listingId: string;
  pricePerUnit: string;
  quantity: string;
  notes?: string;
}

export interface CounterBidInput {
  counterPrice: string;
  notes?: string;
}

export interface RejectBidInput {
  rejectionReason?: string;
}

