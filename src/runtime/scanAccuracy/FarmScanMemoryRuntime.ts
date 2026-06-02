/**
 * FarmScanMemoryRuntime.ts — §STAGE 9.
 *
 * Per-plant scan memory. Records each scan's plant key, location,
 * problem, and outcome verdict in localStorage so the farmer can see
 * "what worked last time" for this plant + location. Bounded to the
 * last 100 entries; deduped on scanId.
 *
 * Honest: never fabricates history. If localStorage is unavailable the
 * runtime degrades to read-empty and write-false rather than throwing.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const STORAGE_KEY = 'farroway_scan_memory_log';
const MAX_ENTRIES = 100;
const RECENT_DEFAULT_LIMIT = 5;
const PROBLEM_TOP_N = 5;

export interface ScanMemoryEntry {
  scanId: string;
  plantKey: string;
  location: string | null;
  problem: string | null;
  outcomeVerdict: 'better' | 'same' | 'worse' | null;
  recordedAt: number;
}

export interface FarmScanMemoryHealth {
  initialized: true;
  memoryReady: boolean;
  storedScanCount: number;
  uniquePlants: number;
  noFakeMemory: true;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _lsWrite(key: string, value: any): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }, false);
}

function _readAll(): ReadonlyArray<ScanMemoryEntry> {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const cleaned: ScanMemoryEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
      const e = raw[i];
      if (
        e
        && typeof e.scanId === 'string'
        && typeof e.plantKey === 'string'
        && typeof e.recordedAt === 'number'
      ) {
        cleaned.push({
          scanId: e.scanId,
          plantKey: e.plantKey,
          location: typeof e.location === 'string' ? e.location : null,
          problem: typeof e.problem === 'string' ? e.problem : null,
          outcomeVerdict: (e.outcomeVerdict === 'better'
            || e.outcomeVerdict === 'same'
            || e.outcomeVerdict === 'worse') ? e.outcomeVerdict : null,
          recordedAt: e.recordedAt,
        });
      }
    }
    return cleaned;
  }, [] as ScanMemoryEntry[]);
}

export function farmMemoryReady(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probeKey = '__farroway_scan_memory_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  }, false);
}

export function recordScanMemory(
  entry: Omit<ScanMemoryEntry, 'recordedAt'>,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (!entry || typeof entry.scanId !== 'string' || typeof entry.plantKey !== 'string') {
      return false;
    }
    if (!farmMemoryReady()) return false;
    const existing = _readAll();
    const deduped: ScanMemoryEntry[] = [];
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].scanId !== entry.scanId) deduped.push(existing[i]);
    }
    const next: ScanMemoryEntry = {
      scanId: entry.scanId,
      plantKey: entry.plantKey,
      location: typeof entry.location === 'string' ? entry.location : null,
      problem: typeof entry.problem === 'string' ? entry.problem : null,
      outcomeVerdict: (entry.outcomeVerdict === 'better'
        || entry.outcomeVerdict === 'same'
        || entry.outcomeVerdict === 'worse') ? entry.outcomeVerdict : null,
      recordedAt: typeof nowMs === 'number' ? nowMs : 0,
    };
    deduped.push(next);
    // Keep newest MAX_ENTRIES by recordedAt (descending), then store
    // in chronological order so subsequent pushes are O(1).
    deduped.sort((a, b) => b.recordedAt - a.recordedAt);
    const trimmed = deduped.slice(0, MAX_ENTRIES);
    trimmed.reverse();
    return _lsWrite(STORAGE_KEY, trimmed);
  }, false);
}

export function recentScansForPlant(
  plantKey: string,
  limit: number = RECENT_DEFAULT_LIMIT,
): ReadonlyArray<Readonly<ScanMemoryEntry>> {
  return _safe(() => {
    if (typeof plantKey !== 'string' || plantKey.length === 0) {
      return Object.freeze([]) as ReadonlyArray<Readonly<ScanMemoryEntry>>;
    }
    const cap = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : RECENT_DEFAULT_LIMIT;
    const all = _readAll();
    const matches: ScanMemoryEntry[] = [];
    for (let i = 0; i < all.length; i++) {
      if (all[i].plantKey === plantKey) matches.push(all[i]);
    }
    matches.sort((a, b) => b.recordedAt - a.recordedAt);
    const frozen = matches.slice(0, cap).map((e) => Object.freeze({ ...e }));
    return Object.freeze(frozen) as ReadonlyArray<Readonly<ScanMemoryEntry>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ScanMemoryEntry>>);
}

export function commonProblemsForPlant(
  plantKey: string,
): ReadonlyArray<{ problem: string; count: number }> {
  return _safe(() => {
    if (typeof plantKey !== 'string' || plantKey.length === 0) {
      return Object.freeze([]) as ReadonlyArray<{ problem: string; count: number }>;
    }
    const all = _readAll();
    const tally = new Map<string, number>();
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (e.plantKey !== plantKey) continue;
      if (typeof e.problem !== 'string' || e.problem.length === 0) continue;
      tally.set(e.problem, (tally.get(e.problem) || 0) + 1);
    }
    const rows: { problem: string; count: number }[] = [];
    tally.forEach((count, problem) => { rows.push({ problem, count }); });
    rows.sort((a, b) => b.count - a.count);
    const top = rows.slice(0, PROBLEM_TOP_N).map((r) => Object.freeze({ ...r }));
    return Object.freeze(top) as ReadonlyArray<{ problem: string; count: number }>;
  }, Object.freeze([]) as ReadonlyArray<{ problem: string; count: number }>);
}

export function farmScanMemoryHealth(): Readonly<FarmScanMemoryHealth> {
  return _safe(() => {
    const ready = farmMemoryReady();
    const all = _readAll();
    const plants = new Set<string>();
    for (let i = 0; i < all.length; i++) plants.add(all[i].plantKey);
    const storedScanCount = all.length;
    const uniquePlants = plants.size;
    const confidence: 'low' | 'medium' | 'high' =
      !ready ? 'low'
        : storedScanCount >= 20 ? 'high'
          : storedScanCount >= 5 ? 'medium' : 'low';
    return Object.freeze<FarmScanMemoryHealth>({
      initialized: true,
      memoryReady: ready,
      storedScanCount,
      uniquePlants,
      noFakeMemory: true as const,
      confidence,
      explanation:
        'Per-plant scan memory log stored in localStorage under '
        + STORAGE_KEY + '. Bounded to the last ' + MAX_ENTRIES + ' entries; deduped on '
        + 'scanId. Powers "recent scans" and "common problems" surfaces for this farm. '
        + 'Never fabricates history — entries only appear after a real scan is recorded.',
      limitations:
        'localStorage is per-device; history does not sync across devices and may be cleared '
        + 'by the browser. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FarmScanMemoryHealth>({
    initialized: true,
    memoryReady: false,
    storedScanCount: 0,
    uniquePlants: 0,
    noFakeMemory: true as const,
    confidence: 'low',
    explanation: 'Farm scan memory runtime initialized.',
    limitations: 'Memory health probe threw. ' + GUIDANCE_TAIL,
  }));
}

export function installFarmScanMemoryGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmScanMemoryHealth !== 'function') {
      w.__farmScanMemoryHealth = function () {
        const out = farmScanMemoryHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Farm Scan Memory]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
