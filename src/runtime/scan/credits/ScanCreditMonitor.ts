/**
 * ScanCreditMonitor.ts — P0 CREDIT MONITORING (client).
 *
 * Mirrors the server credit monitor (GET /api/admin/scan-credits, which reads
 * Kindwise usage_info) into a client health global. It does NOT invent credit
 * numbers — when a provider isn't keyed or the endpoint is unavailable, the
 * value is null and the alert is 'unknown'. Honest by construction.
 *
 * Tracks per provider: credits, dailyBurnRate, estimatedDaysRemaining; raises
 * alerts at <100 / <50 / <20. Pins window.__scanCreditHealth().
 */
const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const CREDIT_THRESHOLDS = Object.freeze({ low: 100, warn: 50, critical: 20 });
export type CreditAlert = 'ok' | 'low' | 'warn' | 'critical' | 'unknown';

export function alertLevel(credits: number | null): CreditAlert {
  if (credits == null) return 'unknown';
  if (credits < CREDIT_THRESHOLDS.critical) return 'critical';
  if (credits < CREDIT_THRESHOLDS.warn) return 'warn';
  if (credits < CREDIT_THRESHOLDS.low) return 'low';
  return 'ok';
}

export interface ProviderCredit {
  provider: string;
  credits: number | null;
  dailyBurnRate: number | null;
  estimatedDaysRemaining: number | null;
  alert: CreditAlert;
}

export interface ScanCreditHealth {
  ok: boolean;
  plantIdCredits: number | null;
  cropHealthCredits: number | null;
  insectIdCredits: number | null;
  dailyBurnRate: number | null;
  estimatedDaysRemaining: number | null;
  worstAlert: CreditAlert;
  providers: ReadonlyArray<ProviderCredit>;
  checkedAt: number | null;
}

let _last: any = null;

function _mapProvider(p: any): ProviderCredit {
  const credits = _num(p && (p.credits ?? p.remaining ?? p.creditsRemaining));
  const burn = _num(p && (p.dailyBurnRate ?? p.burnRate ?? p.burn));
  const days = _num(p && (p.estimatedDaysRemaining ?? p.daysRemaining));
  return Object.freeze({
    provider: String((p && p.provider) || 'unknown'),
    credits, dailyBurnRate: burn,
    estimatedDaysRemaining: days != null ? days : (credits != null && burn ? Math.floor(credits / burn) : null),
    alert: alertLevel(credits),
  });
}

const _WORST_ORDER: CreditAlert[] = ['ok', 'low', 'warn', 'critical', 'unknown'];

export function computeCreditHealth(raw: any): ScanCreditHealth {
  return _safe(() => {
    const providers = Array.isArray(raw && raw.providers) ? raw.providers.map(_mapProvider) : [];
    const byName = (re: RegExp) => providers.find((p) => re.test(p.provider.toLowerCase())) || null;
    const plant = byName(/plant/);
    const crop = byName(/crop|health/);
    const insect = byName(/insect/);
    const burns = providers.map((p) => p.dailyBurnRate).filter((b): b is number => typeof b === 'number');
    const dailyBurnRate = burns.length ? Math.round(burns.reduce((a, b) => a + b, 0)) : null;
    const daysVals = providers.map((p) => p.estimatedDaysRemaining).filter((d): d is number => typeof d === 'number');
    const estimatedDaysRemaining = daysVals.length ? Math.min(...daysVals) : null;
    let worst: CreditAlert = 'ok';
    for (const p of providers) if (_WORST_ORDER.indexOf(p.alert) > _WORST_ORDER.indexOf(worst)) worst = p.alert;
    if (providers.length === 0) worst = 'unknown';
    return Object.freeze({
      ok: true,
      plantIdCredits: plant ? plant.credits : null,
      cropHealthCredits: crop ? crop.credits : null,
      insectIdCredits: insect ? insect.credits : null,
      dailyBurnRate, estimatedDaysRemaining, worstAlert: worst,
      providers: Object.freeze(providers),
      checkedAt: _safe(() => Date.now(), null),
    });
  }, Object.freeze({
    ok: false, plantIdCredits: null, cropHealthCredits: null, insectIdCredits: null,
    dailyBurnRate: null, estimatedDaysRemaining: null, worstAlert: 'unknown' as CreditAlert,
    providers: Object.freeze([]), checkedAt: null,
  }));
}

export async function refreshScanCredits(): Promise<ScanCreditHealth> {
  await _safe(async () => {
    if (typeof fetch !== 'function') return;
    const tok = _safe(() => (typeof localStorage !== 'undefined'
      ? localStorage.getItem('farroway_token') : null), null);
    const res = await fetch('/api/admin/scan-credits', {
      method: 'GET', credentials: 'include',
      headers: tok ? { Authorization: 'Bearer ' + tok } : {},
    });
    if (res && res.ok) _last = await res.json();
  }, undefined);
  return computeCreditHealth(_last);
}

export function scanCreditHealth(): ScanCreditHealth {
  return computeCreditHealth(_last);
}

export function installScanCreditHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__scanCreditHealth) return;
    Object.defineProperty(window, '__scanCreditHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => scanCreditHealth(),
    });
  }, undefined);
}
