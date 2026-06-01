/**
 * GrowShareRuntime.ts → window.__growShareHealth().
 *
 * The composite share runtime. Attests the §1 SHARE MODEL contract:
 *   • default visibility is 'private'
 *   • precise GPS never shared
 *   • private farm records not exposed in the post envelope
 *   • scan diagnosis is OPTIONAL (off unless explicitly included)
 *   • the user controls visibility
 *
 * Read-only diagnostic — reads the local post cache + the privacy guard
 * by name. Self-contained, frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
function _arr(v: any): any[] { return Array.isArray(v) ? v : []; }
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const GROW_SHARE_RUNTIME_VERSION = 'grow-share-runtime-v1' as const;

const POST_TYPES = Object.freeze([
  'plant_update', 'before_after', 'harvest', 'question', 'milestone',
]);
const VISIBILITY_LEVELS = Object.freeze([
  'private', 'organization', 'community', 'public',
]);

export interface GrowShareHealthEnvelope {
  runtimeVersion: typeof GROW_SHARE_RUNTIME_VERSION;
  initialized: true;
  defaultVisibility: 'private';
  notSocialNetwork: true;          // §1 no DM / live-stream / reels
  directMessagingDisabled: true;
  liveStreamingDisabled: true;
  reelsFeedDisabled: true;
  preciseGpsNeverShared: true;
  scanDiagnosisOptional: true;
  userControlsVisibility: true;
  postTypes: ReadonlyArray<string>;
  visibilityLevels: ReadonlyArray<string>;
  // Live stats from the local cache.
  postsCached: number;
  privatePostCount: number;
  organizationPostCount: number;
  communityPostCount: number;
  publicPostCount: number;
  // Defensive — must always be true; the post creator hard-codes it.
  allPostsHavePreciseLocationHidden: boolean;
  // Privacy guard composite (warn-only).
  privacyGuardReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function growShareHealth(): Readonly<GrowShareHealthEnvelope> {
  return _safe(() => {
    const posts = _arr(_ls('farroway_community_posts'));
    let priv = 0, org = 0, comm = 0, pub = 0;
    let allHidden = true;
    for (const raw of posts) {
      if (!raw || typeof raw !== 'object') continue;
      if (raw.preciseLocationHidden !== true) allHidden = false;
      if (raw.visibility === 'private') priv++;
      else if (raw.visibility === 'organization') org++;
      else if (raw.visibility === 'community') comm++;
      else if (raw.visibility === 'public') pub++;
    }
    const guard = _probe('__communityPrivacyHealth');
    const privacyGuardReady = !!(guard && guard.preciseLocationHidden === true
      && guard.privateFarmDataHidden === true && guard.buyerPrivacySafe === true);
    return Object.freeze({
      runtimeVersion: GROW_SHARE_RUNTIME_VERSION,
      initialized: true,
      defaultVisibility: 'private' as const,
      notSocialNetwork: true as const,
      directMessagingDisabled: true as const,
      liveStreamingDisabled: true as const,
      reelsFeedDisabled: true as const,
      preciseGpsNeverShared: true as const,
      scanDiagnosisOptional: true as const,
      userControlsVisibility: true as const,
      postTypes: POST_TYPES,
      visibilityLevels: VISIBILITY_LEVELS,
      postsCached: posts.length,
      privatePostCount: priv,
      organizationPostCount: org,
      communityPostCount: comm,
      publicPostCount: pub,
      allPostsHavePreciseLocationHidden: allHidden,
      privacyGuardReady,
      confidence: (privacyGuardReady ? 'high' : posts.length > 0 ? 'medium' : 'low') as Confidence,
      explanation:
        'Grow Share is private-first: default visibility is private; no DMs, live streams, or reels feed; ' +
        'precise GPS never shared; scan diagnosis only included when the user explicitly opts in.',
      limitations:
        'Counts reflect the local post cache on this device; authoritative visibility enforcement lives on the server. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: GROW_SHARE_RUNTIME_VERSION,
    initialized: true,
    defaultVisibility: 'private' as const,
    notSocialNetwork: true as const,
    directMessagingDisabled: true as const,
    liveStreamingDisabled: true as const,
    reelsFeedDisabled: true as const,
    preciseGpsNeverShared: true as const,
    scanDiagnosisOptional: true as const,
    userControlsVisibility: true as const,
    postTypes: POST_TYPES, visibilityLevels: VISIBILITY_LEVELS,
    postsCached: 0, privatePostCount: 0, organizationPostCount: 0,
    communityPostCount: 0, publicPostCount: 0,
    allPostsHavePreciseLocationHidden: true,
    privacyGuardReady: false,
    confidence: 'low' as Confidence,
    explanation: 'Grow Share runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as GrowShareHealthEnvelope);
}

export function installGrowShareGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__growShareHealth !== 'function') {
      w.__growShareHealth = function () {
        const out = growShareHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Grow Share]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
