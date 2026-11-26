import {
  Milk,
  UtensilsCrossed,
  Shirt,
  Wrench,
  Sparkles,
  Car,
  GraduationCap,
  Camera,
  Truck,
  Smartphone,
  Zap,
  Paintbrush,
  Bug,
  Scissors,
  Laptop,
  MapPin,
  Building2,
  ShoppingBag,
  HeartPulse,
  Package,
  WashingMachine,
  LucideIcon,
} from "lucide-react";

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Milk,
  UtensilsCrossed,
  Shirt,
  Wrench,
  Sparkles,
  Car,
  GraduationCap,
  Camera,
  Truck,
  Smartphone,
  Zap,
  Paintbrush,
  Bug,
  Scissors,
  Laptop,
  MapPin,
  Building2,
  ShoppingBag,
  HeartPulse,
  Package,
  WashingMachine,
};

export function getCategoryIcon(name: string): LucideIcon {
  if (!name) return Sparkles;
  // Direct match
  if (CATEGORY_ICON_MAP[name]) return CATEGORY_ICON_MAP[name];
  // Normalized lookup (e.g. "home-services" -> Wrench)
  const lower = name.toLowerCase();
  if (lower.includes("wrench") || lower.includes("repair") || lower.includes("plumb") || lower.includes("electric")) return Wrench;
  if (lower.includes("car") || lower.includes("vehicle") || lower.includes("mechanic")) return Car;
  if (lower.includes("sparkle") || lower.includes("beauty") || lower.includes("salon")) return Sparkles;
  if (lower.includes("educat") || lower.includes("tutor") || lower.includes("coach") || lower.includes("school")) return GraduationCap;
  if (lower.includes("camera") || lower.includes("photo")) return Camera;
  if (lower.includes("truck") || lower.includes("mov")) return Truck;
  if (lower.includes("shirt") || lower.includes("laundr") || lower.includes("clean")) return Shirt;
  if (lower.includes("phone") || lower.includes("technol") || lower.includes("laptop")) return Smartphone;
  if (lower.includes("paint")) return Paintbrush;
  if (lower.includes("pest")) return Bug;
  if (lower.includes("tailor")) return Scissors;
  if (lower.includes("food") || lower.includes("dine") || lower.includes("kitchen")) return UtensilsCrossed;
  if (lower.includes("grocer") || lower.includes("market") || lower.includes("essential")) return ShoppingBag;
  return Sparkles;
}

