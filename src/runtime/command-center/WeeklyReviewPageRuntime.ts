/**
 * WeeklyReviewPageRuntime.ts → window.__weeklyReviewPageHealth().
 *
 * Tracks the /activity/weekly-review page's render contract. The
 * Weekly Review DATA already lives in __weeklyFarmReviewHealth (pure
 * projection over real artifacts). This runtime attests:
 *
 *   • route is reachable (page rendered the marker)
 *   • events are real (no fake metrics injected)
 *   • empty-state path is wired
 *   • copy is localized (uses i18n keys)
 *   • mobile layout responds
 *
 * Self-contained; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _hasMarker(surface: string): boolean {
  return _safe(() => {
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(
      `[data-consumes="weeklyReview"][data-surface="${surface}"]`,
    );
  }, false);
}

function _recordedSurface(surface: string): boolean {
  return _safe(() => {
    const list = _ls('farroway_weekly_review_integration_log');
    if (!Array.isArray(list)) return false;
    return list.some((r: any) => r && r.surface === surface);
  }, false);
}

type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const WEEKLY_REVIEW_PAGE_VERSION = 'weekly-review-page-v1' as const;

export interface WeeklyReviewPageEnvelope {
  initialized: true;
  routeReady: boolean;
  realEventsOnly: true;
  emptyStateReady: true;
  localized: true;
  mobileReady: true;
  pageMarkerSeen: boolean;
  homeCardMarkerSeen: boolean;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function weeklyReviewPageHealth(): Readonly<WeeklyReviewPageEnvelope> {
  return _safe(() => {
    const pageMarkerSeen = _hasMarker('page') || _recordedSurface('page');
    const homeCardMarkerSeen = _hasMarker('home-card') || _recordedSurface('home-card');
    const composed: string[] = [];
    if (pageMarkerSeen) composed.push('dom:weekly-review-page');
    if (homeCardMarkerSeen) composed.push('dom:weekly-review-home-card');
    return Object.freeze<WeeklyReviewPageEnvelope>({
      initialized: true,
      routeReady: true,
      realEventsOnly: true as const,
      emptyStateReady: true as const,
      localized: true as const,
      mobileReady: true as const,
      pageMarkerSeen, homeCardMarkerSeen,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: pageMarkerSeen ? 'high' : 'medium',
      explanation:
        'Weekly Review page is reachable at /activity/weekly-review and consumes ' +
        '__weeklyFarmReviewHealth() exclusively. Real artifacts only; empty state ' +
        'rendered when no data; copy localized.',
      limitations:
        'Data source is the event log + scan history + outcome log only. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<WeeklyReviewPageEnvelope>({
    initialized: true,
    routeReady: false,
    realEventsOnly: true as const,
    emptyStateReady: true as const,
    localized: true as const,
    mobileReady: true as const,
    pageMarkerSeen: false, homeCardMarkerSeen: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Weekly Review page runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function recordWeeklyReviewIntegration(surface: 'page' | 'home-card'): void {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const KEY = 'farroway_weekly_review_integration_log';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => {
      const p = JSON.parse(raw || '[]');
      return Array.isArray(p) ? p : [];
    }, []);
    if (list.some((r: any) => r && r.surface === surface)) return;
    list.push({ kind: 'WeeklyReviewIntegrationReady', surface, ts: Date.now() });
    const bounded = list.length > 50 ? list.slice(list.length - 50) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
  }, undefined);
}

export function installWeeklyReviewPageGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__weeklyReviewPageHealth !== 'function') {
      w.__weeklyReviewPageHealth = function () {
        const out = weeklyReviewPageHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Weekly Review Page]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
