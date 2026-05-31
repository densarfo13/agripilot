// TrendEngine.ts — Disease/Pest Trend (composition-only decision-support runtime)
// SELF-CONTAINED. No project imports. Reads only from window probe globals and localStorage.
// Pure, SSR-safe, never throws, returns frozen envelopes.

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any { return _safe(() => { if (typeof window === 'undefined') return null; const w = window as any; return typeof w[name] === 'function' ? w[name]() : null; }, null); }
function _ls(key: string): any { return _safe(() => { if (typeof localStorage === 'undefined') return null; const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }, null); }

type TrendDirection = 'improving' | 'stable' | 'worsening' | 'unknown';
type Confidence = 'low' | 'medium' | 'high';

interface TrendObject {
  trend: TrendDirection;
  reason: string;
  confidence: Confidence | number;
  dataPoints: number;
}

const MIN_SCANS_FOR_TREND = 2;

const _UNKNOWN_TREND = (reason: string, dataPoints: number): TrendObject =>
  Object.freeze({ trend: 'unknown' as TrendDirection, reason, confidence: 'low' as Confidence, dataPoints });

// Read the real scan-history array; return [] when absent or malformed.
function _scanHistory(): any[] {
  return _safe(() => {
    const raw = _ls('farroway_scan_history_v1');
    return Array.isArray(raw) ? raw : [];
  }, []);
}

// Sort scans oldest -> newest using any available timestamp field; fall back to stored order.
function _sortScans(scans: any[]): any[] {
  return _safe(() => {
    const withTime = scans.map((s, i) => {
      const t = _safe(() => {
        const cand = (s && (s.scannedAt || s.timestamp || s.date || s.createdAt || s.at)) ?? null;
        if (cand == null) return null;
        const n = typeof cand === 'number' ? cand : Date.parse(String(cand));
        return Number.isFinite(n) ? n : null;
      }, null);
      return { s, i, t };
    });
    const allHaveTime = withTime.every((x) => x.t != null);
    if (allHaveTime) {
      return withTime.slice().sort((a, b) => (a.t as number) - (b.t as number)).map((x) => x.s);
    }
    // Preserve stored order when timestamps are not reliably present.
    return scans.slice();
  }, scans.slice());
}

// Derive a numeric severity score from a scan (higher = worse). Returns null if no signal.
function _severityScore(scan: any): number | null {
  return _safe(() => {
    if (!scan || typeof scan !== 'object') return null;

    // Direct numeric severity field.
    const sevNum = (scan.severity ?? scan.severityScore ?? scan.riskScore ?? null);
    if (typeof sevNum === 'number' && Number.isFinite(sevNum)) return sevNum;

    // Textual severity mapped to a coarse scale.
    const sevStr = (scan.severity ?? scan.severityLevel ?? scan.status ?? null);
    if (typeof sevStr === 'string') {
      const v = sevStr.trim().toLowerCase();
      const map: Record<string, number> = {
        none: 0, healthy: 0, clear: 0, ok: 0,
        low: 1, mild: 1, minor: 1,
        medium: 2, moderate: 2,
        high: 3, severe: 3, critical: 3, bad: 3,
      };
      if (Object.prototype.hasOwnProperty.call(map, v)) return map[v];
    }

    // Confidence on a diseased/pest finding: higher confidence in a problem = worse.
    const conf = (scan.confidence ?? scan.confidenceScore ?? null);
    const isProblem = _safe(() => {
      const healthy = (scan.healthy === true) || (scan.isHealthy === true);
      const label = String(scan.label ?? scan.result ?? scan.diagnosis ?? '').toLowerCase();
      const looksHealthy = healthy || label.includes('healthy') || label.includes('no disease');
      return !looksHealthy;
    }, false);
    if (typeof conf === 'number' && Number.isFinite(conf)) {
      const norm = conf > 1 ? conf / 100 : conf; // accept 0..1 or 0..100
      return isProblem ? norm : (1 - norm);
    }

    return null;
  }, null);
}

// Compute a trend object from a (already filtered) list of scans for one scope.
function _computeTrend(scans: any[]): TrendObject {
  return _safe(() => {
    const count = Array.isArray(scans) ? scans.length : 0;
    if (count < MIN_SCANS_FOR_TREND) {
      return _UNKNOWN_TREND('Not enough data yet — a trend needs at least 2 scans.', count);
    }

    const ordered = _sortScans(scans);
    const scores = ordered.map(_severityScore).filter((v): v is number => typeof v === 'number');

    if (scores.length < MIN_SCANS_FOR_TREND) {
      return _UNKNOWN_TREND('Scans found, but they do not record severity or confidence we can compare yet.', count);
    }

    const first = scores[0];
    const last = scores[scores.length - 1];
    const delta = last - first;
    const span = Math.max(Math.abs(first), Math.abs(last), 1);
    const rel = delta / span;

    // Tolerance band for "stable".
    const band = 0.15;
    let trend: TrendDirection;
    let reason: string;
    if (rel <= -band) {
      trend = 'improving';
      reason = 'Severity has gone down across your recent scans. Decision support, not a guarantee.';
    } else if (rel >= band) {
      trend = 'worsening';
      reason = 'Severity has gone up across your recent scans. Keep watching this plant closely. Decision support, not a guarantee.';
    } else {
      trend = 'stable';
      reason = 'Severity looks about the same across your recent scans. Decision support, not a guarantee.';
    }

    // Confidence grows with how many comparable scans we have.
    const confidence: Confidence = scores.length >= 5 ? 'high' : scores.length >= 3 ? 'medium' : 'low';

    return Object.freeze({ trend, reason, confidence, dataPoints: scores.length });
  }, _UNKNOWN_TREND('Not enough data yet.', 0));
}

// Group scans by a plant identifier, return the trend for the plant with the most scans.
function _plantTrend(scans: any[]): TrendObject {
  return _safe(() => {
    const groups = new Map<string, any[]>();
    for (const s of scans) {
      const id = _safe(() => String((s && (s.plantId ?? s.plant_id ?? s.managedPlantId ?? s.plant ?? '')) || ''), '');
      if (!id) continue;
      const arr = groups.get(id) || [];
      arr.push(s);
      groups.set(id, arr);
    }
    if (groups.size === 0) {
      // No per-plant id — fall back to overall history as a single-plant view if small.
      return _computeTrend(scans);
    }
    let best: any[] = [];
    groups.forEach((arr) => { if (arr.length > best.length) best = arr; });
    return _computeTrend(best);
  }, _UNKNOWN_TREND('Not enough data yet.', 0));
}

// Whole-farm trend across all scans regardless of plant.
function _farmTrend(scans: any[]): TrendObject {
  return _computeTrend(scans);
}

function _regionAvailable(): boolean {
  return _safe(() => {
    const farm = _ls('farroway_active_farm');
    if (!farm || typeof farm !== 'object') return false;
    const region = (farm.region ?? farm.regionName ?? farm.area ?? farm.zone ?? null);
    return typeof region === 'string' && region.trim().length > 0;
  }, false);
}

export function trendHealth() {
  return _safe(() => {
    const scans = _scanHistory();
    const total = scans.length;

    // Touch probes defensively so dataSources reflect what was actually reachable.
    const scanProbe = _probe('__scanResultHealth');

    const dataSources: string[] = ['farroway_scan_history_v1'];
    if (scanProbe != null) dataSources.push('__scanResultHealth');
    const regionTrendAvailable = _regionAvailable();
    if (regionTrendAvailable) dataSources.push('farroway_active_farm');

    const plantTrend = _plantTrend(scans);
    const farmTrend = _farmTrend(scans);

    let value: TrendDirection;
    let confidence: Confidence;
    let explanation: string;

    if (total < MIN_SCANS_FOR_TREND) {
      value = 'unknown';
      confidence = 'low';
      explanation =
        total === 0
          ? 'Not enough data yet. A trend needs at least 2 scans. Once you scan the same plant more than once over time, we can show whether things look like they are improving, staying the same, or getting worse.'
          : 'Not enough data yet. Only one scan is stored. A trend needs at least 2 scans, so from a single scan the trend stays unknown.';
    } else {
      value = farmTrend.trend;
      confidence =
        (farmTrend.confidence === 'high' || plantTrend.confidence === 'high')
          ? 'high'
          : (farmTrend.confidence === 'medium' || plantTrend.confidence === 'medium')
            ? 'medium'
            : 'low';
      explanation =
        'A trend needs at least 2 scans. We compared the severity recorded across your scans over time to see whether things look like they are improving, staying the same, or getting worse. Decision support, not a guarantee.';
    }

    const limitations =
      'This only reflects what you have scanned and stored on this device. It cannot see plants you have not scanned, and it does not include lab tests or expert diagnosis. It is decision support, not a guarantee.';

    return Object.freeze({
      runtimeVersion: 'trend-v1',
      initialized: true,
      minScansForTrend: MIN_SCANS_FOR_TREND,
      plantTrend,
      farmTrend,
      regionTrendAvailable,
      value,
      confidence,
      dataSources: Object.freeze(dataSources.slice()) as unknown as string[],
      explanation,
      limitations,
    });
  }, Object.freeze({
    runtimeVersion: 'trend-v1',
    initialized: true,
    minScansForTrend: MIN_SCANS_FOR_TREND,
    plantTrend: _UNKNOWN_TREND('Not enough data yet.', 0),
    farmTrend: _UNKNOWN_TREND('Not enough data yet.', 0),
    regionTrendAvailable: false,
    value: 'unknown' as TrendDirection,
    confidence: 'low' as Confidence,
    dataSources: Object.freeze(['farroway_scan_history_v1']) as unknown as string[],
    explanation: 'Not enough data yet. A trend needs at least 2 scans.',
    limitations: 'This only reflects what you have scanned and stored on this device. It is decision support, not a guarantee.',
  }));
}

export function installTrendHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__trendHealth !== 'function') {
      w.__trendHealth = function () {
        const out = trendHealth();
        try { const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV; if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Trend]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
