/**
 * decisionV2/schemas.js — Zod schemas for the v2 decision API.
 *
 *   GET  /api/decision/today          query → decisionQuerySchema
 *   POST /api/decision/complete       body  → decisionCompleteSchema
 *   POST /api/soil/manual             body  → soilManualSchema
 *
 * Strict-rule audit
 *   • Every string field has a `.max()` cap.
 *   • Coordinates are coerced + validated to the WGS84 range.
 *   • Lists are bounded.
 */

import { z } from 'zod';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
const USER_TYPES = ['farmer', 'backyard'];
const MOISTURE_LABELS = ['dry', 'moist', 'wet', 'unknown'];

// Used by GET /api/decision/today as query params (so all values
// arrive as strings — coerce as needed).
export const decisionQuerySchema = z.object({
  userType: z.enum(USER_TYPES).optional(),
  crop:     z.string().min(1).max(48).optional(),
  stage:    z.string().min(1).max(32).optional(),
  country:  z.string().min(2).max(56).optional(),
  region:   z.string().min(1).max(64).optional(),
  lat:      z.coerce.number().min(-90).max(90).optional(),
  lng:      z.coerce.number().min(-180).max(180).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});

// POST /api/decision/complete body — records the user finishing
// the suggested action. Optional outcome feedback closes the
// learning loop (spec §10).
export const decisionCompleteSchema = z.object({
  decisionId:   z.string().min(1).max(64),
  ruleId:       z.string().min(1).max(64).optional(),
  outcome:      z.enum(['done', 'skipped', 'helpful', 'not_helpful']).default('done'),
  comment:      z.string().min(1).max(280).optional(),
  completedAt:  z.string().datetime().optional(),
});

// POST /api/soil/manual body
export const soilManualSchema = z.object({
  moistureLabel: z.enum(MOISTURE_LABELS),
  soilType:      z.string().min(1).max(32).optional(),
  notes:         z.string().min(1).max(200).optional(),
  farmId:        z.string().min(1).max(64).optional(),
});

export const _internal = Object.freeze({
  SUPPORTED_LANGUAGES, USER_TYPES, MOISTURE_LABELS,
});
