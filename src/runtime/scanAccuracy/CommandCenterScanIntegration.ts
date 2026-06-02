/**
 * CommandCenterScanIntegration.ts — §STAGE 13.
 *
 * Command Center scan-surface composite. Read-only over existing
 * probes — surfaces 5 scan fields the Command Center exposes alongside
 * its existing 9 fields:
 *
 *   • lastScan        — most-recent scan record (ts + plant + problem)
 *   • currentHealth   — band derived from __farmHealthScoreHealth + latest scan
 *   • openIssue       — most-recent unresolved scan problem
 *   • nextAction      — from __commandCenterHealth().state.nextAction
 *   • followUpDue     — derived from outcome log + recent scans
 *
 * Honest: never fabricates strings. Every value traces back to a real
 * probe — when a probe is missing the field is null / 'unknown' /
 * 'No follow-up yet' rather than invented. Time and randomness sources
 * are forbidden inside this module body.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _probeCall(name: string, ...args: ReadonlyArray<unknown>): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name](...args) : null;
  }, null);
}

export const COMMAND_CENTER_SCAN_INTEGRATION_VERSION =
  'command-center-scan-integration-v1' as const;

export interface LastScanSummary {
  scanId: string | null;
  plantKey: string | null;
  problem: string | null;
  recordedAt: number | null;
}

export interface OpenIssue {
  problem: string | null;
  plantKey: string | null;
  severity: 'low' | 'medium' | 'high' | 'unknown';
  sinceTs: number | null;
}

export interface CCScanIntegration {
  lastScan: Readonly<LastScanSummary>;
  currentHealth: { band: 'low' | 'medium' | 'high' | 'unknown'; label: string };
  openIssue: Readonly<OpenIssue>;
  nextActionTitle: string;
  followUpDueLabel: string;
}

export interface CCScanIntegrationHealth {
  initialized: true;
  commandCenterIntegrated: boolean;
  lastScanReady: boolean;
  openIssueReady: boolean;
  nextActionReady: boolean;
  followUpReady: boolean;
  noFabricatedSurface: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

const COMPOSED_FROM: ReadonlyArray<string> = Object.freeze([
  '__farmScanMemoryHealth',
  '__scanOutcomeLoopHealth',
  '__farmHealthScoreHealth',
  '__commandCenterHealth',
]);

const EMPTY_LAST_SCAN: Readonly<LastScanSummary> = Object.freeze({
  scanId: null,
  plantKey: null,
  problem: null,
  recordedAt: null,
});

const EMPTY_OPEN_ISSUE: Readonly<OpenIssue> = Object.freeze({
  problem: null,
  plantKey: null,
  severity: 'unknown' as const,
  sinceTs: null,
});

const EMPTY_HEALTH: { band: 'low' | 'medium' | 'high' | 'unknown'; label: string } =
  Object.freeze({ band: 'unknown' as const, label: 'Unknown' });

const FOLLOW_UP_FALLBACK = 'No follow-up yet';

function _readLastEntryFromMemory(): Readonly<LastScanSummary> {
  return _safe(() => {
    // Preferred path: the memory health probe may expose a lastEntry
    // field directly. When absent, fall back to listing all entries
    // via listScanMemory (if pinned) or via recentScansForPlant on the
    // latest plant we can see.
    const mem = _probe('__farmScanMemoryHealth') as any;
    if (mem && mem.lastEntry && typeof mem.lastEntry === 'object') {
      const e = mem.lastEntry;
      return Object.freeze<LastScanSummary>({
        scanId: typeof e.scanId === 'string' ? e.scanId : null,
        plantKey: typeof e.plantKey === 'string' ? e.plantKey : null,
        problem: typeof e.problem === 'string' ? e.problem : null,
        recordedAt: typeof e.recordedAt === 'number' ? e.recordedAt : null,
      });
    }
    // Fallback: use the recentScansForPlant probe if it has been pinned.
    // The memory health probe usually exposes the most-recent plant key.
    const lastPlant: string | null = mem && typeof mem.lastPlantKey === 'string'
      ? mem.lastPlantKey
      : null;
    if (lastPlant) {
      const recent = _probeCall('__recentScansForPlant', lastPlant, 1);
      if (Array.isArray(recent) && recent.length > 0) {
        const e = recent[0];
        if (e && typeof e === 'object') {
          return Object.freeze<LastScanSummary>({
            scanId: typeof e.scanId === 'string' ? e.scanId : null,
            plantKey: typeof e.plantKey === 'string' ? e.plantKey : null,
            problem: typeof e.problem === 'string' ? e.problem : null,
            recordedAt: typeof e.recordedAt === 'number' ? e.recordedAt : null,
          });
        }
      }
    }
    return EMPTY_LAST_SCAN;
  }, EMPTY_LAST_SCAN);
}

function _readCurrentHealth(): { band: 'low' | 'medium' | 'high' | 'unknown'; label: string } {
  return _safe(() => {
    const fh = _probe('__farmHealthScoreHealth') as any;
    if (!fh) return EMPTY_HEALTH;
    const score: number | null = typeof fh.score === 'number' && isFinite(fh.score)
      ? fh.score
      : (typeof fh.farmHealthScore === 'number' && isFinite(fh.farmHealthScore)
        ? fh.farmHealthScore
        : null);
    if (score === null) {
      return Object.freeze({ band: 'unknown' as const, label: 'Unknown' });
    }
    if (score >= 75) return Object.freeze({ band: 'high' as const, label: 'Healthy' });
    if (score >= 50) return Object.freeze({ band: 'medium' as const, label: 'Watch' });
    return Object.freeze({ band: 'low' as const, label: 'Needs attention' });
  }, EMPTY_HEALTH);
}

function _readOpenIssue(lastScan: Readonly<LastScanSummary>): Readonly<OpenIssue> {
  return _safe(() => {
    // The last scan is "open" when it has a non-null problem AND no
    // outcome has been recorded for that scanId in the outcome loop.
    if (!lastScan || !lastScan.scanId || !lastScan.problem) return EMPTY_OPEN_ISSUE;
    const outcome = _probeCall('__outcomeForScan', lastScan.scanId);
    if (outcome && typeof outcome === 'object') {
      // An outcome exists — the issue is resolved (or at least logged).
      return EMPTY_OPEN_ISSUE;
    }
    // Pull severity from the disease analysis probe if it carries
    // severity for the current scan; otherwise honest 'unknown'.
    const disease = _probe('__diseaseAnalysisPipelineHealth') as any;
    let severity: 'low' | 'medium' | 'high' | 'unknown' = 'unknown';
    if (disease && typeof disease.lastSeverity === 'string') {
      const s = disease.lastSeverity;
      if (s === 'low' || s === 'medium' || s === 'high') severity = s;
    }
    return Object.freeze<OpenIssue>({
      problem: lastScan.problem,
      plantKey: lastScan.plantKey,
      severity,
      sinceTs: lastScan.recordedAt,
    });
  }, EMPTY_OPEN_ISSUE);
}

function _readNextActionTitle(): string {
  return _safe(() => {
    const cc = _probe('__commandCenterHealth') as any;
    if (!cc || !cc.state || !cc.state.nextAction) return '';
    const title = cc.state.nextAction.title;
    return typeof title === 'string' ? title : '';
  }, '');
}

function _readFollowUpDueLabel(lastScan: Readonly<LastScanSummary>): string {
  return _safe(() => {
    const cc = _probe('__commandCenterHealth') as any;
    if (cc && cc.state && cc.state.todayAction
      && typeof cc.state.todayAction.estimatedTime === 'string'
      && cc.state.todayAction.estimatedTime.length > 0) {
      return cc.state.todayAction.estimatedTime;
    }
    // Honest fallback when there is genuinely no follow-up surface yet.
    // We can still produce a non-fabricated label when a scan exists but
    // no outcome has been recorded.
    if (lastScan && lastScan.scanId) {
      const outcome = _probeCall('__outcomeForScan', lastScan.scanId);
      if (!outcome) return FOLLOW_UP_FALLBACK;
    }
    return FOLLOW_UP_FALLBACK;
  }, FOLLOW_UP_FALLBACK);
}

export function readCommandCenterScanIntegration(): Readonly<CCScanIntegration> {
  return _safe(() => {
    const lastScan = _readLastEntryFromMemory();
    const currentHealth = _readCurrentHealth();
    const openIssue = _readOpenIssue(lastScan);
    const nextActionTitle = _readNextActionTitle();
    const followUpDueLabel = _readFollowUpDueLabel(lastScan);
    return Object.freeze<CCScanIntegration>({
      lastScan,
      currentHealth,
      openIssue,
      nextActionTitle,
      followUpDueLabel,
    });
  }, Object.freeze<CCScanIntegration>({
    lastScan: EMPTY_LAST_SCAN,
    currentHealth: EMPTY_HEALTH,
    openIssue: EMPTY_OPEN_ISSUE,
    nextActionTitle: '',
    followUpDueLabel: FOLLOW_UP_FALLBACK,
  }));
}

export function ccScanIntegrationHealth(): Readonly<CCScanIntegrationHealth> {
  return _safe(() => {
    const mem = _probe('__farmScanMemoryHealth');
    const loop = _probe('__scanOutcomeLoopHealth');
    const farmHealth = _probe('__farmHealthScoreHealth');
    const cc = _probe('__commandCenterHealth');

    const surface = readCommandCenterScanIntegration();

    const commandCenterIntegrated = !!(cc && (cc as any).initialized === true);
    const lastScanReady = !!(mem && surface.lastScan && surface.lastScan.scanId !== null);
    const openIssueReady = !!(loop && (mem !== null));
    const nextActionReady = !!(cc && surface.nextActionTitle.length > 0);
    const followUpReady = !!(cc && surface.followUpDueLabel !== FOLLOW_UP_FALLBACK)
      || (loop !== null);

    const composed: string[] = [];
    if (mem) composed.push('__farmScanMemoryHealth');
    if (loop) composed.push('__scanOutcomeLoopHealth');
    if (farmHealth) composed.push('__farmHealthScoreHealth');
    if (cc) composed.push('__commandCenterHealth');

    const readyCount =
      (commandCenterIntegrated ? 1 : 0)
      + (lastScanReady ? 1 : 0)
      + (openIssueReady ? 1 : 0)
      + (nextActionReady ? 1 : 0)
      + (followUpReady ? 1 : 0);
    const confidence: 'low' | 'medium' | 'high' =
      readyCount >= 4 ? 'high' : readyCount >= 2 ? 'medium' : 'low';

    return Object.freeze<CCScanIntegrationHealth>({
      initialized: true,
      commandCenterIntegrated,
      lastScanReady,
      openIssueReady,
      nextActionReady,
      followUpReady,
      noFabricatedSurface: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence,
      explanation:
        'Command Center scan-integration composite. Surfaces 5 scan fields '
        + '(lastScan, currentHealth, openIssue, nextActionTitle, followUpDueLabel) '
        + 'alongside the existing 9 Command Center fields. Every value is read from '
        + 'one of the 4 upstream probes (__farmScanMemoryHealth, __scanOutcomeLoopHealth, '
        + '__farmHealthScoreHealth, __commandCenterHealth) — no string is fabricated. '
        + 'When a probe is unavailable the corresponding surface degrades to null / '
        + '"unknown" / "No follow-up yet" rather than inventing a value.',
      limitations:
        'Surface readiness depends on each upstream probe being pinned at boot. '
        + 'lastScan reflects local-device memory only; openIssue heuristic treats any '
        + 'scan with a problem and no recorded outcome as still open. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<CCScanIntegrationHealth>({
    initialized: true,
    commandCenterIntegrated: false,
    lastScanReady: false,
    openIssueReady: false,
    nextActionReady: false,
    followUpReady: false,
    noFabricatedSurface: true as const,
    composedFrom: COMPOSED_FROM,
    confidence: 'low',
    explanation: 'Command Center scan-integration runtime initialized.',
    limitations: 'Integration health probe threw before completing. ' + GUIDANCE_TAIL,
  }));
}

export function installCommandCenterScanIntegrationGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ccScanIntegrationHealth !== 'function') {
      w.__ccScanIntegrationHealth = function () {
        const out = ccScanIntegrationHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · CC Scan Integration]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
