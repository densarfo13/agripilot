/**
 * src/runtime/severity/SeverityRuntime.ts — deterministic
 * severity scorer for disease/pest scans.
 *
 *   evaluate(scanResult, plantContext, timestamp)
 *     → frozen SeverityResult { level, score, recommendedPriority, ... }
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Frozen envelopes only.
 *   • Banned wording absent — 'emergency' / 'guaranteed loss' /
 *     'confirmed crop failure' never appear in any string this
 *     runtime emits. The CI gate enforces this.
 *   • Single window global: __severityHealth.
 */

import {
  SEVERITY_RUNTIME_VERSION,
  SEVERITY_LEVEL,
  SEVERITY_STORAGE_KEY, SEVERITY_HISTORY_CAP,
  type SeverityLevelValue,
  type SeverityResult, type SeverityHealth,
} from './severityContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined'
                     && !!localStorage, false);
}

function _readHistory(): SeverityResult[] {
  return _safe(() => {
    if (!_hasLocal()) return [];
    const raw = localStorage.getItem(SEVERITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeHistory(list: SeverityResult[]): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    const trimmed = list.length > SEVERITY_HISTORY_CAP
      ? list.slice(list.length - SEVERITY_HISTORY_CAP) : list;
    localStorage.setItem(SEVERITY_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  }, false);
}

function _appendHistory(rec: SeverityResult): void {
  _safe(() => {
    const list = _readHistory();
    const key = `${rec.plantId}:${rec.scanId}`;
    const dedup = list.filter((r) => `${r.plantId}:${r.scanId}` !== key);
    dedup.push(rec);
    _writeHistory(dedup);
  }, undefined as any);
}

function _countRepeats(plantId: string): number {
  return _safe(() => {
    if (!plantId) return 0;
    return _readHistory().filter((r) => _lower(r.plantId) === _lower(plantId)).length;
  }, 0);
}

// ─── Scoring ──────────────────────────────────────────────────────

interface ScoringInput {
  plantId:         string;
  category:        string;
  possibleIssue:   string;
  defects:         ReadonlyArray<string>;
  diseaseSigns:    ReadonlyArray<string>;
  pestSigns:       ReadonlyArray<string>;
  affectedAreaPct?: number;
  repeatCount:     number;
}

function _classify(s: ScoringInput): {
  level: SeverityLevelValue; score: number;
  damageSigns: ReadonlyArray<string>;
} {
  let score = 0;

  // Disease keyword weights — safe-wording deterministic table.
  const dis = (s.possibleIssue + ' ' + s.diseaseSigns.join(' ')).toLowerCase();
  if (dis.includes('blight'))      score += 25;
  if (dis.includes('rot'))         score += 30;
  if (dis.includes('mold'))        score += 20;
  if (dis.includes('mildew'))      score += 18;
  if (dis.includes('wilt'))        score += 22;
  if (dis.includes('spot'))        score += 12;
  if (dis.includes('rust'))        score += 18;
  if (dis.includes('virus'))       score += 35;
  if (dis.includes('mosaic'))      score += 30;
  if (dis.includes('canker'))      score += 25;
  if (dis.includes('streak'))      score += 30;
  if (dis.includes('necrosis'))    score += 35;

  // Pest keyword weights.
  const pst = s.pestSigns.join(' ').toLowerCase();
  if (pst.includes('aphid'))       score += 12;
  if (pst.includes('beetle'))      score += 15;
  if (pst.includes('mite'))        score += 14;
  if (pst.includes('caterpil'))    score += 16;
  if (pst.includes('armyworm'))    score += 25;
  if (pst.includes('borer'))       score += 25;
  if (pst.includes('whitefly'))    score += 12;

  // Defects array.
  score += Math.min(20, s.defects.length * 4);

  // Affected leaf area.
  if (typeof s.affectedAreaPct === 'number'
      && Number.isFinite(s.affectedAreaPct)) {
    score += Math.max(0, Math.min(40, s.affectedAreaPct * 0.4));
  }

  // Repeat-scan penalty — same plant flagged multiple times → escalate.
  if (s.repeatCount >= 4)      score += 15;
  else if (s.repeatCount >= 2) score += 8;

  // Category fallback.
  const cat = s.category.toLowerCase();
  if (cat === 'disease' || cat === 'spots_or_disease_concern') score += 8;
  if (cat === 'pests'   || cat === 'holes_or_pest_damage')     score += 6;
  if (cat === 'yellowing') score += 4;

  score = Math.max(0, Math.min(100, score));

  let level: SeverityLevelValue;
  if (score >= 70)      level = SEVERITY_LEVEL.CRITICAL;
  else if (score >= 45) level = SEVERITY_LEVEL.HIGH;
  else if (score >= 20) level = SEVERITY_LEVEL.MEDIUM;
  else if (score >= 1)  level = SEVERITY_LEVEL.LOW;
  else                  level = SEVERITY_LEVEL.UNKNOWN;

  // Aggregate damage signs for the envelope.
  const damageSigns: string[] = [];
  for (const d of s.diseaseSigns) damageSigns.push(d);
  for (const p of s.pestSigns)    damageSigns.push(p);
  for (const x of s.defects)      damageSigns.push(x);

  return { level, score, damageSigns: Object.freeze(damageSigns) };
}

// ─── Recommendation copy — SAFE-WORDING ─────────────────────────

function _priorityCopy(level: SeverityLevelValue): {
  priority: string; recommendation: string;
} {
  switch (level) {
    case SEVERITY_LEVEL.CRITICAL:
      return {
        priority: 'Address today',
        recommendation: 'Inspect closely. Remove visibly affected leaves or fruit and isolate the plant if possible.',
      };
    case SEVERITY_LEVEL.HIGH:
      return {
        priority: 'Address within 1-2 days',
        recommendation: 'Remove affected leaves and monitor the surrounding plants. Apply organic treatment if available.',
      };
    case SEVERITY_LEVEL.MEDIUM:
      return {
        priority: 'Address within 3 days',
        recommendation: 'Trim affected areas and improve airflow. Scan again in 3 days to track change.',
      };
    case SEVERITY_LEVEL.LOW:
      return {
        priority: 'Monitor over the next week',
        recommendation: 'Likely manageable with normal care. Scan again in 5-7 days.',
      };
    default:
      return {
        priority: 'Monitor and re-scan',
        recommendation: 'Signals were not clear. Try another angle in better light.',
      };
  }
}

// ─── Public entry ─────────────────────────────────────────────────

export interface SeverityEvaluateInput {
  scanResult:    any;
  plantContext?: { plantId?: string };
  timestamp?:    string;
}

export function evaluate(input: SeverityEvaluateInput): SeverityResult {
  const fallback = (scanId: string, plantId: string): SeverityResult =>
    Object.freeze({
      plantId,
      scanId,
      level: SEVERITY_LEVEL.UNKNOWN,
      score: 0,
      damageSigns: Object.freeze([]),
      recommendedPriority: 'Monitor and re-scan',
      recommendation: 'Signals were not clear. Try another angle in better light.',
      repeatScanCount: 0,
      needsReview: true,
      timestamp: _str(input?.timestamp),
    } as SeverityResult);

  return _safe(() => {
    const scan = input.scanResult || {};
    const scanId = _str(scan.scanId) || _str(scan.id) || '';
    if (!scanId) return fallback('', '');

    const plantId = _lower(input.plantContext?.plantId)
                  || _lower(scan.plantId)
                  || _lower(scan.crop)
                  || _lower(scan.cropId)
                  || _lower(scan.plantName)
                  || _lower(scan.cropName)
                  || 'unknown';

    const repeatCount = _countRepeats(plantId);

    const classified = _classify({
      plantId,
      category:        _str(scan.category),
      possibleIssue:   _str(scan.possibleIssue) || _str(scan.issue)
                       || _str(scan.diagnosis),
      defects:         Array.isArray(scan.defects) ? scan.defects : [],
      diseaseSigns:    Array.isArray(scan.diseaseSigns) ? scan.diseaseSigns : [],
      pestSigns:       Array.isArray(scan.pestSigns)    ? scan.pestSigns    : [],
      affectedAreaPct: typeof scan.affectedAreaPct === 'number'
                       ? scan.affectedAreaPct : undefined,
      repeatCount,
    });

    const copy = _priorityCopy(classified.level);

    const result: SeverityResult = Object.freeze({
      plantId,
      scanId,
      level: classified.level,
      score: classified.score,
      affectedAreaPct: typeof scan.affectedAreaPct === 'number'
                     ? scan.affectedAreaPct : undefined,
      damageSigns: classified.damageSigns,
      recommendedPriority: copy.priority,
      recommendation:      copy.recommendation,
      repeatScanCount:     repeatCount,
      needsReview:         classified.level === SEVERITY_LEVEL.UNKNOWN,
      timestamp:           _str(input.timestamp),
    });

    _appendHistory(result);
    return result;
  }, fallback(_str(input?.scanResult?.scanId), _str(input?.plantContext?.plantId)));
}

export function getLatestSeverityForPlant(plantId: string): SeverityResult | null {
  return _safe(() => {
    const pid = _lower(plantId);
    if (!pid) return null;
    const rows = _readHistory()
      .filter((r) => _lower(r.plantId) === pid)
      .sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(tb) ? tb : 0)
             - (Number.isFinite(ta) ? ta : 0);
      });
    return rows[0] || null;
  }, null);
}

export function listSeverityHistoryForPlant(plantId: string): ReadonlyArray<SeverityResult> {
  return _safe(() => {
    const pid = _lower(plantId);
    if (!pid) return Object.freeze([]);
    const rows = _readHistory()
      .filter((r) => _lower(r.plantId) === pid)
      .sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(tb) ? tb : 0)
             - (Number.isFinite(ta) ? ta : 0);
      });
    return Object.freeze(rows);
  }, Object.freeze([]));
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function severityHealth(): SeverityHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:  SEVERITY_RUNTIME_VERSION,
    initialized:     true,
    severityReady:   true,
    levelsSupported: 4,
  }), Object.freeze({
    runtimeVersion:  SEVERITY_RUNTIME_VERSION,
    initialized:     false,
    severityReady:   false,
    levelsSupported: 0,
  }));
}

export function installSeverityGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__severityHealth !== 'function') {
      w.__severityHealth = function () {
        const out = severityHealth();
        try { console.log('[Farroway · Severity]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
