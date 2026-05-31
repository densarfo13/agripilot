/**
 * Farroway · Predictive Risk Engine (predictive-risk-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` helpers below, and never fabricates data.
 *
 * It predicts RISK CATEGORIES only — never guaranteed outcomes, never exact
 * yield or revenue. Every category is derived from REAL stored signals; if a
 * signal is absent, the risk is honestly reported as 'unknown'.
 */

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

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';
type Risk = 'low' | 'elevated' | 'high' | 'unknown';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// --- risk-specific pure helpers (never throw) ----------------------------

function _str(v: any): string {
  return _safe(() => (v == null ? '' : String(v)), '');
}

function _num(v: any): number {
  return _safe(() => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, NaN);
}

// Maps a coarse 0..1 (or 0..100) severity reading to a risk category.
// Returns 'unknown' when the reading is not a usable number.
function _riskFromSeverity(raw: any): Risk {
  return _safe(() => {
    let n = _num(raw);
    if (!Number.isFinite(n)) return 'unknown';
    if (n > 1) n = n / 100; // tolerate 0..100 scale
    if (n < 0) return 'unknown';
    if (n >= 0.6) return 'high';
    if (n >= 0.3) return 'elevated';
    return 'low';
  }, 'unknown');
}

// Maps a free-text level word ('low'/'moderate'/'high'/...) to a category.
function _riskFromLevelWord(raw: any): Risk {
  return _safe(() => {
    const w = _str(raw).trim().toLowerCase();
    if (!w) return 'unknown';
    if (/(severe|critical|high|danger)/.test(w)) return 'high';
    if (/(elevated|moderate|medium|watch|caution|warn)/.test(w)) return 'elevated';
    if (/(low|calm|clear|none|nominal|safe|ok)/.test(w)) return 'low';
    return 'unknown';
  }, 'unknown');
}

// Combines two categories, keeping the more cautious of the two.
// 'unknown' yields to any known reading; otherwise high > elevated > low.
function _combineRisk(a: Risk, b: Risk): Risk {
  return _safe(() => {
    const rank: Record<Risk, number> = { unknown: -1, low: 0, elevated: 1, high: 2 };
    if (a === 'unknown') return b;
    if (b === 'unknown') return a;
    return rank[a] >= rank[b] ? a : b;
  }, 'unknown');
}

// Detects whether a scan/event record mentions a disease finding.
function _looksLikeDisease(rec: any): boolean {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return false;
    const hay = [
      r.category, r.type, r.kind, r.label, r.finding, r.diagnosis,
      r.disease, r.issue, r.condition, r.name, r.result,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return false;
    return /(disease|blight|mildew|rust|rot|wilt|mold|mould|fungus|fungal|lesion|spot|infection|infected|canker|smut|anthracnose)/.test(hay);
  }, false);
}

// Detects whether a scan/event record mentions a pest finding.
function _looksLikePest(rec: any): boolean {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return false;
    const hay = [
      r.category, r.type, r.kind, r.label, r.finding, r.diagnosis,
      r.pest, r.issue, r.condition, r.name, r.result,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return false;
    return /(pest|insect|aphid|worm|borer|beetle|caterpillar|mite|larvae|locust|weevil|thrip|whitefly|armyworm|infestation)/.test(hay);
  }, false);
}

// Pulls a coarse severity number off a record if one exists (else NaN).
function _recordSeverity(rec: any): number {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return NaN;
    const candidates = [r.severity, r.severityScore, r.confidence, r.score, r.risk];
    for (let i = 0; i < candidates.length; i++) {
      const n = _num(candidates[i]);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  }, NaN);
}

export interface PredictiveRiskEnvelope {
  runtimeVersion: 'predictive-risk-v1';
  initialized: true;
  scanHistoryReady: boolean;
  weatherContextReady: boolean;
  trendContextReady: boolean;
  taskContextReady: boolean;
  outcomeContextReady: boolean;
  cropStageContextReady: boolean;
  value: {
    diseaseRisk: Risk;
    pestRisk: Risk;
    weatherRisk: Risk;
    cropStressRisk: Risk;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export const PREDICTIVE_RISK_ENGINE_VERSION = 'predictive-risk-v1';

export function predictiveHealth(): PredictiveRiskEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const cachedTasks = _arr(_ls('farroway_cached_tasks'));
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- probes (any may be null) ---
      const weatherRiskHealth = _probe('__weatherRiskHealth');
      const trendHealth = _probe('__trendHealth');
      const severityHealth = _probe('__severityHealth');
      const cropMemoryHealth = _probe('__cropMemoryHealth');
      const outcomeHealth = _probe('__outcomeHealth');
      const taskStoreHealth = _probe('__taskStoreHealth');
      const growthStageHealth = _probe('__growthStageHealth');

      // --- readiness flags reflecting which REAL inputs exist ---
      const scanHistoryReady = scanHistory.length > 0;

      const weatherContextReady = _safe(
        () => !!weatherRiskHealth || !!(lastWeather && (lastWeather.snapshotAt || lastWeather.weather || lastWeather.humidity != null)),
        false,
      );

      const trendContextReady = !!trendHealth;

      const taskStoreInitialized = _safe(
        () => !!(taskStoreHealth && (taskStoreHealth as any).initialized === true),
        false,
      );
      const taskContextReady = cachedTasks.length > 0 || taskStoreInitialized;

      const outcomeContextReady = !!outcomeHealth;

      const cropStageContextReady = _safe(() => {
        if (growthStageHealth) return true;
        if (!activeFarm) return false;
        const f: any = activeFarm;
        return !!(f.crop || f.cropStage || f.lifecycleStage);
      }, false);

      // --- honest data sources (only what we actually saw / used) ---
      const dataSources: string[] = [];
      if (scanHistoryReady) dataSources.push('farroway_scan_history_v1');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (taskContextReady && cachedTasks.length > 0) dataSources.push('farroway_cached_tasks');
      if (lastWeather && (lastWeather.snapshotAt || lastWeather.weather || lastWeather.humidity != null))
        dataSources.push('window.__farrowayLastWeather');
      if (weatherRiskHealth) dataSources.push('__weatherRiskHealth');
      if (trendHealth) dataSources.push('__trendHealth');
      if (severityHealth) dataSources.push('__severityHealth');
      if (cropMemoryHealth) dataSources.push('__cropMemoryHealth');
      if (outcomeHealth) dataSources.push('__outcomeHealth');
      if (taskStoreInitialized) dataSources.push('__taskStoreHealth');
      if (growthStageHealth) dataSources.push('__growthStageHealth');
      if (cropStageContextReady && activeFarm) dataSources.push('farroway_active_farm');

      // --- limitations note (constant, honest) ---
      const limitations =
        'This only looks at what has been saved on this device so far, and it ' +
        'shows risk categories, not exact numbers or guaranteed results. It does ' +
        'not include other devices, deleted records, or anything you have not yet ' +
        'scanned or logged, and it is not advice about chemicals or treatments. ' +
        'When information is missing, the risk is shown as "unknown" on purpose. ' +
        GUIDANCE_TAIL;

      // --- honest empty fallback ---
      const anySignal =
        scanHistoryReady ||
        weatherContextReady ||
        trendContextReady ||
        taskContextReady ||
        outcomeContextReady ||
        cropStageContextReady ||
        eventLog.length > 0 ||
        !!severityHealth ||
        !!cropMemoryHealth;

      if (!anySignal) {
        return Object.freeze({
          runtimeVersion: 'predictive-risk-v1' as const,
          initialized: true as const,
          scanHistoryReady: false,
          weatherContextReady: false,
          trendContextReady: false,
          taskContextReady: false,
          outcomeContextReady: false,
          cropStageContextReady: false,
          value: Object.freeze({
            diseaseRisk: 'unknown' as Risk,
            pestRisk: 'unknown' as Risk,
            weatherRisk: 'unknown' as Risk,
            cropStressRisk: 'unknown' as Risk,
          }),
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation: 'Not enough data yet — scan a plant or check the weather to start.',
          limitations,
        }) as PredictiveRiskEnvelope;
      }

      // --- weather humidity hint (coarse, real only) ---
      const humidityHint = _safe(() => {
        if (!lastWeather) return NaN;
        const h = _num((lastWeather as any).humidity ?? (lastWeather as any).relativeHumidity);
        return Number.isFinite(h) ? h : NaN;
      }, NaN);
      const humidHigh = Number.isFinite(humidityHint) && humidityHint > 80;

      // --- DISEASE RISK: from scan/event findings + recent humidity ---
      const diseaseRisk: Risk = _safe(() => {
        if (!scanHistoryReady && eventLog.length === 0) return 'unknown';
        let found = false;
        let worst: Risk = 'low';
        const scan = (rec: any) => {
          if (_looksLikeDisease(rec)) {
            found = true;
            const sev = _recordSeverity(rec);
            const fromSev = _riskFromSeverity(sev);
            worst = _combineRisk(worst, fromSev === 'unknown' ? 'elevated' : fromSev);
          }
        };
        for (let i = 0; i < scanHistory.length; i++) scan(scanHistory[i]);
        for (let i = 0; i < eventLog.length; i++) scan(eventLog[i]);
        if (!found) {
          // No disease findings: only meaningful if we actually have scans.
          if (!scanHistoryReady) return 'unknown';
          // High humidity alone can nudge a watch state, but stays modest.
          return humidHigh ? 'elevated' : 'low';
        }
        // Found at least one disease finding; humid weather can corroborate.
        if (humidHigh) worst = _combineRisk(worst, 'elevated');
        return worst;
      }, 'unknown');

      // --- PEST RISK: from scan/event findings ---
      const pestRisk: Risk = _safe(() => {
        if (!scanHistoryReady && eventLog.length === 0) return 'unknown';
        let found = false;
        let worst: Risk = 'low';
        const scan = (rec: any) => {
          if (_looksLikePest(rec)) {
            found = true;
            const sev = _recordSeverity(rec);
            const fromSev = _riskFromSeverity(sev);
            worst = _combineRisk(worst, fromSev === 'unknown' ? 'elevated' : fromSev);
          }
        };
        for (let i = 0; i < scanHistory.length; i++) scan(scanHistory[i]);
        for (let i = 0; i < eventLog.length; i++) scan(eventLog[i]);
        if (!found) return scanHistoryReady ? 'low' : 'unknown';
        return worst;
      }, 'unknown');

      // --- WEATHER RISK: prefer probe, else coarse from last weather ---
      const weatherRisk: Risk = _safe(() => {
        if (weatherRiskHealth) {
          const wr: any = weatherRiskHealth;
          const lvl =
            _riskFromLevelWord(wr.level ?? wr.riskLevel ?? wr.risk ?? wr.category);
          if (lvl !== 'unknown') return lvl;
          // Try a numeric severity if a level word was not present.
          const sev = _riskFromSeverity(wr.severity ?? wr.score ?? wr.value);
          if (sev !== 'unknown') return sev;
          // Coarse flag-based read: any active alert flag → elevated.
          const flags = _arr(wr.flags ?? wr.alerts ?? wr.warnings);
          if (flags.length > 0) return 'elevated';
        }
        if (lastWeather) {
          // Coarse, honest read from a real snapshot only.
          let r: Risk = 'unknown';
          const lvl = _riskFromLevelWord(
            (lastWeather as any).riskLevel ?? (lastWeather as any).alert ?? (lastWeather as any).condition,
          );
          if (lvl !== 'unknown') r = lvl;
          if (humidHigh) r = _combineRisk(r === 'unknown' ? 'low' : r, 'elevated');
          return r;
        }
        return 'unknown';
      }, 'unknown');

      // --- CROP STRESS RISK: worsening trend + task gaps + weather ---
      const cropStressRisk: Risk = _safe(() => {
        let r: Risk = 'unknown';
        let signals = 0;

        // (1) Worsening trend probe.
        if (trendHealth) {
          const th: any = trendHealth;
          const dir = _str(th.direction ?? th.trend ?? th.slope).toLowerCase();
          const worsening = /(worsen|declin|down|negative|deteriorat|falling)/.test(dir);
          const improving = /(improv|up|positive|recover|rising|better)/.test(dir);
          const lvl = _riskFromLevelWord(th.level ?? th.riskLevel ?? th.status);
          if (worsening) {
            r = _combineRisk(r === 'unknown' ? 'low' : r, 'elevated');
            signals++;
          } else if (improving) {
            r = _combineRisk(r === 'unknown' ? 'low' : r, 'low');
            signals++;
          } else if (lvl !== 'unknown') {
            r = _combineRisk(r === 'unknown' ? 'low' : r, lvl);
            signals++;
          }
        }

        // (2) Task-completion gaps from cached tasks.
        if (cachedTasks.length > 0) {
          let overdue = 0;
          let incomplete = 0;
          for (let i = 0; i < cachedTasks.length; i++) {
            const t = _obj(cachedTasks[i]);
            if (!t) continue;
            const done = !!(t.done ?? t.completed ?? t.complete ?? (_str(t.status).toLowerCase() === 'done'));
            if (!done) incomplete++;
            const statusOverdue = /(overdue|missed|late)/.test(_str(t.status).toLowerCase());
            if (statusOverdue) overdue++;
          }
          if (overdue >= 1 || incomplete >= 3) {
            r = _combineRisk(r === 'unknown' ? 'low' : r, 'elevated');
            signals++;
          } else if (incomplete > 0) {
            r = _combineRisk(r === 'unknown' ? 'low' : r, 'low');
            signals++;
          }
        }

        // (3) Weather corroboration (humid spells can stress crops).
        if (Number.isFinite(humidityHint)) {
          if (humidHigh) {
            r = _combineRisk(r === 'unknown' ? 'low' : r, 'elevated');
          }
          signals++;
        } else if (weatherRisk !== 'unknown') {
          r = _combineRisk(r === 'unknown' ? 'low' : r, weatherRisk === 'high' ? 'elevated' : weatherRisk);
          signals++;
        }

        // Need at least one real contributing signal to say anything.
        return signals > 0 ? r : 'unknown';
      }, 'unknown');

      // --- confidence: scales with how many REAL inputs corroborate ---
      // Honest scaling: never 'high' without several corroborating signals.
      const knownCategories =
        (diseaseRisk !== 'unknown' ? 1 : 0) +
        (pestRisk !== 'unknown' ? 1 : 0) +
        (weatherRisk !== 'unknown' ? 1 : 0) +
        (cropStressRisk !== 'unknown' ? 1 : 0);

      const readySignals =
        (scanHistoryReady ? 1 : 0) +
        (weatherContextReady ? 1 : 0) +
        (trendContextReady ? 1 : 0) +
        (taskContextReady ? 1 : 0) +
        (outcomeContextReady ? 1 : 0) +
        (cropStageContextReady ? 1 : 0);

      let confidence: Confidence = 'low';
      if (readySignals >= 4 && knownCategories >= 3 && scanHistoryReady && weatherContextReady) {
        confidence = 'high';
      } else if (readySignals >= 2 && knownCategories >= 1) {
        confidence = 'medium';
      }

      // --- plain-language, low-literacy-friendly explanation ---
      const explanation = _safe(() => {
        const label = (r: Risk) =>
          r === 'unknown' ? 'not enough data yet' : r;
        const bits: string[] = [];
        bits.push(
          'Based on what is saved on this device, here is how things look right now:',
        );
        bits.push('Disease watch is ' + label(diseaseRisk) + '.');
        bits.push('Pest watch is ' + label(pestRisk) + '.');
        bits.push('Weather watch is ' + label(weatherRisk) + '.');
        bits.push('Crop stress watch is ' + label(cropStressRisk) + '.');
        if (diseaseRisk === 'high' || pestRisk === 'high' || cropStressRisk === 'high' || weatherRisk === 'high') {
          bits.push('It may be wise to walk your field and monitor closely.');
        } else if (
          diseaseRisk === 'elevated' || pestRisk === 'elevated' ||
          cropStressRisk === 'elevated' || weatherRisk === 'elevated'
        ) {
          bits.push('Keep watching — things look a little raised, not certain.');
        } else {
          bits.push('Keep scanning and logging to keep this picture clear.');
        }
        return bits.join(' ');
      }, 'Risk categories based on the real data saved on this device.');

      const value = {
        diseaseRisk,
        pestRisk,
        weatherRisk,
        cropStressRisk,
      };

      return Object.freeze({
        runtimeVersion: 'predictive-risk-v1' as const,
        initialized: true as const,
        scanHistoryReady,
        weatherContextReady,
        trendContextReady,
        taskContextReady,
        outcomeContextReady,
        cropStageContextReady,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as PredictiveRiskEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'predictive-risk-v1' as const,
      initialized: true as const,
      scanHistoryReady: false,
      weatherContextReady: false,
      trendContextReady: false,
      taskContextReady: false,
      outcomeContextReady: false,
      cropStageContextReady: false,
      value: Object.freeze({
        diseaseRisk: 'unknown' as Risk,
        pestRisk: 'unknown' as Risk,
        weatherRisk: 'unknown' as Risk,
        cropStressRisk: 'unknown' as Risk,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough data yet — scan a plant or check the weather to start.',
      limitations:
        'This only looks at what has been saved on this device so far, and it ' +
        'shows risk categories, not exact numbers or guaranteed results. ' +
        GUIDANCE_TAIL,
    }) as PredictiveRiskEnvelope,
  );
}

export function installPredictiveHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__predictiveHealth !== 'function') {
      w.__predictiveHealth = function () {
        const out = predictiveHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Predictive Risk]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
