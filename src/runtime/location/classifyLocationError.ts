/**
 * classifyLocationError — turn a geolocation failure (+ environment context) into a
 * SPECIFIC, farmer-facing verdict, instead of collapsing every cause into one generic
 * "we couldn't detect your location".
 *
 * getCurrentPosition (src/utils/geolocation.js) rejects with err.code ∈
 *   'access_denied' (native 1) · 'unavailable' (2) · 'timeout' (3) · 'unsupported' · 'unknown'
 * but several UI surfaces ignore the code. This is the single source of truth that maps
 * (error, context) → { code, titleKey, titleFallback, actions[] } so each surface can render
 * the right message + the right buttons.
 *
 * Pure. Never throws. SSR-safe (no direct globals — context is passed in via locationContext()).
 */
export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SECURE_CONTEXT'
  | 'BROWSER_UNSUPPORTED'
  | 'PRIVACY_RESTRICTION'
  | 'UNKNOWN';

export type LocationActionKey = 'enable' | 'retry' | 'manual' | 'zip';

export interface LocationAction { key: LocationActionKey; labelKey: string; labelFallback: string; }
export interface LocationVerdict {
  code: LocationErrorCode;
  titleKey: string;
  titleFallback: string;
  actions: ReadonlyArray<LocationAction>;
}
export interface LocationContext {
  isSecureContext: boolean;
  hasGeolocation: boolean;
  hasPermissionsApi: boolean;
  platform: string;
  browser: string;
}

const A = {
  enable: { key: 'enable' as const, labelKey: 'home.location.action.enable', labelFallback: 'Enable Location' },
  retry:  { key: 'retry'  as const, labelKey: 'home.location.action.retry',  labelFallback: 'Retry' },
  manual: { key: 'manual' as const, labelKey: 'home.location.action.manual', labelFallback: 'Enter manually' },
  zip:    { key: 'zip'    as const, labelKey: 'home.location.action.zip',    labelFallback: 'ZIP code' },
};

function verdict(code: LocationErrorCode, titleKey: string, titleFallback: string, actions: LocationAction[]): LocationVerdict {
  return Object.freeze({ code, titleKey, titleFallback, actions: Object.freeze(actions) });
}

const VERDICTS: Record<LocationErrorCode, LocationVerdict> = {
  PERMISSION_DENIED:   verdict('PERMISSION_DENIED',   'home.location.err.denied.title',     'Location permission is turned off.',          [A.enable, A.manual]),
  TIMEOUT:             verdict('TIMEOUT',             'home.location.err.timeout.title',    'Finding your location took too long.',        [A.retry, A.manual]),
  POSITION_UNAVAILABLE:verdict('POSITION_UNAVAILABLE','home.location.err.unavailable.title','We could not get a GPS fix.',                 [A.retry, A.zip]),
  NOT_SECURE_CONTEXT:  verdict('NOT_SECURE_CONTEXT',  'home.location.err.insecure.title',   'Location only works over a secure connection.',[A.manual]),
  BROWSER_UNSUPPORTED: verdict('BROWSER_UNSUPPORTED', 'home.location.err.unsupported.title','This browser cannot share your location.',     [A.manual]),
  PRIVACY_RESTRICTION: verdict('PRIVACY_RESTRICTION', 'home.location.err.privacy.title',    'Your browser privacy settings are blocking location.', [A.enable, A.manual]),
  UNKNOWN:             verdict('UNKNOWN',             'home.location.err.unknown.title',    'We could not detect your location.',          [A.retry, A.manual]),
};

/** Read the GPS_ERROR string code or a native numeric code off the rejected error. */
function _rawCode(err: any): string {
  if (!err) return '';
  if (typeof err.code === 'string') return err.code.toLowerCase();
  if (err.code === 1) return 'access_denied';
  if (err.code === 2) return 'unavailable';
  if (err.code === 3) return 'timeout';
  return '';
}

export function classifyLocationError(err: any, ctx?: Partial<LocationContext>): LocationVerdict {
  const c: LocationContext = {
    isSecureContext: ctx?.isSecureContext !== false,   // default: assume secure unless explicitly false
    hasGeolocation: ctx?.hasGeolocation !== false,
    hasPermissionsApi: !!ctx?.hasPermissionsApi,
    platform: ctx?.platform || '',
    browser: ctx?.browser || '',
  };

  // Context precedence FIRST — a browser on an insecure origin often reports code 1
  // ("denied") even though the real cause is the missing secure context. Don't tell the
  // farmer to flip a permission that wouldn't help.
  if (!c.isSecureContext) return VERDICTS.NOT_SECURE_CONTEXT;
  if (!c.hasGeolocation) return VERDICTS.BROWSER_UNSUPPORTED;

  const raw = _rawCode(err);
  const msg = String((err && err.message) || '').toLowerCase();

  if (raw === 'access_denied' || raw === 'permission_denied') {
    // A "denied" with the permission state never moving to a real prompt, or a policy/
    // feature-policy message, indicates a privacy/policy block rather than a user decision.
    if (/policy|feature|disabled|insecure|secure origin/.test(msg)) return VERDICTS.PRIVACY_RESTRICTION;
    return VERDICTS.PERMISSION_DENIED;
  }
  if (raw === 'unavailable' || raw === 'position_unavailable') return VERDICTS.POSITION_UNAVAILABLE;
  if (raw === 'timeout') return VERDICTS.TIMEOUT;
  if (raw === 'unsupported') return VERDICTS.BROWSER_UNSUPPORTED;
  return VERDICTS.UNKNOWN;
}

/** Gather environment context at the call site (browser). SSR-safe. */
export function locationContext(): LocationContext {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  const nav: any = g.navigator || {};
  const ua = String(nav.userAgent || '');
  let browser = 'other';
  if (/edg\//i.test(ua)) browser = 'edge';
  else if (/chrome|crios/i.test(ua)) browser = 'chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'firefox';
  else if (/safari/i.test(ua)) browser = 'safari';
  let platform = 'other';
  if (/android/i.test(ua)) platform = 'android';
  else if (/iphone|ipad|ipod/i.test(ua)) platform = 'ios';
  else if (/windows|mac|linux/i.test(ua)) platform = 'desktop';
  return {
    isSecureContext: g.isSecureContext !== false && (g.location ? g.location.protocol !== 'http:' || g.location.hostname === 'localhost' : true),
    hasGeolocation: !!(nav && nav.geolocation),
    hasPermissionsApi: !!(nav && nav.permissions && typeof nav.permissions.query === 'function'),
    platform,
    browser,
  };
}

// ─── Client-side last-attempt trace (redaction-safe) ───────────────────────────
// Mirrors the scan last-trace pattern, but location is client-side: we keep the most
// recent attempt on a window global for in-field diagnostics. Coordinates are rounded to
// ~1km (3 dp) — never the precise position; no PII.
export interface LocationAttempt {
  at: string;
  outcome: 'success' | 'error';
  code?: LocationErrorCode | null;
  permission?: string | null;
  isSecureContext?: boolean;
  hasGeolocation?: boolean;
  browser?: string;
  platform?: string;
  latencyMs?: number | null;
  accuracyM?: number | null;
  coarseLat?: number | null;
  coarseLng?: number | null;
  errorMessage?: string | null;
}

const _round3 = (n: any) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
const _int = (n: any) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

export function recordLocationAttempt(a: Partial<LocationAttempt>, nowIso: string): LocationAttempt {
  const rec: LocationAttempt = Object.freeze({
    at: String(nowIso || ''),
    outcome: a.outcome === 'success' ? 'success' : 'error',
    code: a.code || null,
    permission: a.permission != null ? String(a.permission) : null,
    isSecureContext: !!a.isSecureContext,
    hasGeolocation: !!a.hasGeolocation,
    browser: a.browser || '',
    platform: a.platform || '',
    latencyMs: _int(a.latencyMs),
    accuracyM: _int(a.accuracyM),
    coarseLat: _round3(a.coarseLat),   // ~1km — never the precise position
    coarseLng: _round3(a.coarseLng),
    errorMessage: a.errorMessage != null ? String(a.errorMessage).slice(0, 200) : null,
  });
  try {
    const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
    g.__locationLastAttempt = rec;
  } catch { /* ignore */ }
  return rec;
}

export function getLastLocationAttempt(): LocationAttempt | null {
  try {
    const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
    return g.__locationLastAttempt || null;
  } catch { return null; }
}
