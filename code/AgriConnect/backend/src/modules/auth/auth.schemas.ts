import { z } from 'zod';
import { APP_LOCALES } from '../../common/locales.js';

const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const requiredLocation = z.string().trim().min(1).max(100);
const optionalVillage = z.string().trim().min(1).max(100).optional();

export const registerSchema = z
  .object({
    email,
    password,
    name: z.string().trim().min(1).max(100),
    role: z.enum(['FARMER', 'BUYER']),
    phone: z.string().trim().min(1).max(30),
    state: requiredLocation,
    district: requiredLocation,
    village: optionalVillage,
    languagePref: z.enum(APP_LOCALES).default('en'),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    // Trim so copy/paste from the faculty demo box still works.
    password: z.string().trim().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(512),
    password,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
