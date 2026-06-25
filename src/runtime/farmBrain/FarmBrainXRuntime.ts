/**
 * FarmBrainXRuntime.ts — FarmBrain X certification composite.
 *
 * The mission's claim — "FarmBrain is the single source of truth; no screen owns
 * intelligence" — is made ATTESTABLE here. This runtime enumerates the 15
 * FarmBrain X sections, maps each to the runtime + live health global that backs
 * it, records an HONEST status, and COMPUTES the pilot verdict from those
 * statuses (it is never hardcoded).
 *
 * Honest by construction (and §12 of the spec): sections with no live data feed
 * (market, funding, yield $, buyer, livestock, satellite) are 'honest_null', not
 * 'ready' — we never certify an engine we cannot truthfully run. Pure, total,
 * never throws. Pins window.__farmBrainXHealth().
 */
export const FARMBRAIN_X_VERSION = 'farmbrain-x-v1';

export type SectionStatus = 'ready' | 'partial' | 'honest_null' | 'missing';
export type FarmBrainXVerdict =
  | 'NOT_READY' | 'LIMITED_PILOT' | 'READY_FOR_100_FARMERS' | 'READY_FOR_SCALE';

export interface SectionCert {
  n: number;
  name: string;
  status: SectionStatus;
  backedBy: ReadonlyArray<string>;   // runtimes / health globals
  note: string;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/**
 * The honest current state of the 15 sections. `status` reflects what truthfully
 * exists today; the verdict is derived from it. Edit these as reality changes —
 * the verdict follows automatically.
 */
export const FARMBRAIN_X_SECTIONS: ReadonlyArray<SectionCert> = Object.freeze([
  { n: 1, name: 'Agricultural Digital Twin', status: 'ready',
    backedBy: ['FarmDigitalTwinRuntime', 'FarmBrainState', '__farmBrainStateHealth'],
    note: 'Canonical per-farm state; livestock is future (honest gap, not faked).' },
  { n: 2, name: 'Universal Scan Engine', status: 'partial',
    backedBy: ['AgriculturalObjectClassifier', 'ScanTypeRouter', '__agriClassifierHealth'],
    note: 'leaf/plant/flower/fruit/veg/tree/seedling/insect/soil classified; weed/disease/irrigation-equipment not yet a class.' },
  { n: 3, name: 'Multi-Provider Consensus', status: 'partial',
    backedBy: ['ScanAcceptanceGate', '__scanAcceptanceHealth'],
    note: 'Only Plant.id is keyed; Crop.health + Insect.id report not-ready until keyed. No fake consensus.' },
  { n: 4, name: 'Recommendation Engine', status: 'ready',
    backedBy: ['FarmBrainState.Recommendation', 'FarmBrainStateEngine'],
    note: 'priority/reason/benefit/time/confidence + cost/risk/nextReviewDate (honest bands).' },
  { n: 5, name: 'Agricultural Memory', status: 'ready',
    backedBy: ['FarmScanMemory', 'OutcomeEngine', 'FarmTimeline', '__memoryHealth'],
    note: 'Scans, treatments, harvests, outcomes remembered; feeds recommendations.' },
  { n: 6, name: 'Season Engine', status: 'ready',
    backedBy: ['cropLifecycleEngine', 'SeasonContext', 'cropSeasonality'],
    note: 'Crop calendar + planting/fertilizer/harvest windows. Market/funding windows are honest_null.' },
  { n: 7, name: 'Market Engine', status: 'honest_null',
    backedBy: ['FarmBrainState.marketReadiness'],
    note: 'No live price/buyer feed — returns no_live_feed. §12 forbids inventing market price.' },
  { n: 8, name: 'Funding Engine', status: 'honest_null',
    backedBy: ['FarmBrainState.fundingEligibility'],
    note: 'No live grants/government feed — returns no_live_feed. §12 forbids inventing funding.' },
  { n: 9, name: 'Weather Engine', status: 'ready',
    backedBy: ['useLiveWeather', 'WeatherDecisionCard'],
    note: 'Forecast combined with crop stage + impact explanation (never weather alone).' },
  { n: 10, name: 'Farm Health Score', status: 'ready',
    backedBy: ['FarmHealthScoreEngine', 'FarmBrainState.farmHealth'],
    note: '0–100 + 5-band + trend + explanation.' },
  { n: 11, name: 'Offline-First', status: 'ready',
    backedBy: ['OFFLINE_SHELL_V1', 'farmSync', '__offlineShellHealth'],
    note: 'Scans/tasks/photos queue offline and auto-sync.' },
  { n: 12, name: 'Trust & Safety', status: 'ready',
    backedBy: ['ScanTrustGate', 'FarmBrainScanIngestion', '__farmBrainIngestionHealth'],
    note: 'Never invents disease/yield/treatment/funding/buyer/price; weak scans held for review.' },
  { n: 13, name: 'Performance', status: 'partial',
    backedBy: ['check:performance-budget', 'check:bundle-budget'],
    note: 'Budgets enforced in CI; live <1s home / <4s scan / <500ms rec not measured from here.' },
  { n: 14, name: 'Observability', status: 'ready',
    backedBy: ['SCAN_OBSERVABILITY_V1', 'SCAN_ANALYTICS_V1', 'ScanCreditMonitor', '__scanCreditHealth'],
    note: 'Scan success/latency/credits/outcomes tracked.' },
  { n: 15, name: 'Pilot Acceptance', status: 'partial',
    backedBy: ['run-scan-acceptance.mjs', 'AgriClassifier.test'],
    note: 'Routing acceptance green (34 assertions); live 30-scan + farmer-satisfaction run PENDING (needs keys + photos).' },
]);

/**
 * Compute the verdict from section statuses. Deterministic, not hardcoded.
 *   NOT_READY            — any CORE section missing.
 *   LIMITED_PILOT        — core ready, but providers partial / market+funding
 *                          honest_null / live validation pending.
 *   READY_FOR_100_FARMERS— consensus + pilot acceptance ready.
 *   READY_FOR_SCALE      — also market + funding live (no honest_null gates).
 */
export function certifyFarmBrainX(
  sections: ReadonlyArray<SectionCert> = FARMBRAIN_X_SECTIONS,
): { verdict: FarmBrainXVerdict; reasons: ReadonlyArray<string>; counts: Record<SectionStatus, number> } {
  return _safe(() => {
    const byName = (n: string) => sections.find((s) => s.name === n) || null;
    const st = (n: string): SectionStatus => (byName(n) ? byName(n)!.status : 'missing');
    const counts: Record<SectionStatus, number> = { ready: 0, partial: 0, honest_null: 0, missing: 0 };
    for (const s of sections) counts[s.status] = (counts[s.status] || 0) + 1;

    const CORE = ['Agricultural Digital Twin', 'Universal Scan Engine', 'Recommendation Engine',
      'Agricultural Memory', 'Trust & Safety', 'Farm Health Score', 'Offline-First'];
    const reasons: string[] = [];

    const coreMissing = CORE.filter((c) => st(c) === 'missing');
    if (coreMissing.length) {
      return { verdict: 'NOT_READY' as FarmBrainXVerdict,
        reasons: Object.freeze(['core section missing: ' + coreMissing.join(', ')]), counts };
    }

    const consensusReady = st('Multi-Provider Consensus') === 'ready';
    const pilotReady = st('Pilot Acceptance') === 'ready';
    const marketLive = st('Market Engine') === 'ready';
    const fundingLive = st('Funding Engine') === 'ready';

    if (!consensusReady) reasons.push('multi-provider consensus partial (only Plant.id keyed)');
    if (!pilotReady) reasons.push('live 30-scan pilot acceptance pending');
    if (!marketLive) reasons.push('market engine has no live feed (honest_null)');
    if (!fundingLive) reasons.push('funding engine has no live feed (honest_null)');

    let verdict: FarmBrainXVerdict;
    if (consensusReady && pilotReady && marketLive && fundingLive) verdict = 'READY_FOR_SCALE';
    else if (consensusReady && pilotReady) verdict = 'READY_FOR_100_FARMERS';
    else verdict = 'LIMITED_PILOT';

    return { verdict, reasons: Object.freeze(reasons), counts };
  }, { verdict: 'NOT_READY' as FarmBrainXVerdict, reasons: Object.freeze(['certify_error']),
       counts: { ready: 0, partial: 0, honest_null: 0, missing: 0 } });
}

/** Probe which backing health globals are actually installed (best-effort). */
function _installedGlobals(): ReadonlyArray<string> {
  return _safe(() => {
    if (typeof window === 'undefined') return Object.freeze([]);
    const want = ['__farmBrainStateHealth', '__agriClassifierHealth', '__scanAcceptanceHealth',
      '__farmBrainIngestionHealth', '__scanCreditHealth', '__farmTimelineHealth', '__memoryHealth'];
    return Object.freeze(want.filter((g) => typeof (window as any)[g] === 'function'));
  }, Object.freeze([]));
}

export function farmBrainXHealth() {
  const cert = certifyFarmBrainX();
  return Object.freeze({
    ok: true,
    version: FARMBRAIN_X_VERSION,
    singleSourceOfTruth: true,       // every event flows through FarmBrainState
    sections: FARMBRAIN_X_SECTIONS,
    counts: cert.counts,
    verdict: cert.verdict,
    blockers: cert.reasons,
    installedGlobals: _installedGlobals(),
  });
}

export function installFarmBrainXHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__farmBrainXHealth) return;
    Object.defineProperty(window, '__farmBrainXHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => farmBrainXHealth(),
    });
  }, undefined);
}
