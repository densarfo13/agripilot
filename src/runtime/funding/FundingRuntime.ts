/**
 * src/runtime/funding/FundingRuntime.ts — Funding subsystem readiness
 * (read-only, composition-only). Operational foundation — NOT AI.
 *
 *   window.__fundingHealth()
 *
 * Tracks grant opportunities, applications, awards, and farmer funding
 * history from REAL on-device stores + the canonical event log
 * (FundingApplied / GrantApproved). Honest: NEEDS_DATA until funding
 * activity exists; never fabricates awards. Pure, SSR-safe, frozen,
 * never throws.
 */

export const FUNDING_RUNTIME_VERSION = 'funding-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _eventType = (e: any): string => _str(e && (e.type || e.eventType || e.name || e.kind));

export function fundingHealth() {
  return _safe(() => {
    const events = _arr(_ls('farroway_event_log'));
    const opportunities = _arr(_ls('farroway_funding_opportunities') || _ls('farroway_grant_opportunities'));
    const applications  = _arr(_ls('farroway_funding_applications'));
    const history       = _arr(_ls('farroway_funding_history'));

    let applied = 0, approved = 0, awarded = 0;
    for (const e of events) {
      const t = _eventType(e);
      if (t === 'FundingApplied') applied++;
      else if (t === 'GrantApproved') approved++;
      else if (t === 'GrantAwarded' || t === 'FundingAwarded') awarded++;
    }
    applied += applications.length;
    awarded += history.length;

    const opportunitiesCount = opportunities.length;
    const hasData = opportunitiesCount > 0 || applied > 0 || approved > 0 || awarded > 0;

    return Object.freeze({
      runtimeVersion: FUNDING_RUNTIME_VERSION,
      initialized: true,
      // Operational readiness — the funding surface is wired (the route +
      // opportunity browsing exist); metrics are honest about real activity.
      opportunitiesReady: true,
      applicationsReady:  true,
      awardsReady:        true,
      fundingHistoryReady: true,
      value: hasData
        ? Object.freeze({
            grantOpportunities: opportunitiesCount,
            applications: applied,
            approved,
            awards: awarded,
          })
        : 'NEEDS_DATA',
      confidence: (hasData ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      dataSources: Object.freeze([
        'farroway_event_log', 'farroway_funding_opportunities',
        'farroway_funding_applications', 'farroway_funding_history',
      ]),
      limitations: hasData
        ? 'On-device funding activity only — server-side grant records may differ. Decision support, not a guarantee.'
        : 'Not enough data yet — no funding activity recorded on this device.',
    });
  }, Object.freeze({
    runtimeVersion: FUNDING_RUNTIME_VERSION, initialized: false,
    opportunitiesReady: false, applicationsReady: false, awardsReady: false,
    fundingHistoryReady: false, value: 'NEEDS_DATA', confidence: 'low' as const,
    dataSources: Object.freeze(['farroway_event_log']),
    limitations: 'Not enough data yet.',
  }));
}

export function installFundingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fundingHealth !== 'function') {
      w.__fundingHealth = function () {
        const out = fundingHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Funding]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
