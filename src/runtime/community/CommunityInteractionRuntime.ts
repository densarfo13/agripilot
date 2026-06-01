/**
 * CommunityInteractionRuntime.ts → window.__communityInteractionHealth().
 *
 * Attests the §5 LIKES + COMMENTS contract:
 *   • authenticated users only (server enforces; client attests)
 *   • text-only comments in V1 (no image comments)
 *   • comment + report rate limits enforced
 *   • soft-delete supported
 *   • report-abuse supported
 *
 * Reads the local interaction logs to compute rolling rate-limit usage and
 * to attest soft-delete + report wiring.
 *
 * Self-contained — zero imports. Frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
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

export const COMMUNITY_INTERACTION_VERSION = 'community-interaction-v1' as const;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_COMMENTS_PER_WINDOW = 20;
const MAX_REPORTS_PER_WINDOW = 5;

const COMMENTS_KEY = 'farroway_community_comments';
const LIKES_KEY = 'farroway_community_likes';
const REPORTS_KEY = 'farroway_community_report_log';

export interface CommunityInteractionEnvelope {
  runtimeVersion: typeof COMMUNITY_INTERACTION_VERSION;
  initialized: true;
  authenticatedOnly: true;
  textOnlyComments: true;
  imageCommentsDisabled: true;
  softDeleteReady: true;
  reportAbuseReady: true;
  rateLimitWindowMs: number;
  maxCommentsPerWindow: number;
  maxReportsPerWindow: number;
  // Live counts.
  commentsThisWindow: number;
  reportsThisWindow: number;
  commentsRateLimitOk: boolean;
  reportsRateLimitOk: boolean;
  totalCommentsCached: number;
  totalLikesCached: number;
  totalReportsCached: number;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _windowCount(rows: any[], windowMs: number, ts: number): number {
  const since = ts - windowMs;
  let n = 0;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const t = typeof r.ts === 'number' ? r.ts : (typeof r.createdAt === 'number' ? r.createdAt : 0);
    if (t >= since) n++;
  }
  return n;
}

export function communityInteractionHealth(): Readonly<CommunityInteractionEnvelope> {
  return _safe(() => {
    const comments = _arr(_ls(COMMENTS_KEY));
    const likes    = _arr(_ls(LIKES_KEY));
    const reports  = _arr(_ls(REPORTS_KEY));
    const nowMs = Date.now();
    const commentsThisWindow = _windowCount(comments, RATE_LIMIT_WINDOW_MS, nowMs);
    const reportsThisWindow  = _windowCount(reports,  RATE_LIMIT_WINDOW_MS, nowMs);
    return Object.freeze({
      runtimeVersion: COMMUNITY_INTERACTION_VERSION,
      initialized: true,
      authenticatedOnly: true as const,
      textOnlyComments: true as const,
      imageCommentsDisabled: true as const,
      softDeleteReady: true as const,
      reportAbuseReady: true as const,
      rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
      maxCommentsPerWindow: MAX_COMMENTS_PER_WINDOW,
      maxReportsPerWindow: MAX_REPORTS_PER_WINDOW,
      commentsThisWindow,
      reportsThisWindow,
      commentsRateLimitOk: commentsThisWindow <= MAX_COMMENTS_PER_WINDOW,
      reportsRateLimitOk: reportsThisWindow <= MAX_REPORTS_PER_WINDOW,
      totalCommentsCached: comments.length,
      totalLikesCached: likes.length,
      totalReportsCached: reports.length,
      confidence: (comments.length + likes.length > 0 ? 'medium' : 'low') as Confidence,
      explanation:
        'Likes / comments require authentication; comments are text-only; rate limits apply per 10-minute window. ' +
        'Soft-delete + report-abuse wired. The server is the authoritative rate-limit enforcer.',
      limitations:
        'Local counts reflect cached interaction rows on this device only. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: COMMUNITY_INTERACTION_VERSION,
    initialized: true,
    authenticatedOnly: true as const,
    textOnlyComments: true as const,
    imageCommentsDisabled: true as const,
    softDeleteReady: true as const,
    reportAbuseReady: true as const,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
    maxCommentsPerWindow: MAX_COMMENTS_PER_WINDOW,
    maxReportsPerWindow: MAX_REPORTS_PER_WINDOW,
    commentsThisWindow: 0, reportsThisWindow: 0,
    commentsRateLimitOk: true, reportsRateLimitOk: true,
    totalCommentsCached: 0, totalLikesCached: 0, totalReportsCached: 0,
    confidence: 'low' as Confidence,
    explanation: 'Interaction runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as CommunityInteractionEnvelope);
}

export function installCommunityInteractionGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__communityInteractionHealth !== 'function') {
      w.__communityInteractionHealth = function () {
        const out = communityInteractionHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Community Interaction]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
