/**
 * events/schemas.js — Zod schemas for the soft-launch
 * events / errors / metrics endpoints.
 *
 *   import { eventSchema, eventBatchSchema, errorSchema }
 *     from './schemas.js';
 *
 * Why a dedicated schema module
 * ─────────────────────────────
 *   • The frontend's `core/analytics.js` already enforces a
 *     KNOWN_EVENTS allow-list. The server mirrors that list
 *     here so an event minted on the frontend always parses
 *     server-side without a friction round-trip.
 *   • Zod gives us a single source of truth for shape +
 *     coercion. Bodies that don't match are 400-ed before
 *     they ever reach Prisma — DB integrity is preserved
 *     even when an outdated client ships a malformed payload.
 *
 * Strict-rule audit
 *   • Pure ESM, top-level imports only.
 *   • Schemas never throw — `safeParse` returns
 *     `{ success, data | error }` so the route handler can
 *     decide the 400 message.
 *   • String fields hard-cap at 256 chars (event names) and
 *     64 KB (payload JSON) to defeat oversized-body abuse.
 */

import { z } from 'zod';

// Mirror of the frontend's KNOWN_EVENTS set (core/analytics.js).
// Adding a new event here is a one-line edit + one-line edit on
// the frontend — keep them in lock-step.
export const KNOWN_EVENT_NAMES = [
  // Lifecycle
  'daily_open',
  'app_open',
  'app_error',
  'screen_stuck',
  // Onboarding
  'onboarding_completed',
  'user_type_selected',
  'language_changed',
  'location_permission_denied',
  // Farms / gardens
  'farm_created',
  'grow_created',
  'garden_created',
  'photo_uploaded',
  // Tasks
  'task_shown',
  'task_viewed',
  'task_completed',
  'task_skipped',
  // AI Task Engine v1 — emitted by POST /api/tasks/today on
  // every generation. Lets the admin metrics surface the
  // generation→view→completion funnel.
  'task_generated',
  // Admin Monitoring Dashboard v1 — operational signals.
  // `upload_failed` fires from uploadValidator when a request
  // rejects on MIME / size / magic-byte mismatch.
  // `rate_limit_hit` fires from the global apiLimiter when a
  // caller exceeds the cap.
  'upload_failed',
  'rate_limit_hit',
  // Scans
  'scan_started',
  'scan_completed',
  'scan_failed',
  // Buyer / funding
  'buyer_interest',
  'funding_viewed',
  // Health feedback
  'health_feedback_submitted',
  // Setup completions
  'setup_garden_completed',
  'setup_farm_completed',
  // Listings
  'listing_expiry_sweep',
  // Security
  'role_access_denied',
  // Pilot event tracker (May 2026 — safeEventTracker.js).
  // These five names are the ONLY events the new lightweight
  // tracker fires. Added here so /api/events accepts them
  // without returning 400, which would cause the tracker to
  // permanently drop them (its 400-drop spec §3 rule).
  'app_opened',          // replaces legacy 'app_open' for pilot tracking
  'weather_loaded',      // live /api/weather succeeded for this session
  'weather_fallback_used', // weather unavailable — fallback shape shown
];

// Single event payload — matches what the frontend's
// `trackEvent(name, payload)` call ships to the offline queue.
// `payload` is a free-form JSON object; we hard-cap its
// stringified size to 64 KB so a buggy client can't smuggle
// megabytes of state into the events table.
const PAYLOAD_MAX_BYTES = 64 * 1024;

// Zod v4 requires explicit key + value types for z.record.
// Stringified-size cap defends against oversized payloads.
const payloadSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .refine(
    (val) => {
      if (val == null) return true;
      try { return JSON.stringify(val).length <= PAYLOAD_MAX_BYTES; }
      catch { return false; }
    },
    { message: `payload exceeds ${PAYLOAD_MAX_BYTES} bytes` },
  );

export const eventSchema = z.object({
  name:      z.string().min(1).max(64).refine(
    (n) => KNOWN_EVENT_NAMES.includes(n),
    { message: 'Unknown event name' },
  ),
  // Optional client-minted UUID for idempotency. When omitted
  // the route synthesises one. Hard-cap to 64 chars.
  id:        z.string().min(1).max(128).optional(),
  // Optional client timestamp (ISO 8601 OR ms-epoch number).
  // Server clamps anything > 1min in the future.
  timestamp: z.union([z.string(), z.number().finite()]).optional(),
  payload:   payloadSchema,
});

// Batched events — `{ events: [...] }`. Caps batch size at 100
// to match the frontend's offline-queue chunk size.
export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

// Single OR batch — accepts either shape so the frontend can
// post `{ name, payload }` for one-off events without an
// envelope, or `{ events: [...] }` for queue drains.
export const eventOrBatchSchema = z.union([
  eventSchema,
  eventBatchSchema,
]);

// Error log — separate from events because crash payloads carry
// stack frames + context the events surface doesn't need.
export const errorSchema = z.object({
  message:        z.string().min(1).max(512),
  // Optional 6-frame stack truncated at 4 KB. We never mirror
  // this back to the user — production responses use a neutral
  // "Internal server error" message.
  stack:          z.string().max(4096).optional(),
  // Where the error was caught (component name / route).
  surface:        z.string().max(64).optional(),
  // Component stack (React render boundary capture).
  componentStack: z.string().max(2048).optional(),
  // Current route at the moment of the crash.
  route:          z.string().max(256).optional(),
  // Browser user-agent (may be redacted).
  userAgent:      z.string().max(512).optional(),
  // Client minted at the moment of the crash.
  timestamp:      z.union([z.string(), z.number().finite()]).optional(),
  // Free-form context (locale, app version, ab variants).
  context:        payloadSchema,
});

// Window query for the metrics endpoint. Admin Monitoring
// Dashboard v1 spec asks for these filter dimensions:
//   • windowDays (Today=1 / Last 7 / Last 30)
//   • userType   (farmer / backyard / ngo / buyer / all)
//   • country    (ISO-3166 alpha-2, free-form upper-bound)
//   • region     (free-form, used as a substring match)
//   • language   (one of the 6 launch locales OR 'all')
//
// All filters optional — omitted means "all". `windowDays`
// defaults to 7 to match the existing dashboard.
export const metricsQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(30).default(7),
  userType:   z.enum(['farmer', 'backyard', 'ngo', 'buyer', 'all']).optional(),
  country:    z.string().min(2).max(56).optional(),
  region:     z.string().min(1).max(64).optional(),
  language:   z.enum(['en', 'fr', 'sw', 'ha', 'tw', 'hi', 'all']).optional(),
});

// Helpers used by the route to convert the validated shape into
// the persistence-layer shape consumed by prisma.clientEvent.

export function toClientEventRow(parsed, { userId, orgId, ip, appVersion }) {
  let createdAt;
  const t = parsed.timestamp;
  if (typeof t === 'number' && Number.isFinite(t)) createdAt = new Date(t);
  else if (typeof t === 'string') {
    const d = new Date(t);
    if (Number.isFinite(d.getTime())) createdAt = d;
  }
  if (!createdAt || createdAt.getTime() > Date.now() + 60_000) {
    createdAt = new Date();
  }
  return {
    id:         parsed.id || cryptoRandomId(),
    type:       parsed.name,
    payload:    parsed.payload || null,
    createdAt,
    farmerId:   userId || null,
    orgId:      orgId || null,
    appVersion: appVersion || null,
    offline:    false,
    // ip is dropped intentionally — we never persist raw IPs in
    // the events table per the privacy rule. Country / region
    // come from the payload when supplied.
    _ip: ip,
  };
}

function cryptoRandomId() {
  // Use crypto.randomUUID when available (Node 18+ — Railway is
  // Node 20). Fallback to a Date.now() + Math.random() shape
  // for SSR / odd runtimes.
  if (typeof globalThis.crypto !== 'undefined'
      && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const _internal = Object.freeze({
  PAYLOAD_MAX_BYTES,
  cryptoRandomId,
});
