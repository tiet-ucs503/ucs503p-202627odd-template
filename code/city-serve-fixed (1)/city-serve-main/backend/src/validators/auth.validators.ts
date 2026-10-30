import { z } from "zod";

export const registerCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8, "Password must be at least 8 characters."),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      formattedAddress: z.string(),
      locality: z.string().optional(),
      city: z.string(),
      district: z.string().optional(),
      state: z.string(),
      postalCode: z.string().optional(),
      country: z.string().default("India"),
      label: z.enum(["HOSTEL", "HOME", "OTHER"]).default("HOME"),
      labelName: z.string().optional(),
    })
    .optional(),
});

export const registerPartnerSchema = z.object({
  name: z.string().min(2).max(100),
  businessName: z.string().min(2).max(150),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8),
  categoryId: z.string(),
  partnerType: z.enum(["PRODUCT", "SERVICE", "BOTH"]),
  description: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    formattedAddress: z.string(),
    locality: z.string().optional(),
    city: z.string(),
    district: z.string().optional(),
    state: z.string(),
    postalCode: z.string().optional(),
    country: z.string().default("India"),
  }),
  serviceRadiusKm: z.number().min(1).max(50).default(5),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
