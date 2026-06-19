/**
 * FarmScanMemory.ts — sprint #208, spec §5.
 *
 * Read-only view over a farm's scan history. Summarises the last
 * scans, the issues seen, the outcomes recorded, and any pending
 * follow-ups, and offers a small, HONEST confidence hint: a disease
 * the same farm has already confirmed is more likely on a repeat
 * scan. The hint is a bounded, explainable nudge — never a fabricated
 * certainty, and null when there is no history.
 *
 * Pure. SSR-safe. Never throws. Frozen returns.
 */

export const FARM_SCAN_MEMORY_VERSION = 'farm-scan-memory-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export interface FarmScanMemoryView {
  runtimeVersion:   string;
  lastScans:        ReadonlyArray<Readonly<{ plant: string; issue: string }>>;
  identifiedIssues: ReadonlyArray<string>;
  outcomes:         ReadonlyArray<string>;
  followUps:        number;
  // Honest confidence hint: +points if `candidateIssue` was already
  // confirmed on this farm before. null when no basis.
  repeatConfidenceHint: number | null;
}

export function buildFarmScanMemory(input: {
  scanHistory?: ReadonlyArray<{ plant?: string; issue?: string; outcome?: string; followUpPending?: boolean }>;
  candidateIssue?: string;
} = {}): Readonly<FarmScanMemoryView> {
  return _safe(() => {
    const hist = _arr(input.scanHistory);
    const lastScans = hist.slice(-5).map((h) => Object.freeze({
      plant: _str(h.plant), issue: _str(h.issue),
    }));
    const issues = Array.from(new Set(hist.map((h) => _str(h.issue)).filter(Boolean)));
    const outcomes = hist.map((h) => _str(h.outcome)).filter(Boolean);
    const followUps = hist.filter((h) => !!h.followUpPending).length;

    // Repeat hint — only when the candidate issue was already seen.
    const cand = _str(input.candidateIssue).toLowerCase();
    let repeatConfidenceHint: number | null = null;
    if (cand) {
      const priorSeen = issues.filter((i) => i.toLowerCase() === cand).length;
      if (priorSeen > 0) repeatConfidenceHint = Math.min(8, 3 + priorSeen * 2);
    }

    return Object.freeze({
      runtimeVersion: FARM_SCAN_MEMORY_VERSION,
      lastScans: Object.freeze(lastScans),
      identifiedIssues: Object.freeze(issues),
      outcomes: Object.freeze(outcomes),
      followUps,
      repeatConfidenceHint,
    });
  }, Object.freeze({
    runtimeVersion: FARM_SCAN_MEMORY_VERSION,
    lastScans: Object.freeze([]),
    identifiedIssues: Object.freeze([]),
    outcomes: Object.freeze([]),
    followUps: 0,
    repeatConfidenceHint: null,
  }));
}

export const _internal = Object.freeze({ buildFarmScanMemory });
export default buildFarmScanMemory;
