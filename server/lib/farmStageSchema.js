/**
 * Zod validation for crop stage updates.
 *
 * Used by:
 *  - PATCH /api/v2/farm-profile/:id (general edit)
 *  - GET/PATCH /api/v2/farm-profile/:id/stage (dedicated stage endpoint)
 *  - POST /api/v2/farm-profile (creation)
 *  - POST /api/v2/farm-profile/new (new farm)
 */

import { z } from 'zod';
import { CROP_STAGES } from './cropStages.js';

/**
 * Schema for crop stage + optional planted date.
 * Used for the dedicated PATCH /:id/stage endpoint.
 */
export const farmStageSchema = z.object({
  cropStage: z.string()
    .trim()
    .toLowerCase()
    .refine((val) => CROP_STAGES.includes(val), {
      message: `Crop stage must be one of: ${CROP_STAGES.join(', ')}`,
    }),

  plantedAt: z.union([
    z.string().datetime({ message: 'plantedAt must be a valid ISO date string' }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'plantedAt must be YYYY-MM-DD or ISO format' }),
    z.null(),
  ]).optional().default(null),
});

/**
 * Lenient stage schema for optional inclusion in farm profile payloads.
 * cropStage is optional — only validated if provided.
 */
export const optionalStageFields = z.object({
  cropStage: z.string()
    .trim()
    .toLowerCase()
    .refine((val) => CROP_STAGES.includes(val), {
      message: `Crop stage must be one of: ${CROP_STAGES.join(', ')}`,
    })
    .optional()
    .nullable(),

  plantedAt: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.null(),
  ]).optional().default(null),
});
