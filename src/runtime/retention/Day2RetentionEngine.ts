/**
 * Day2RetentionEngine.ts — sprint #217.
 *
 * The Day-2 hook: ~24h after activation, surface ONE "Today's Farm
 * Brief" (Farm Health · Top Risk · Today's Action) with a single CTA,
 * and track whether the farmer opened / dismissed / completed it.
 *
 * Read-only composition + a small engagement store (localStorage).
 * The brief composes signals the app already holds; it never
 * fabricates a risk or an action. Pins window.__day2RetentionHealth().
 */

export const DAY2_RETENTION_VERSION = 'day2-retention-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

const STORE_KEY = 'farroway:day2Engagement';
export const DAY2_TRIGGER_HOURS = 24;
export type Day2Action = 'opened' | 'dismissed' | 'completed';

/** Is the Day-2 brief due? (activation time + asOf supplied by caller). */
export function isDay2Due(activationISO: string, asOfISO?: string): boolean {
  return _safe(() => {
    const a = new Date(_str(activationISO)).getTime();
    const now = new Date(_str(asOfISO) || new Date().toISOString()).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(now)) return false;
    const hrs = (now - a) / 3600000;
    return hrs >= DAY2_TRIGGER_HOURS && hrs < DAY2_TRIGGER_HOURS + 48; // ~day-2 window
  }, false);
}

/** Compose the Day-2 brief — Health · Top Risk · Today's Action + 1 CTA. */
export function buildDay2Brief(input: {
  farmHealthScore?: number | null;
  farmHealthBand?: string;
  topRisk?: string;
  todayActionKey?: string;
  todayAction?: string;
  confidence?: number | null;
} = {}): Readonly<{
  runtimeVersion: string;
  titleKey: string;
  farmHealthScore: number | null;
  farmHealthBand: string | null;
  topRisk: string | null;
  actionKey: string;
  action: string;
  confidence: number | null;
  ctaRoute: string;
  hasContent: boolean;
}> {
  return _safe(() => {
    const action = _str(input.todayAction);
    const actionKey = _str(input.todayActionKey) || 'farmBrain.next.firstScan.title';
    const topRisk = _str(input.topRisk) || null;
    const band = _str(input.farmHealthBand) || null;
    const score = _num(input.farmHealthScore);
    return Object.freeze({
      runtimeVersion: DAY2_RETENTION_VERSION,
      titleKey: 'day2.farmBrief.title',
      farmHealthScore: score,
      farmHealthBand: band,
      topRisk,
      actionKey,
      action: action || 'Scan a plant to begin',
      confidence: _num(input.confidence),
      ctaRoute: action ? '/tasks' : '/scan',
      hasContent: !!(action || topRisk || score != null),
    });
  }, Object.freeze({
    runtimeVersion: DAY2_RETENTION_VERSION,
    titleKey: 'day2.farmBrief.title',
    farmHealthScore: null, farmHealthBand: null, topRisk: null,
    actionKey: 'farmBrain.next.firstScan.title', action: 'Scan a plant to begin',
    confidence: null, ctaRoute: '/scan', hasContent: false,
  }));
}

/** Record engagement with the Day-2 brief. */
export function trackDay2(action: Day2Action): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(STORE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    const next = (o && typeof o === 'object') ? o : {};
    next[action] = (typeof next[action] === 'number' ? next[action] : 0) + 1;
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    return true;
  }, false);
}
export function readDay2Engagement(): Readonly<{ opened: number; dismissed: number; completed: number }> {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return Object.freeze({ opened: 0, dismissed: 0, completed: 0 });
    const raw = localStorage.getItem(STORE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return Object.freeze({
      opened: _num(o.opened) || 0, dismissed: _num(o.dismissed) || 0, completed: _num(o.completed) || 0,
    });
  }, Object.freeze({ opened: 0, dismissed: 0, completed: 0 }));
}

export function buildDay2RetentionHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  day2RetentionReady: true; oneCTA: true; triggerHours: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: DAY2_RETENTION_VERSION,
    day2RetentionReady: true as const, oneCTA: true as const,
    triggerHours: DAY2_TRIGGER_HOURS,
  });
}

let _installed = false;
export function installDay2RetentionHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__day2RetentionHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildDay2RetentionHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  isDay2Due, buildDay2Brief, trackDay2, readDay2Engagement,
  buildDay2RetentionHealth, installDay2RetentionHealthGlobal,
});
export default buildDay2Brief;
