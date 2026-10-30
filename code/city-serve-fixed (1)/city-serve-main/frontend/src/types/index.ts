// ─────────────────────────────────────────────────────────────────────────────
// CityServe Frontend Types  (aligned with simplified 6-table backend)
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";

// ── Auth / User ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  address?: string | null;
  city?: string | null;
}

// ── Category ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon: string;
}

// ── Vendor ────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  userId?: string;
  businessName: string;
  description?: string | null;
  category?: Category;
  categoryId: string;
  type: "PRODUCT" | "SERVICE" | "BOTH";
  imageUrl?: string | null;
  phone?: string | null;
  city: string | null;
  address: string | null;
  area?: string | null;
  subcategory?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  source?: string | null;
  sourceUrl?: string | null;
  placeId?: string | null;
  verificationStatus?: string | null;
  isClaimed?: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt?: string;
}


// ── Offering (covers both products and services) ──────────────────────────────

export interface Offering {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  categoryId: string;
  category?: Category;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number | null;
  unit?: string | null;
  stock?: number;
  durationMinutes?: number | null;
  isAvailable: boolean;
}

// Backward-compat aliases
export type Product = Offering;
export type Service = Offering;

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartItem {
  offeringId: string;
  quantity: number;
  offering: Offering & { vendor?: Pick<Vendor, "id" | "businessName" | "isVerified"> };
}

// ── Order ─────────────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  vendorId?: string;
  offeringId?: string;
  quantity: number;
  type: "PRODUCT" | "SERVICE";
  price: number;
  totalAmount: number;
  address: string | null;
  scheduledAt: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerNote?: string | null;
  vendorNote?: string | null;
  completedAt?: string | null;
  // eagerly loaded relations
  vendor?: Pick<Vendor, "businessName" | "imageUrl" | "phone">;
  Offering?: Pick<Offering, "name" | "imageUrl" | "type" | "price" | "unit" | "durationMinutes">;
  customer?: { name: string; phone?: string };
  review?: Review;
  createdAt: string;
  updatedAt?: string;
}

// ── Review ────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  customerId?: string;
  vendorId?: string;
  offeringId?: string;
  orderId?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { name: string };
  vendor?: { businessName: string; imageUrl?: string | null };
  offering?: { name: string; imageUrl?: string | null };
}
