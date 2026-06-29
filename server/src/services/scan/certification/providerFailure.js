/**
 * providerFailure.js — canonical provider-failure classifier for production validation.
 *
 * Maps a provider call failure into ONE of the exact 7 sprint categories, plus a
 * targeted, actionable recommendation. Used by the per-scan metric writer and the
 * Production Validation Report so the same classification is applied everywhere
 * (single source of truth — no duplicate logic).
 *
 * Pure, total, never throws.
 */
export const FAILURE_CATEGORY = Object.freeze({
  AUTH: 'AUTH',
  CREDITS: 'CREDITS',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK: 'NETWORK',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
});

const RECO = Object.freeze({
  AUTH: 'Provider rejected the API key (401/403). Verify the key is set + active on Railway.',
  CREDITS: 'Provider credits/quota exhausted (402). Top up the provider account before relaunch.',
  RATE_LIMIT: 'Provider rate-limited (429). Add backoff / spread scans out; retry shortly.',
  NETWORK: 'Could not reach the provider (connection error or 5xx). Check Railway egress + the provider status page; retry.',
  INVALID_RESPONSE: 'Provider returned an unparseable/unexpected response. Check the adapter mapping + the provider API version.',
  TIMEOUT: 'Provider exceeded the latency budget. Check provider status; consider raising the timeout or retrying.',
  UNKNOWN: 'Unclassified failure. Inspect the raw provider response + server logs to root-cause.',
});

/**
 * Classify a failed provider call. Returns one of FAILURE_CATEGORY.
 *
 * Providers do NOT report failures uniformly: some carry `reason`, some `status`, the scan
 * consensus adapters carry `error`, and a timeout/abort surfaces only in the error `message`.
 * HTTP status is frequently encoded as an "http_NNN" string (e.g. reason/error 'http_401')
 * rather than a numeric field. This combines every textual signal and recovers the status
 * from an "http_NNN" token so the SAME classification applies to every provider — otherwise
 * real AUTH/CREDITS/RATE_LIMIT/TIMEOUT failures silently bucket as UNKNOWN.
 *
 * @param {{httpStatus?:number, reason?:string, status?:string, error?:string, message?:string}} info
 */
export function classifyProviderFailure(info = {}) {
  const i = (info && typeof info === 'object') ? info : {};
  const r = [i.reason, i.status, i.error, i.message]
    .filter((v) => typeof v === 'string' && v)
    .join(' ')
    .toLowerCase();

  // HTTP status: explicit numeric field first, else recovered from an "http_NNN" token.
  let s = Number(i.httpStatus);
  if (!Number.isFinite(s)) {
    const m = r.match(/http[_\s-]?(\d{3})/);
    if (m) s = Number(m[1]);
  }

  if (s === 401 || s === 403 || /\bauth\b|unauthor|forbidden|invalid.?key|api.?key|credential/.test(r)) return FAILURE_CATEGORY.AUTH;
  if (s === 402 || /credit|quota|insufficient|payment|exhaust|out of/.test(r)) return FAILURE_CATEGORY.CREDITS;
  if (s === 429 || /rate.?limit|too many|throttl/.test(r)) return FAILURE_CATEGORY.RATE_LIMIT;
  if (/timeout|timed.?out|abort|deadline|etimedout/.test(r)) return FAILURE_CATEGORY.TIMEOUT;
  if (/network|econn|enotfound|eai_again|dns|socket|fetch failed|fetch_error|connect|unreachable|getaddrinfo|tls|ssl|no.?response/.test(r)) return FAILURE_CATEGORY.NETWORK;
  if (/schema|parse|invalid.?response|malformed|unexpected token|unexpected end|bad.?json|mapping|map_error/.test(r)) return FAILURE_CATEGORY.INVALID_RESPONSE;
  if (Number.isFinite(s) && s >= 500) return FAILURE_CATEGORY.NETWORK;       // upstream/infra error reached but failed
  if (Number.isFinite(s) && s >= 200 && s < 300) return FAILURE_CATEGORY.INVALID_RESPONSE; // 2xx but no usable body
  return FAILURE_CATEGORY.UNKNOWN;
}

/** Targeted, actionable recommendation for a failure category. */
export function recommendationFor(category) {
  return RECO[category] || RECO.UNKNOWN;
}
