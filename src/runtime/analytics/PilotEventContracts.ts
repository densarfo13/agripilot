/**
 * PilotEventContracts.ts — canonical event names + payload shape
 * for sprint #188 pilot analytics measurement.
 *
 * Pure data + helpers. SSR-safe. Frozen at module scope so call
 * sites cannot mutate. Never throws.
 *
 * Why this exists:
 *   Sprint #157 wired a few retention events + outcome counts in
 *   the existing PilotAnalyticsRuntime, but only 7 of the spec's
 *   24 canonical events were tracked. This module pins the full
 *   24-event vocabulary and the payload contract so every track()
 *   call site uses the same string.
 *
 * Privacy contract (spec §1):
 *   - NO sensitive fields. The shape below is the EXHAUSTIVE
 *     allowed metadata. Anything else MUST be rejected.
 *   - Role enum only ('farmer' | 'gardener' | 'field_officer' |
 *     'org_admin' | 'admin') — never raw user id, name, phone,
 *     email, exact coords, device id, IP, exact filename.
 *   - Free-form metadata key is only allowed when its value is a
 *     primitive (string, number, boolean) AND its key is in
 *     ALLOWED_METADATA_KEYS.
 */

export const PILOT_EVENT_CONTRACTS_VERSION = 'pilot-event-contracts-v1';

// ─── 24 canonical event names (spec §1) ────────────────────────
export const PILOT_EVENTS = Object.freeze({
  // Auth + onboarding
  SIGNUP_STARTED:          'signup_started',
  SIGNUP_COMPLETED:        'signup_completed',
  LOGIN_COMPLETED:         'login_completed',
  LANGUAGE_SELECTED:       'language_selected',
  // Profile + setup
  FARM_CREATED:            'farm_created',
  GARDEN_CREATED:          'garden_created',
  CROP_ADDED:              'crop_added',
  PLANT_ADDED:             'plant_added',
  // Today's Action funnel
  TODAY_ACTION_SHOWN:      'today_action_shown',
  TODAY_ACTION_STARTED:    'today_action_started',
  TODAY_ACTION_COMPLETED:  'today_action_completed',
  // Scan funnel
  SCAN_STARTED:            'scan_started',
  SCAN_COMPLETED:          'scan_completed',
  SCAN_UNKNOWN_RESULT:     'scan_unknown_result',
  SCAN_CANDIDATE_SELECTED: 'scan_candidate_selected',
  // Tasks + outcomes
  TASK_CREATED:            'task_created',
  TASK_COMPLETED:          'task_completed',
  OUTCOME_RECORDED:        'outcome_recorded',
  FOLLOWUP_CREATED:        'followup_created',
  FOLLOWUP_COMPLETED:      'followup_completed',
  // Engagement
  NOTIFICATION_OPENED:     'notification_opened',
  WEEKLY_REVIEW_VIEWED:    'weekly_review_viewed',
  // Marketplace + funding
  SELL_LISTING_CREATED:    'sell_listing_created',
  FUNDING_VIEWED:          'funding_viewed',
} as const);

export type PilotEventName = (typeof PILOT_EVENTS)[keyof typeof PILOT_EVENTS];

export const PILOT_EVENT_NAMES: ReadonlyArray<PilotEventName> = Object.freeze(
  Object.values(PILOT_EVENTS),
) as ReadonlyArray<PilotEventName>;

// ─── Role + mode enums (spec §1) ───────────────────────────────
export const PILOT_ROLES = Object.freeze([
  'farmer', 'gardener', 'field_officer', 'org_admin', 'admin',
] as const);
export type PilotRole = (typeof PILOT_ROLES)[number];

export const PILOT_MODES = Object.freeze(['simple', 'standard'] as const);
export type PilotMode = (typeof PILOT_MODES)[number];

// ─── Payload contract ──────────────────────────────────────────
export interface PilotEventPayload {
  eventType:  PilotEventName;
  role:       PilotRole | 'unknown';
  mode:       PilotMode | 'unknown';
  language:   string;  // 2-char locale code or 'unknown'
  route:      string;  // pathname only — no query string, no hash
  success:    boolean;
  ts:         number;  // Date.now() at capture
  metadata?:  Readonly<Record<string, string | number | boolean>>;
}

// ─── Privacy guard (spec §1) ───────────────────────────────────
// EXHAUSTIVE allowed metadata keys. Anything not in this set is
// stripped before write — defense against accidental sensitive
// data leakage.
export const ALLOWED_METADATA_KEYS: ReadonlySet<string> = new Set([
  // Funnel context
  'fromRoute', 'destinationRoute',
  // Scan
  'topCandidateCount', 'confidenceBand', 'objectType', 'issueType',
  'hasImage', 'durationMs',
  // Tasks / outcomes
  'taskKind', 'severity', 'urgency', 'outcomeStatus',
  'daysAfter', 'followUpOffset',
  // Notifications
  'notificationType',
  // Listings / funding
  'listingCategory', 'fundingApplication',
  // Generic
  'attempt', 'retry', 'cached', 'offline',
]);

// ─── Sensitive substrings (never permitted in metadata values) ─
const SENSITIVE_SUBSTRINGS = [
  '@',                  // email
  '+',                  // phone
  'phone',              // phone label
  'token',              // any token
  'password', 'pwd',
];

function _sanitizeValue(v: unknown): string | number | boolean | null {
  if (typeof v === 'string') {
    const lower = v.toLowerCase();
    for (const s of SENSITIVE_SUBSTRINGS) {
      if (lower.includes(s)) return null;
    }
    // Strip strings longer than 200 chars (likely raw payload dump).
    if (v.length > 200) return null;
    return v;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  return null;
}

/**
 * Strip any metadata key that isn't whitelisted + scrub values
 * that contain sensitive substrings. Returns a frozen safe object.
 * Never throws.
 */
export function sanitizeMetadata(
  input: unknown,
): Readonly<Record<string, string | number | boolean>> {
  try {
    if (!input || typeof input !== 'object') return Object.freeze({});
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (!ALLOWED_METADATA_KEYS.has(k)) continue;
      const safe = _sanitizeValue(v);
      if (safe == null) continue;
      out[k] = safe;
    }
    return Object.freeze(out);
  } catch { return Object.freeze({}); }
}

export function isValidEventName(s: unknown): s is PilotEventName {
  return typeof s === 'string'
    && (PILOT_EVENT_NAMES as ReadonlyArray<string>).includes(s);
}
export function isValidRole(s: unknown): s is PilotRole {
  return typeof s === 'string'
    && (PILOT_ROLES as ReadonlyArray<string>).includes(s);
}
export function isValidMode(s: unknown): s is PilotMode {
  return typeof s === 'string'
    && (PILOT_MODES as ReadonlyArray<string>).includes(s);
}

// ─── Storage contract ─────────────────────────────────────────
export const PILOT_EVENTS_STORAGE_KEY = 'farroway.pilotEvents';
export const PILOT_EVENTS_MAX_RETAINED = 5000; // FIFO cap
