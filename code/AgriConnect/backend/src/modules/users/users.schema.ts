import { z } from 'zod';
import { APP_LOCALES } from '../../common/locales.js';

const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: optionalText(30),
    languagePref: z.enum(APP_LOCALES).optional(),
    state: optionalText(100),
    district: optionalText(100),
    village: optionalText(100),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const updateFarmerProfileSchema = z
  .object({
    farmName: optionalText(120),
    region: optionalText(120),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const updateBuyerProfileSchema = z
  .object({
    businessName: optionalText(120),
    buyerType: z.enum(['trader', 'retailer', 'bulk', 'horeca']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const deleteMeSchema = z
  .object({
    confirm: z.string(),
  })
  .strict();

export const publicUserParamsSchema = z.object({ id: z.uuid() }).strict();

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateFarmerProfileInput = z.infer<typeof updateFarmerProfileSchema>;
export type UpdateBuyerProfileInput = z.infer<typeof updateBuyerProfileSchema>;
export type DeleteMeInput = z.infer<typeof deleteMeSchema>;
