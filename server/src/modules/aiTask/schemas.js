/**
 * aiTask/schemas.js — Zod schemas for the AI Task Engine v1.
 *
 *   POST /api/tasks/today  request body  →  todayTaskRequestSchema
 *
 *   Response shape is documented inline below; we don't strictly
 *   validate outbound payloads (the engine guarantees the shape)
 *   but the JSDoc here is the source of truth for the frontend
 *   contract.
 *
 * Strict-rule audit
 *   • Pure ESM, top-level imports only.
 *   • Every string field has an upper-bound `.max()` so a buggy
 *     client can't smuggle megabytes through.
 *   • Coordinates are coerced + validated to the WGS84 range.
 *   • Language defaults to 'en' so callers that omit it never
 *     hit a missing-key fallback path.
 */

import { z } from 'zod';

// Supported user types — must stay in lock-step with the
// frontend's `core/userType.js` resolver.
export const USER_TYPES = ['farmer', 'backyard'];

// Supported launch languages — must stay in lock-step with
// `i18n/translations.js` LAUNCH_LOCALES.
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];

// Crop allow-list — passes-through as a free-form string but
// hard-caps length so a bug can't blow up the engine. Recognised
// crops in the engine: maize, rice, cassava, tomato, cocoa, plus
// backyard-specific (pepper, lettuce, onion, herbs).
const cropFieldSchema = z.string().min(1).max(48).optional();

// Growth-stage enum — accepts the engine's canonical 6 stages
// plus a couple of common aliases.
export const GROWTH_STAGES = [
  'planning', 'planting', 'germination', 'vegetative', 'flowering',
  'maturity', 'harvest', 'post_harvest', 'fallow',
];

const stageFieldSchema = z.string().min(1).max(32).optional();

// Coordinates — both must be present together or both omitted.
// We allow the route to fall back to country/region when absent.
const coordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
}).optional();

// Weather summary — short string the client supplies (or the
// route itself fetches via the existing weatherProvider when the
// caller hasn't pre-fetched). Allowed values match the
// canonical `weather.summary` enum the rest of the codebase
// uses.
const weatherSummarySchema = z
  .enum(['rainy', 'humid', 'hot', 'dry', 'windy', 'cool', 'cold', 'unknown'])
  .optional();

// Rainfall forecast — mm in the next 24 h. Capped at 200 mm to
// reject obviously-bad values (a once-in-decade storm tops out
// around 150 mm).
const rainfallSchema = z.coerce.number().min(0).max(200).optional();

// Temperature — degrees Celsius. Capped at the realistic
// outdoor range.
const temperatureSchema = z.coerce.number().min(-30).max(60).optional();

// Last completed task — short string identifying the previous
// task surface so the engine can avoid re-suggesting the same
// thing. Format is implementation-defined; we only enforce a
// length cap.
const lastTaskSchema = z.string().min(1).max(128).optional();

// Planting date — ISO 8601 string OR ms-epoch number. Future
// dates clamp to "today" inside the engine.
const plantingDateSchema = z
  .union([z.string().min(1).max(40), z.number().int().min(0)])
  .optional();

export const todayTaskRequestSchema = z.object({
  userType: z.enum(USER_TYPES),

  // Crop + stage are optional on the wire — the route looks them
  // up from the user's farm profile when missing. When BOTH are
  // missing AND the profile lookup fails, the engine returns the
  // "complete your profile" fallback task per spec rule §5.
  crop:        cropFieldSchema,
  stage:       stageFieldSchema,

  // Location: prefer coordinates; fall back to country/region.
  country:     z.string().min(2).max(56).optional(),
  region:      z.string().min(1).max(64).optional(),
  coordinates: coordinatesSchema,

  // Weather context — every field optional. The engine
  // gracefully degrades when any combination is missing per
  // spec rule §9.
  weather:           weatherSummarySchema,
  rainfallForecast:  rainfallSchema,
  temperature:       temperatureSchema,

  // History
  lastCompletedTask: lastTaskSchema,
  plantingDate:      plantingDateSchema,

  // Output language. Falls back to 'en' so callers never hit a
  // missing-key path.
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),

  // Caller-supplied request id for idempotency / log correlation.
  // Optional; the route synthesises one when absent.
  requestId: z.string().max(64).optional(),
});

/**
 * Response shape (informational — not strictly validated).
 *
 *   {
 *     todayTaskTitle:      string,
 *     taskReason:          string,
 *     urgency:             'low' | 'medium' | 'high',
 *     estimatedTime:       string,    // e.g. "5 min"
 *     safetyNote:          string | null,
 *     localizedText: {
 *       title:             string,
 *       reason:            string,
 *       safetyNote:        string | null,
 *       completionPrompt:  string,
 *     },
 *     nextRecommendedTask: string,    // hint for tomorrow
 *     completionPrompt:    string,    // text shown after Done
 *     // Diagnostics — not displayed
 *     ruleId:              string,
 *     userType:            'farmer' | 'backyard',
 *     fallback:            boolean,   // true when crop/profile missing
 *     reasonCode:          string,    // 'profile_missing' | 'weather_rain' | …
 *     generatedAt:         ISO string,
 *     requestId:           string,
 *   }
 */
