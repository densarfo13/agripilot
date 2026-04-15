/**
 * Zod validation for seasonal timing updates.
 *
 * Used by:
 *  - PATCH /api/v2/farm-profile/:id (general edit)
 *  - GET/PATCH /api/v2/farm-profile/:id/seasonal-timing (dedicated endpoint)
 */

import { z } from 'zod';

const month = z.number().int().min(1).max(12);

/**
 * Schema for seasonal timing fields.
 * All fields optional — farmers fill in what they know.
 */
export const seasonalTimingSchema = z.object({
  seasonStartMonth: month.nullable().optional().default(null),
  seasonEndMonth: month.nullable().optional().default(null),
  plantingWindowStartMonth: month.nullable().optional().default(null),
  plantingWindowEndMonth: month.nullable().optional().default(null),

  currentSeasonLabel: z.string()
    .trim()
    .max(100, 'Season label too long')
    .nullable()
    .optional()
    .default(null),

  lastRainySeasonStart: z.union([
    z.string().datetime({ message: 'Must be a valid ISO date' }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be YYYY-MM-DD' }),
    z.null(),
  ]).optional().default(null),

  lastDrySeasonStart: z.union([
    z.string().datetime({ message: 'Must be a valid ISO date' }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be YYYY-MM-DD' }),
    z.null(),
  ]).optional().default(null),
}).refine(
  (data) => {
    // If both season months provided, they must be valid months
    // (no further cross-field constraint — wrap-around is valid)
    return true;
  },
  { message: 'Invalid seasonal timing' },
);
