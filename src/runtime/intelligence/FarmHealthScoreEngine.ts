// FarmHealthScoreEngine.ts
// Composition-only, self-contained decision-support runtime.
// Computes a Farm Health Score (0-100) from REAL stored signals only.
// Never throws, SSR-safe, no fabricated data, frozen output.

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any { return _safe(() => { if (typeof window === 'undefined') return null; const w = window as any; return typeof w[name] === 'function' ? w[name]() : null; }, null); }
function _ls(key: string): any { return _safe(() => { if (typeof localStorage === 'undefined') return null; const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }, null); }

const GUARD = 'Decision support, not a guarantee.';

type Confidence = 'low' | 'medium' | 'high';

function _arr(v: any): any[] { return Array.isArray(v) ? v : []; }

function _num(v: any): number | null {
  return _safe(() => {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return isFinite(n) ? n : null; }
    return null;
  }, null);
}

function _clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : (n > hi ? hi : n);
}

function _ts(v: any): number | null {
  return _safe(() => {
    if (v == null) return null;
    if (typeof v === 'number' && isFinite(v)) return v;
    const t = Date.parse(String(v));
    return isFinite(t) ? t : null;
  }, null);
}

function _label(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Watch';
  return 'Needs attention';
}

// Pull a numeric score off the existing __farmHealthScore probe, if it offers one.
function _probeScore(probe: any): number | null {
  return _safe(() => {
    if (probe == null || typeof probe !== 'object') return null;
    const candidates = [probe.score, probe.value, probe.healthScore, probe.farmHealthScore];
    for (const c of candidates) {
      const n = _num(c);
      if (n != null && n >= 0 && n <= 100) return Math.round(n);
    }
    return null;
  }, null);
}

function _isRecent(ts: number | null, days: number): boolean {
  if (ts == null) return false;
  const now = Date.now();
  return ts <= now && (now - ts) <= days * 24 * 60 * 60 * 1000;
}

// Heuristic: does a scan record indicate an open disease/pest issue?
function _scanHasIssue(scan: any): boolean {
  return _safe(() => {
    if (!scan || typeof scan !== 'object') return false;
    const healthyFlags = [scan.healthy, scan.isHealthy];
    for (const f of healthyFlags) { if (f === true) return false; }
    const txt = String(
      (scan.status || '') + ' ' + (scan.diagnosis || '') + ' ' + (scan.condition || '') +
      ' ' + (scan.label || '') + ' ' + (scan.result || '') + ' ' + (scan.disease || '') +
      ' ' + (scan.issue || '') + ' ' + (scan.pest || '')
    ).toLowerCase();
    if (/healthy|no\s*issue|no\s*disease|clear|fine|normal/.test(txt)) return false;
    if (/disease|pest|blight|rot|mildew|fungus|fungal|infect|infest|deficien|wilt|spot|rust|mold|mould|aphid|mite|infestation|sick|unhealthy|problem/.test(txt)) return true;
    // explicit boolean-ish fields
    if (scan.hasDisease === true || scan.hasIssue === true || scan.isHealthy === false) return true;
    return false;
  }, false);
}

function farmHealthScoreHealth() {
  return _safe(() => {
    const dataSources: string[] = [];
    const components: any = {};

    // ---- Read real signals defensively ----
    const fhProbe = _probe('__farmHealthScore');
    const weatherRisk = _probe('__weatherRiskHealth');
    const scanHistory = _arr(_ls('farroway_scan_history_v1'));
    const cachedTasks = _arr(_ls('farroway_cached_tasks'));

    // ---- 1. Compose existing probe if it gives a numeric score ----
    const probeScore = _probeScore(fhProbe);
    if (probeScore != null) {
      dataSources.push('window.__farmHealthScore()');
      components.composedProbeScore = probeScore;
      const score = _clamp(Math.round(probeScore), 0, 100);
      const label = _label(score);
      const explanation =
        'Your farm health score of ' + score + ' (' + label + ') comes from the ' +
        'existing farm health signal already running in the app. ' + GUARD;
      const out = {
        runtimeVersion: 'farm-health-score-v1',
        initialized: true,
        score,
        label,
        components: Object.freeze(components),
        value: score,
        confidence: 'medium' as Confidence,
        dataSources: Object.freeze(dataSources.slice()),
        explanation,
        limitations:
          'Based on a single existing signal. The score is a simple guide, not a measurement, ' +
          'and cannot see anything you have not recorded in the app. ' + GUARD
      };
      return Object.freeze(out);
    }

    // ---- 2. Otherwise compute from raw signals ----
    // Each factor contributes a 0-100 sub-score with a weight, only when it has real data.
    const factors: Array<{ key: string; sub: number; weight: number }> = [];

    // Factor A: open disease/pest issues from recent scans (last 30 days)
    const recentScans = scanHistory.filter((s: any) => {
      const t = _ts(s && (s.timestamp || s.createdAt || s.date || s.scannedAt || s.at));
      // if no timestamp, still count it as a usable scan but treat as recent
      return t == null ? true : _isRecent(t, 30);
    });
    if (recentScans.length > 0) {
      const withIssue = recentScans.filter(_scanHasIssue).length;
      const issueRate = withIssue / recentScans.length; // 0..1
      const sub = _clamp(Math.round((1 - issueRate) * 100), 0, 100);
      factors.push({ key: 'openIssues', sub, weight: 3 });
      components.openIssues = Object.freeze({
        recentScans: recentScans.length,
        scansWithIssue: withIssue,
        subScore: sub
      });
      dataSources.push("localStorage 'farroway_scan_history_v1'");
    }

    // Factor B: task completion rate (done / total) from cached tasks
    if (cachedTasks.length > 0) {
      const done = cachedTasks.filter((t: any) => {
        return _safe(() => {
          if (!t || typeof t !== 'object') return false;
          if (t.completed === true || t.done === true || t.isComplete === true) return true;
          const st = String(t.status || t.state || '').toLowerCase();
          return /done|complete|completed|finished/.test(st);
        }, false);
      }).length;
      const rate = done / cachedTasks.length; // 0..1
      const sub = _clamp(Math.round(rate * 100), 0, 100);
      factors.push({ key: 'taskCompletion', sub, weight: 2 });
      components.taskCompletion = Object.freeze({
        totalTasks: cachedTasks.length,
        completedTasks: done,
        subScore: sub
      });
      dataSources.push("localStorage 'farroway_cached_tasks'");
    }

    // Factor C: follow-up scan rate (are people scanning again after an issue?)
    // Real signal: more than one scan over time = active monitoring.
    if (scanHistory.length >= 2) {
      const followUpSub = _clamp(50 + Math.min(scanHistory.length - 1, 5) * 10, 0, 100);
      factors.push({ key: 'followUpScans', sub: followUpSub, weight: 1 });
      components.followUpScans = Object.freeze({
        totalScans: scanHistory.length,
        subScore: followUpSub
      });
      if (dataSources.indexOf("localStorage 'farroway_scan_history_v1'") === -1) {
        dataSources.push("localStorage 'farroway_scan_history_v1'");
      }
    }

    // Factor D: worsening outcomes (from __outcomeHealth if present)
    const outcome = _probe('__outcomeHealth');
    const worseningCount = _safe(() => {
      if (!outcome || typeof outcome !== 'object') return null;
      const w = _num(outcome.worsening != null ? outcome.worsening : outcome.worseningCount);
      const total = _num(outcome.total != null ? outcome.total : outcome.totalOutcomes);
      if (w != null && total != null && total > 0) return { w, total };
      if (w != null) return { w, total: null as any };
      return null;
    }, null);
    if (worseningCount && worseningCount.total != null && worseningCount.total > 0) {
      const worseRate = _clamp(worseningCount.w / worseningCount.total, 0, 1);
      const sub = _clamp(Math.round((1 - worseRate) * 100), 0, 100);
      factors.push({ key: 'worseningOutcomes', sub, weight: 2 });
      components.worseningOutcomes = Object.freeze({
        worsening: worseningCount.w,
        totalOutcomes: worseningCount.total,
        subScore: sub
      });
      dataSources.push('window.__outcomeHealth()');
    }

    // Factor E: weather risk (overallRisk from __weatherRiskHealth)
    const weatherSub = _safe(() => {
      if (!weatherRisk || typeof weatherRisk !== 'object') return null;
      const raw = weatherRisk.overallRisk != null ? weatherRisk.overallRisk : weatherRisk.risk;
      // numeric 0..100 risk
      const n = _num(raw);
      if (n != null) {
        const riskPct = n <= 1 ? n * 100 : n; // tolerate 0..1 or 0..100
        return _clamp(Math.round(100 - riskPct), 0, 100);
      }
      // categorical risk
      const cat = String(raw || '').toLowerCase();
      if (/low/.test(cat)) return 85;
      if (/moderate|medium/.test(cat)) return 60;
      if (/high|severe|extreme/.test(cat)) return 30;
      return null;
    }, null);
    if (weatherSub != null) {
      factors.push({ key: 'weatherRisk', sub: weatherSub, weight: 1 });
      components.weatherRisk = Object.freeze({ subScore: weatherSub });
      dataSources.push('window.__weatherRiskHealth()');
    }

    // ---- Not enough data: be honest ----
    if (factors.length === 0) {
      const out = {
        runtimeVersion: 'farm-health-score-v1',
        initialized: true,
        score: null,
        label: 'Not enough data yet',
        components: Object.freeze({}),
        value: null,
        confidence: 'low' as Confidence,
        dataSources: Object.freeze([] as string[]),
        explanation:
          'Not enough data yet. We could not find any saved scans, tasks, weather, or outcome ' +
          'records to build a farm health score from. Once you start scanning plants and ' +
          'tracking tasks, a score will appear here. ' + GUARD,
        limitations:
          'No real farm data was available, so no score is shown. We never guess a number. ' + GUARD
      };
      return Object.freeze(out);
    }

    // ---- Weighted blend of available factors ----
    let weightedSum = 0;
    let weightTotal = 0;
    for (const f of factors) { weightedSum += f.sub * f.weight; weightTotal += f.weight; }
    const score = _clamp(Math.round(weightedSum / weightTotal), 0, 100);
    const label = _label(score);

    // Confidence scales with how many real factors we had.
    const confidence: Confidence = factors.length >= 4 ? 'high' : (factors.length >= 2 ? 'medium' : 'low');

    const factorNames = factors.map((f) => f.key).join(', ');
    const explanation =
      'Your farm health score is ' + score + ' (' + label + '). It blends the real signals we ' +
      'could find: ' + factorNames + '. A higher score means fewer open plant issues, more tasks ' +
      'kept up with, steady scanning, stable outcomes, and calmer weather. This is a simple guide ' +
      'to where to look first, not a diagnosis. ' + GUARD;

    const limitations =
      'Built from only ' + factors.length + ' signal' + (factors.length === 1 ? '' : 's') +
      ' that you have recorded so far. The score cannot see anything not saved in the app, ' +
      'and weather and scan data may be out of date. Use it as gentle guidance. ' + GUARD;

    const out = {
      runtimeVersion: 'farm-health-score-v1',
      initialized: true,
      score,
      label,
      components: Object.freeze(components),
      value: score,
      confidence,
      dataSources: Object.freeze(dataSources.slice()),
      explanation,
      limitations
    };
    return Object.freeze(out);
  }, Object.freeze({
    runtimeVersion: 'farm-health-score-v1',
    initialized: true,
    score: null,
    label: 'Not enough data yet',
    components: Object.freeze({}),
    value: null,
    confidence: 'low' as Confidence,
    dataSources: Object.freeze([] as string[]),
    explanation: 'Not enough data yet. The farm health score is unavailable right now. ' + GUARD,
    limitations: 'No data could be read safely. ' + GUARD
  }));
}

export { farmHealthScoreHealth };

export function installFarmHealthScoreHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmHealthScoreHealth !== 'function') {
      w.__farmHealthScoreHealth = function () {
        const out = farmHealthScoreHealth();
        try { const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV; if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Farm Health Score]', out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
