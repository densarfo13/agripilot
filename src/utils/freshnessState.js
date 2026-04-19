/**
 * freshnessState.js — one canonical interpretation of "how
 * trustworthy is this data right now?" Three tiers the UI can
 * key off so we never claim certainty we don't have:
 *
 *   fresh      — online + updated within 24h
 *   stale      — not updated in the last 24h, but possibly online
 *   very_stale — no update in 48h+, OR offline with unknown age
 *
 * Two pure helpers the rest of the app reaches for:
 *
 *   getFreshnessState({ lastUpdatedAt, now, offline }) → tier
 *   applyFreshnessWording(payload, tier, t?) → softened payload
 *
 * Invariants enforced in code (not docs):
 *   • HIGH confidence is never emitted when tier is stale/very_stale.
 *     We downgrade to medium at stale, medium-or-below at very_stale.
 *   • very_stale attaches a soft prefix ("Based on your last
 *     update") so copy is honest even when we can't refresh.
 *   • fresh is a no-op — the caller's payload passes through.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const DAY_MS      = 24 * ONE_HOUR_MS;

const STALE_THRESHOLD_MS      = 24 * ONE_HOUR_MS;  // 24h
const VERY_STALE_THRESHOLD_MS = 48 * ONE_HOUR_MS;  // 48h

export const FRESHNESS = Object.freeze({
  FRESH:      'fresh',
  STALE:      'stale',
  VERY_STALE: 'very_stale',
});

/**
 * getFreshnessState — pure classifier. Never throws.
 */
export function getFreshnessState(input = {}) {
  // Accept null/undefined/non-object safely — never throw.
  const safe = input && typeof input === 'object' ? input : {};
  const lastUpdatedAt = safe.lastUpdatedAt ?? null;
  const now           = safe.now ?? Date.now();
  const offline       = !!safe.offline;
  const ts = Number(lastUpdatedAt);
  // Offline + missing/unknown lastUpdatedAt → very_stale
  if (!Number.isFinite(ts)) {
    return offline ? FRESHNESS.VERY_STALE : FRESHNESS.STALE;
  }
  const age = Math.max(0, Number(now) - ts);
  if (age >= VERY_STALE_THRESHOLD_MS)               return FRESHNESS.VERY_STALE;
  if (offline && age >= STALE_THRESHOLD_MS)          return FRESHNESS.VERY_STALE;
  if (age >= STALE_THRESHOLD_MS)                    return FRESHNESS.STALE;
  return FRESHNESS.FRESH;
}

/**
 * applyFreshnessWording — non-mutating softener. Returns a NEW
 * payload (or the original when tier is fresh).
 *
 * Accepts the shape of buildHomeExperience output:
 *   { title, subtitle, why, next, confidenceLine, level, ... }
 * Any of those fields can be missing; we only touch what's there.
 */
export function applyFreshnessWording(payload = null, freshness = FRESHNESS.FRESH, t = null) {
  if (!payload || typeof payload !== 'object') return payload;
  if (freshness === FRESHNESS.FRESH) return payload;

  const out = { ...payload };

  // Confidence tier: NEVER retain 'high' when stale or very_stale.
  if (out.level === 'high') {
    out.level = 'medium';
  }
  // very_stale is additionally bumped to low if we were at medium.
  if (freshness === FRESHNESS.VERY_STALE && out.level === 'medium') {
    out.level = 'low';
  }

  // Attach the soft prefix line. Always deterministic English
  // fallback so the UI never renders a raw key.
  if (freshness === FRESHNESS.VERY_STALE) {
    out.confidenceLine = resolve(t, 'closing_gaps.based_on_last_update',
      'Based on your last update');
  } else if (!out.confidenceLine) {
    // stale — only attach a line if none exists. We don't want
    // to overwrite a specific trust-prefix the caller already set.
    out.confidenceLine = resolve(t, 'closing_gaps.recent_update_pending',
      'Last updated more than a day ago');
  }

  // Titles stay factual but get a softer qualifier when we had
  // to downgrade from high. The hard rule: NO imperative commands
  // for a stale scenario.
  if (freshness === FRESHNESS.VERY_STALE && out.title) {
    out.title = softenTitle(out.title);
  }

  out.freshness = freshness;
  return out;
}

/**
 * softenTitle — trivial string-level fallback for cases where
 * the caller didn't provide i18n tier variants. Keeps the title
 * honest without being verbose.
 */
function softenTitle(title) {
  if (!title) return title;
  const lower = String(title).toLowerCase();
  // If the title is already hedged, leave it alone.
  if (/\b(may|might|likely|check|maybe)\b/i.test(lower)) return title;
  // Prepend a soft qualifier.
  return `${title} (based on your last update)`;
}

function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v || v === key) return fallback;
  return v;
}

/**
 * minutesAgo — small helper for copy like "last updated 14
 * minutes ago". Caller interpolates into a localized string.
 */
export function minutesAgo(lastUpdatedAt, now = Date.now()) {
  if (lastUpdatedAt == null) return null;
  const ts = Number(lastUpdatedAt);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((now - ts) / (60 * 1000)));
}

export const _internal = {
  ONE_HOUR_MS, DAY_MS,
  STALE_THRESHOLD_MS, VERY_STALE_THRESHOLD_MS,
  softenTitle,
};
