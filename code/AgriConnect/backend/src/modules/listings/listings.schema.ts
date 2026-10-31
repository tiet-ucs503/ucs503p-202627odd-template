import { z } from 'zod';

const decimalString = (
  name: string,
  options: { positive: boolean; integerDigits: number; scale: number },
) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .pipe(
      z
        .string()
        .regex(
          new RegExp(
            `^\\d{1,${String(options.integerDigits)}}(?:\\.\\d{1,${String(options.scale)}})?$`,
          ),
          `${name} must be a valid decimal`,
        )
        .refine(
          (value) => (options.positive ? Number(value) > 0 : Number(value) >= 0),
          `${name} must be ${options.positive ? 'greater than zero' : 'zero or greater'}`,
        ),
    );

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

const harvestDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'harvestDate must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'harvestDate must be a valid date')
  .refine((value) => {
    const maximum = new Date();
    maximum.setUTCFullYear(maximum.getUTCFullYear() + 2);
    return new Date(`${value}T00:00:00.000Z`) <= maximum;
  }, 'harvestDate cannot be more than two years in the future');

const listingFields = {
  crop: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
  variety: optionalText(80),
  quantity: decimalString('quantity', {
    positive: true,
    integerDigits: 9,
    scale: 3,
  }),
  unit: z.enum(['kg', 'quintal', 'ton']),
  pricePerUnit: decimalString('pricePerUnit', {
    positive: false,
    integerDigits: 10,
    scale: 2,
  }),
  harvestDate: harvestDateSchema,
  state: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  village: optionalText(100),
  description: optionalText(2000),
  minimumOrderQuantity: decimalString('minimumOrderQuantity', {
    positive: true,
    integerDigits: 9,
    scale: 3,
  }),
  status: z.enum(['draft', 'active']),
  perishable: z.boolean(),
} as const;

function validateMinimumOrder(
  value: {
    quantity?: string | undefined;
    minimumOrderQuantity?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (
    value.quantity !== undefined &&
    value.minimumOrderQuantity !== undefined &&
    Number(value.minimumOrderQuantity) > Number(value.quantity)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['minimumOrderQuantity'],
      message: 'minimumOrderQuantity cannot exceed quantity',
    });
  }
}

export const createListingBodySchema = z
  .object({
    ...listingFields,
    status: listingFields.status.default('draft'),
  })
  .strict()
  .superRefine(validateMinimumOrder);

export const updateListingBodySchema = z
  .object(listingFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .superRefine(validateMinimumOrder);

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const listListingsQuerySchema = z
  .object({
    crop: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    district: z.string().trim().min(1).max(100).optional(),
    minPrice: decimalString('minPrice', {
      positive: false,
      integerDigits: 10,
      scale: 2,
    }).optional(),
    maxPrice: decimalString('maxPrice', {
      positive: false,
      integerDigits: 10,
      scale: 2,
    }).optional(),
    minQuantity: decimalString('minQuantity', {
      positive: true,
      integerDigits: 9,
      scale: 3,
    }).optional(),
    harvestFrom: harvestDateSchema.optional(),
    harvestTo: harvestDateSchema.optional(),
    perishable: booleanQuery.optional(),
    status: z.enum(['draft', 'active', 'sold_out', 'expired', 'removed']).optional(),
    mine: booleanQuery.default(false),
    sort: z
      .enum(['createdAt_desc', 'price_asc', 'price_desc', 'harvestDate_asc'])
      .default('createdAt_desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      Number(value.minPrice) > Number(value.maxPrice)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxPrice'],
        message: 'maxPrice must be greater than or equal to minPrice',
      });
    }
    if (value.harvestFrom && value.harvestTo && value.harvestFrom > value.harvestTo) {
      context.addIssue({
        code: 'custom',
        path: ['harvestTo'],
        message: 'harvestTo must be on or after harvestFrom',
      });
    }
  });

export const listingIdParamsSchema = z.object({ id: z.uuid() }).strict();
export const photoParamsSchema = z
  .object({ id: z.uuid(), photoId: z.uuid() })
  .strict();

export type CreateListingInput = z.infer<typeof createListingBodySchema>;
export type UpdateListingInput = z.infer<typeof updateListingBodySchema>;
export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;
