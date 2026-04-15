/**
 * Zod-based validation for farm profile payloads.
 *
 * Mirrors the existing validateFarmProfilePayload() logic but uses Zod
 * for structured, composable validation. Both can coexist — the Zod
 * schema is the source of truth for new code paths.
 */

import { z } from 'zod';

const VALID_SIZE_UNITS = ['ACRE', 'HECTARE', 'SQUARE_METER'];
const VALID_EXPERIENCE_LEVELS = ['new', 'experienced'];

// ─── Farm Profile Schema ────────────────────────────────────

export const farmProfileSchema = z.object({
  farmerName: z.string().min(1, 'Farmer name is required').trim(),
  farmName: z.string().min(1, 'Farm name is required').trim(),
  country: z.string().min(1, 'Country is required').trim(),
  location: z.string().min(1, 'Enter your location').trim(),

  cropType: z.string().min(1, 'Crop type is required').trim()
    .refine(
      (val) => val.toUpperCase() !== 'OTHER',
      { message: 'Please enter your crop name' },
    )
    .refine(
      (val) => {
        if (val.toUpperCase().startsWith('OTHER:')) {
          return val.slice(6).trim().length >= 2;
        }
        return true;
      },
      { message: 'Crop name must be at least 2 characters' },
    ),

  size: z.number({ coerce: true })
    .positive('Farm size must be greater than 0'),

  sizeUnit: z.string().trim().toUpperCase()
    .refine((val) => VALID_SIZE_UNITS.includes(val), {
      message: `Size unit must be one of: ${VALID_SIZE_UNITS.join(', ')}`,
    })
    .default('ACRE'),

  // GPS is optional — only validated if provided
  gpsLat: z.number({ coerce: true }).min(-90).max(90).nullable().optional().default(null),
  gpsLng: z.number({ coerce: true }).min(-180).max(180).nullable().optional().default(null),

  // Location label from reverse geocoding (optional display field)
  locationLabel: z.string().trim().nullable().optional().default(null),

  // Experience level: "new" | "experienced" | null
  experienceLevel: z.string().trim().toLowerCase()
    .refine((val) => VALID_EXPERIENCE_LEVELS.includes(val), {
      message: 'Experience level must be "new" or "experienced"',
    })
    .nullable()
    .optional()
    .default(null),
});

// ─── Farmer Type Schema ─────────────────────────────────────

export const farmerTypeSchema = z.object({
  farmerType: z.enum(['new', 'experienced'], {
    errorMap: () => ({ message: 'Farmer type must be "new" or "experienced"' }),
  }),
});

// ─── Validation helper (same interface as existing) ─────────

export function validateWithZod(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { isValid: true, errors: {}, data: result.data };
  }

  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] || '_root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { isValid: false, errors, data: null };
}
