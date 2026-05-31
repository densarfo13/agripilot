// YieldReadinessEngine.ts
// Composition-only decision-support runtime. SELF-CONTAINED: no project imports.
// Reads ONLY from window probe globals and localStorage. Pure, SSR-safe, never throws.
// HARD RULE: outputs a READINESS LABEL only ('LOW'|'MEDIUM'|'HIGH'|'UNKNOWN').
// NEVER outputs tons/acre, bags/acre, kg, revenue, or any numeric yield forecast.

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
const READINESS_NOTE = 'This is a readiness signal, not a yield forecast.';

type Readiness = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
type Confidence = 'low' | 'medium' | 'high';

interface YieldReadinessEnvelope {
  runtimeVersion: 'yield-readiness-v1';
  initialized: true;
  readiness: Readiness;
  value: Readiness;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

function _isArr(v: any): v is any[] { return Array.isArray(v); }
function _num(v: any): number | null {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN);
  return (typeof n === 'number' && isFinite(n)) ? n : null;
}

// Read a possible weather snapshot (probe first, then global object).
function _readWeather(): any {
  const probe = _probe('__weatherRiskHealth');
  if (probe && typeof probe === 'object') return probe;
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return (w.__farrowayLastWeather && typeof w.__farrowayLastWeather === 'object') ? w.__farrowayLastWeather : null;
  }, null);
}

function _frozenFallback(reason: string, sources: string[]): YieldReadinessEnvelope {
  const explanation =
    'Not enough data yet to read field readiness. ' + reason + ' ' +
    READINESS_NOTE + ' ' + GUIDANCE_TAIL;
  return Object.freeze({
    runtimeVersion: 'yield-readiness-v1',
    initialized: true,
    readiness: 'UNKNOWN',
    value: 'UNKNOWN',
    confidence: 'low',
    dataSources: Object.freeze(sources.slice()) as unknown as string[],
    explanation,
    limitations:
      'Readiness is a calm support signal from stored data only. It does not predict harvest size, ' +
      'weight, bags, or money, and it is not agronomic advice.',
  }) as YieldReadinessEnvelope;
}

export function yieldReadinessHealth(): YieldReadinessEnvelope {
  return _safe(() => {
    const sources: string[] = [];

    // ---- Inputs (all defensive; any may be absent) ----
    const farm = _ls('farroway_active_farm');
    const scanHistory = _ls('farroway_scan_history_v1');
    const cachedTasks = _ls('farroway_cached_tasks');
    const eventLog = _ls('farroway_event_log');
    const weather = _readWeather();
    const scanProbe = _probe('__scanResultHealth');
    const taskProbe = _probe('__taskStoreHealth');

    // Each "signal" contributes a normalized score in [0,1] plus a weight.
    // We only count a signal if its underlying real data is present.
    const signals: { score: number; weight: number }[] = [];

    // ---- 1. Crop stage + planting date (from active farm) ----
    // Older planting date => crop closer to maturity => more "ready".
    let haveStageSignal = false;
    if (farm && typeof farm === 'object') {
      const plantingRaw =
        (farm as any).plantingDate ?? (farm as any).planting_date ??
        (farm as any).plantedAt ?? (farm as any).sowingDate ?? null;
      const stageRaw =
        (farm as any).cropStage ?? (farm as any).stage ??
        (farm as any).growthStage ?? null;

      let plantedScore: number | null = null;
      if (plantingRaw != null) {
        const t = _safe(() => new Date(plantingRaw).getTime(), NaN);
        if (typeof t === 'number' && isFinite(t)) {
          const days = (Date.now() - t) / 86400000;
          if (days >= 0 && days < 400) {
            // 0 days -> 0 (just planted), ~120+ days -> ~1 (mature-ish).
            plantedScore = Math.max(0, Math.min(1, days / 120));
          }
        }
      }

      let stageScore: number | null = null;
      if (typeof stageRaw === 'string' && stageRaw.trim()) {
        const s = stageRaw.toLowerCase();
        if (/(harvest|matur|ripe|ready)/.test(s)) stageScore = 1;
        else if (/(flower|fruit|head|reproduct|grain|pod|cob|ear|bloom)/.test(s)) stageScore = 0.75;
        else if (/(veget|tiller|grow|establish)/.test(s)) stageScore = 0.45;
        else if (/(seed|germ|sprout|emerg|plant|sow)/.test(s)) stageScore = 0.2;
        else stageScore = 0.5; // known stage, but unmapped wording
      }

      if (plantedScore != null || stageScore != null) {
        haveStageSignal = true;
        sources.push('farroway_active_farm');
        let combined: number;
        if (plantedScore != null && stageScore != null) {
          combined = (plantedScore + stageScore) / 2;
        } else {
          combined = (plantedScore != null ? plantedScore : (stageScore as number));
        }
        signals.push({ score: combined, weight: 0.30 });
      }
    }

    // ---- 2. Scan health (recent scan confidence) ----
    // Higher recent scan confidence (healthier-looking crop) => more ready.
    let haveScanSignal = false;
    let scanScore: number | null = null;

    if (scanProbe && typeof scanProbe === 'object') {
      const c = _num((scanProbe as any).confidence) ??
                _num((scanProbe as any).score) ??
                _num((scanProbe as any).health);
      if (c != null) scanScore = c > 1 ? Math.min(1, c / 100) : Math.max(0, Math.min(1, c));
    }
    if (scanScore == null && _isArr(scanHistory) && scanHistory.length > 0) {
      // Use the most recent scan(s) with a numeric confidence.
      const recent = scanHistory.slice(-3);
      const vals: number[] = [];
      for (const s of recent) {
        if (s && typeof s === 'object') {
          const c = _num((s as any).confidence) ?? _num((s as any).score) ?? _num((s as any).health);
          if (c != null) vals.push(c > 1 ? Math.min(1, c / 100) : Math.max(0, Math.min(1, c)));
        }
      }
      if (vals.length) scanScore = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    if (scanScore != null) {
      haveScanSignal = true;
      if (scanProbe && typeof scanProbe === 'object') sources.push('window.__scanResultHealth');
      if (_isArr(scanHistory) && scanHistory.length > 0) sources.push('farroway_scan_history_v1');
      signals.push({ score: Math.max(0, Math.min(1, scanScore)), weight: 0.25 });
    }

    // ---- 3. Task completion ----
    // More tasks done => field better managed => more ready.
    let haveTaskSignal = false;
    let taskScore: number | null = null;

    if (taskProbe && typeof taskProbe === 'object') {
      const done = _num((taskProbe as any).completed) ?? _num((taskProbe as any).done);
      const total = _num((taskProbe as any).total) ?? _num((taskProbe as any).count);
      const ratio = _num((taskProbe as any).completionRate) ?? _num((taskProbe as any).ratio);
      if (ratio != null) taskScore = ratio > 1 ? Math.min(1, ratio / 100) : Math.max(0, Math.min(1, ratio));
      else if (done != null && total != null && total > 0) taskScore = Math.max(0, Math.min(1, done / total));
    }
    if (taskScore == null && _isArr(cachedTasks) && cachedTasks.length > 0) {
      let done = 0;
      for (const t of cachedTasks) {
        if (t && typeof t === 'object') {
          const st = ((t as any).status ?? (t as any).state ?? '').toString().toLowerCase();
          if ((t as any).completed === true || (t as any).done === true || /(done|complete|finished)/.test(st)) done++;
        }
      }
      taskScore = Math.max(0, Math.min(1, done / cachedTasks.length));
    }
    if (taskScore != null) {
      haveTaskSignal = true;
      if (taskProbe && typeof taskProbe === 'object') sources.push('window.__taskStoreHealth');
      if (_isArr(cachedTasks) && cachedTasks.length > 0) sources.push('farroway_cached_tasks');
      signals.push({ score: taskScore, weight: 0.20 });
    }

    // ---- 4. Weather risk ----
    // Higher current risk lowers readiness (calm, soft penalty).
    let haveWeatherSignal = false;
    let weatherScore: number | null = null;
    if (weather && typeof weather === 'object') {
      const directRisk = _num((weather as any).risk) ?? _num((weather as any).riskScore) ?? _num((weather as any).riskLevel);
      if (directRisk != null) {
        const r = directRisk > 1 ? Math.min(1, directRisk / 100) : Math.max(0, Math.min(1, directRisk));
        weatherScore = 1 - r; // invert: high risk -> low readiness contribution
      } else {
        // Derive a gentle risk proxy from snapshot fields if present.
        const rain = _num((weather as any).rainChance);
        const wind = _num((weather as any).windKph);
        const type = ((weather as any).weatherType ?? '').toString().toLowerCase();
        let risk = 0;
        let any = false;
        if (rain != null) { risk = Math.max(risk, rain > 1 ? rain / 100 : rain); any = true; }
        if (wind != null) { risk = Math.max(risk, Math.min(1, wind / 60)); any = true; }
        if (type) { any = true; if (/(storm|flood|hail|heavy|severe)/.test(type)) risk = Math.max(risk, 0.85); }
        if (any) weatherScore = 1 - Math.max(0, Math.min(1, risk));
      }
    }
    if (weatherScore != null) {
      haveWeatherSignal = true;
      sources.push(
        _probe('__weatherRiskHealth') && typeof _probe('__weatherRiskHealth') === 'object'
          ? 'window.__weatherRiskHealth'
          : 'window.__farrowayLastWeather'
      );
      signals.push({ score: Math.max(0, Math.min(1, weatherScore)), weight: 0.15 });
    }

    // ---- 5. Pest / disease pressure ----
    // More recent pest/disease events => higher pressure => lower readiness.
    let havePressureSignal = false;
    let pressureScore: number | null = null;
    if (_isArr(eventLog) && eventLog.length > 0) {
      const now = Date.now();
      const windowMs = 30 * 86400000; // last 30 days
      let pressureEvents = 0;
      let recentTotal = 0;
      for (const e of eventLog) {
        if (!e || typeof e !== 'object') continue;
        const ts = _safe(() => new Date((e as any).at ?? (e as any).timestamp ?? (e as any).date ?? (e as any).createdAt).getTime(), NaN);
        const isRecent = (typeof ts === 'number' && isFinite(ts)) ? (now - ts) <= windowMs : true;
        if (!isRecent) continue;
        recentTotal++;
        const text = JSON.stringify(e).toLowerCase();
        if (/(pest|disease|blight|fungus|infest|mildew|rot|aphid|worm|outbreak|infection)/.test(text)) pressureEvents++;
      }
      if (recentTotal > 0) {
        havePressureSignal = true;
        sources.push('farroway_event_log');
        // Saturate: a few pressure events already meaningfully lower readiness.
        const pressure = Math.max(0, Math.min(1, pressureEvents / 3));
        pressureScore = 1 - pressure;
        signals.push({ score: pressureScore, weight: 0.10 });
      }
    }

    // ---- Require minimum real data: stage info plus at least one supporting signal ----
    const supportingCount =
      (haveScanSignal ? 1 : 0) + (haveTaskSignal ? 1 : 0) +
      (haveWeatherSignal ? 1 : 0) + (havePressureSignal ? 1 : 0);

    if (!haveStageSignal && supportingCount < 2) {
      return _frozenFallback(
        'Add your planting date and crop stage, run a crop scan, and log a few tasks so we can read readiness.',
        sources
      );
    }
    if (signals.length === 0) {
      return _frozenFallback(
        'No usable stored signals were found yet.',
        sources
      );
    }

    // ---- Weighted readiness score ----
    let weighted = 0;
    let weightSum = 0;
    for (const s of signals) { weighted += s.score * s.weight; weightSum += s.weight; }
    const finalScore = weightSum > 0 ? weighted / weightSum : 0;

    let readiness: Readiness;
    if (finalScore >= 0.66) readiness = 'HIGH';
    else if (finalScore >= 0.4) readiness = 'MEDIUM';
    else readiness = 'LOW';

    // ---- Confidence from breadth + presence of stage anchor ----
    const signalCount = signals.length;
    let confidence: Confidence;
    if (haveStageSignal && signalCount >= 4) confidence = 'high';
    else if (signalCount >= 3 || (haveStageSignal && signalCount >= 2)) confidence = 'medium';
    else confidence = 'low';

    const readableSources = Array.from(new Set(sources));

    let plain: string;
    if (readiness === 'HIGH') {
      plain = 'Your stored signals look strong, so the field reads as more ready right now.';
    } else if (readiness === 'MEDIUM') {
      plain = 'Your stored signals are mixed, so the field reads as partly ready right now.';
    } else {
      plain = 'Your stored signals are weak right now, so the field reads as less ready. There is time to act on tasks and scans.';
    }

    const explanation =
      plain + ' This reading uses your planting and stage details, recent scans, task progress, ' +
      'weather, and any pest or disease notes you saved. ' +
      READINESS_NOTE + ' ' + GUIDANCE_TAIL;

    const limitations =
      'Based only on the data saved on this device' +
      (confidence === 'low' ? ', and only a few signals were available' : '') +
      '. It does not predict harvest size, weight, bags, or money, and it is not a substitute for ' +
      'in-person inspection or local agronomy advice. Keep scans and tasks up to date for a clearer signal.';

    return Object.freeze({
      runtimeVersion: 'yield-readiness-v1',
      initialized: true,
      readiness,
      value: readiness,
      confidence,
      dataSources: Object.freeze(readableSources) as unknown as string[],
      explanation,
      limitations,
    }) as YieldReadinessEnvelope;
  }, _frozenFallback('A reading could not be completed safely.', []));
}

export function installYieldReadinessHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__yieldReadinessHealth !== 'function') {
      w.__yieldReadinessHealth = function () {
        const out = yieldReadinessHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Yield Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
