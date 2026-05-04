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
  // `debug=1` returns the raw sourceSignals + ruleId. Honoured
  // only for platform_admin / super_admin roles; the route
  // double-checks before populating the field. Spec §3 + §10:
  // raw technical signals are NEVER shown to normal users.
  debug:    z.union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')]).optional(),
});

// POST /api/decision/complete body — records the user finishing
// the suggested action. Spec §4: minimal contract — { decisionId,
// actionType }. Optional context lives in the snapshot column on
// the server.
export const decisionCompleteSchema = z.object({
  decisionId:  z.string().min(1).max(64),
  actionType:  z.string().min(1).max(64).optional(),
  // Legacy fields kept so older clients keep working — the new
  // route only persists the spec-shape columns.
  ruleId:      z.string().min(1).max(64).optional(),
  outcome:     z.enum(['done', 'skipped', 'helpful', 'not_helpful']).optional(),
  comment:     z.string().min(1).max(280).optional(),
  completedAt: z.string().datetime().optional(),
});

// POST /api/decision/outcome body — long-tail feedback (asked
// 2-3 days after a decision). Spec §5.
export const decisionOutcomeSchema = z.object({
  decisionId: z.string().min(1).max(64),
  result:     z.enum(['healthy', 'needs_attention', 'not_sure']),
  notes:      z.string().min(1).max(500).optional(),
});

// GET /api/decision/history query — bounded pagination.
export const decisionHistoryQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(64).optional(),
  // `debug=1` is admin-only; the route checks the role separately
  // before honouring it. The flag still parses for everyone so a
  // typo doesn't 400 the page.
  debug:  z.union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')]).optional(),
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
