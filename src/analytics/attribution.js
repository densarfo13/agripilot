/**
 * attribution.js — capture and surface the user's acquisition
 * source on first visit, then auto-attach it (plus country +
 * experience) to every analytics event going forward.
 *
 * Spec coverage (Attribution + funnel §1, §3)
 *   §1 capture source: video / facebook / reddit / direct
 *   §3 store per user: source / country / experience
 *
 * Storage
 *   farroway_attribution : {
 *     source:     'video' | 'facebook' | 'reddit' | 'instagram' |
 *                  'twitter' | 'tiktok' | 'youtube' | 'whatsapp' |
 *                  'sms' | 'email' | 'organic' | 'direct' | string,
 *     medium?:    string,                  // utm_medium when present
 *     campaign?:  string,                  // utm_campaign when present
 *     referrer?:  string,                  // raw document.referrer
 *     capturedAt: ISO,
 *   }
 *
 * Capture rules (in priority order)
 *   1. `?utm_source=…` URL param (canonical when present)
 *   2. `?ref=CODE` URL param → 'referral' (referralStore handles
 *      the redemption side; we only flag the source bucket)
 *   3. `document.referrer` host mapped to a known channel
 *   4. Fallback: 'direct'
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Idempotent — first capture sticks; later visits don't
 *     overwrite the source (the "channel that brought you")
 *     even if the user shares a fresh referrer with themselves.
 *   • Pure read for `getAttribution()`. No DOM access at module
 *     init time; all reads happen inside helpers.
 */

export const ATTRIBUTION_KEY = 'farroway_attribution';

const REFERRER_HOST_MAP = Object.freeze({
  'facebook.com':         'facebook',
  'm.facebook.com':       'facebook',
  'l.facebook.com':       'facebook',
  'fb.com':               'facebook',
  'reddit.com':           'reddit',
  'old.reddit.com':       'reddit',
  'youtube.com':          'youtube',
  'm.youtube.com':        'youtube',
  'youtu.be':             'youtube',
  'instagram.com':        'instagram',
  'twitter.com':          'twitter',
  'x.com':                'twitter',
  'tiktok.com':           'tiktok',
  'whatsapp.com':         'whatsapp',
  'wa.me':                'whatsapp',
  'web.whatsapp.com':     'whatsapp',
  // Search engines bucket together as 'organic'.
  'google.com':           'organic',
  'www.google.com':       'organic',
  'bing.com':             'organic',
  'duckduckgo.com':       'organic',
  'yahoo.com':            'organic',
});

const VIDEO_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be', 'tiktok.com']);

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch { /* swallow */ }
}

function _safeReadJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _hostFromUrl(rawUrl) {
  try {
    if (!rawUrl) return '';
    const url = new URL(String(rawUrl));
    return String(url.hostname || '').toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

function _bucketFromReferrer(referrer) {
  const host = _hostFromUrl(referrer);
  if (!host) return null;
  if (REFERRER_HOST_MAP[host]) return REFERRER_HOST_MAP[host];
  // Substring fallback for vendor variations.
  for (const [k, v] of Object.entries(REFERRER_HOST_MAP)) {
    if (host.endsWith(k)) return v;
  }
  // Bucket video hosts that didn't already match.
  if (VIDEO_HOSTS.has(host)) return 'video';
  return null;
}

function _normaliseSource(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'fb' || s === 'meta')         return 'facebook';
  if (s === 'ig')                         return 'instagram';
  if (s === 'yt')                         return 'youtube';
  if (s === 'tt')                         return 'tiktok';
  if (s === 'x')                          return 'twitter';
  return s;
}

/**
 * captureFromUrl({ url?, referrer? }) — runs once on first visit.
 * Returns the persisted attribution record.
 *
 * Idempotent: if a record already exists, returns it unchanged.
 */
export function captureFromUrl({ url, referrer } = {}) {
  const existing = _safeRead();
  if (existing && existing.source) return existing;

  let resolvedUrl = url;
  if (!resolvedUrl) {
    try { resolvedUrl = (typeof window !== 'undefined' && window.location) ? window.location.href : ''; }
    catch { resolvedUrl = ''; }
  }
  let resolvedReferrer = referrer;
  if (resolvedReferrer == null) {
    try { resolvedReferrer = (typeof document !== 'undefined') ? document.referrer || '' : ''; }
    catch { resolvedReferrer = ''; }
  }

  let utmSource = null;
  let utmMedium = null;
  let utmCampaign = null;
  let referralCode = null;
  try {
    const u = new URL(String(resolvedUrl || ''));
    utmSource   = _normaliseSource(u.searchParams.get('utm_source'));
    utmMedium   = u.searchParams.get('utm_medium')   || null;
    utmCampaign = u.searchParams.get('utm_campaign') || null;
    referralCode = u.searchParams.get('ref') || null;
  } catch { /* swallow */ }

  let source =
    utmSource
    || (referralCode ? 'referral' : null)
    || _bucketFromReferrer(resolvedReferrer)
    || 'direct';

  // 'video' alias — let utm_medium=video promote youtube/tiktok
  // hits to the 'video' bucket for cleaner roll-ups.
  if (source === 'youtube' || source === 'tiktok') {
    if (String(utmMedium || '').toLowerCase() === 'video') source = 'video';
  }

  const stored = {
    source,
    medium:    utmMedium || null,
    campaign:  utmCampaign || null,
    referrer:  resolvedReferrer || null,
    capturedAt: new Date().toISOString(),
  };
  _safeWrite(stored);
  return stored;
}

/** Read the persisted attribution record. Null when unset. */
export function getAttribution() {
  return _safeRead();
}

/**
 * getAttributionContext() — small, pre-flattened bag the
 * funnelEvents helper merges into every payload. Returns:
 *
 *   { source, country, experience }
 *
 * Reads `farroway_active_farm` + `farroway_user_profile` for
 * country / experience. Never throws; missing fields are dropped
 * from the returned object so we don't pollute payloads.
 */
export function getAttributionContext() {
  const out = {};
  const attrib = _safeRead();
  if (attrib && attrib.source) out.source = attrib.source;

  const farm = _safeReadJson('farroway_active_farm');
  const profile = _safeReadJson('farroway_user_profile');

  const country =
    (farm && farm.country)
    || (farm && farm.location && farm.location.country)
    || (profile && profile.country)
    || null;
  if (country) out.country = String(country);

  const experience =
    (profile && profile.experience)
    || (farm && farm.experience)
    || (farm && farm.farmType)
    || null;
  if (experience) out.experience = String(experience);

  return out;
}

/** Test / admin: clear the attribution stamp. */
export function _resetAttribution() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ATTRIBUTION_KEY);
    }
  } catch { /* swallow */ }
}

export default {
  ATTRIBUTION_KEY,
  captureFromUrl,
  getAttribution,
  getAttributionContext,
};
