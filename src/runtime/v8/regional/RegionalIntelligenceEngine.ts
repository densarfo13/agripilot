/**
 * Farroway · Regional Intelligence Engine (regional-intelligence-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * regional data or outbreaks.
 *
 * It summarizes coarse RISK CATEGORIES for the active farm's region — disease,
 * pest, weather watch — and a careful outbreak SIGNAL. Every reading is derived
 * from REAL stored signals on THIS device/org only; when a signal is absent the
 * reading is honestly reported as 'unknown'. It NEVER reads another tenant's
 * data, never calls the network, and never declares a confirmed outbreak.
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
type OutbreakSignal = 'none' | 'watch' | 'emerging' | 'unknown';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// Minimum number of REAL records before any regional category is reported.
// Below this the engine stays honestly silent ('unknown').
const MIN_REGIONAL_DATA_POINTS = 5;

// --- regional-specific pure helpers (never throw) -------------------------

function _str(v: any): string {
  return _safe(() => (v == null ? '' : String(v)), '');
}

function _num(v: any): number {
  return _safe(() => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, NaN);
}

// Reads a record timestamp into epoch ms, or NaN when absent/unparseable.
function _recordTime(rec: any): number {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return NaN;
    const raw =
      r.timestamp ?? r.createdAt ?? r.scannedAt ?? r.date ?? r.loggedAt ?? null;
    if (raw == null) return NaN;
    const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return Number.isFinite(n) ? n : NaN;
  }, NaN);
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

// Maps a coarse 0..1 (or 0..100) severity reading to a risk category.
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

// Combines two categories, keeping the more cautious of the two.
function _combineRisk(a: Risk, b: Risk): Risk {
  return _safe(() => {
    const rank: Record<Risk, number> = { unknown: -1, low: 0, elevated: 1, high: 2 };
    if (a === 'unknown') return b;
    if (b === 'unknown') return a;
    return rank[a] >= rank[b] ? a : b;
  }, 'unknown');
}

// Returns a normalized disease label if a record mentions a disease finding,
// else ''. The normalized token is used to corroborate "same disease" signals.
function _diseaseToken(rec: any): string {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return '';
    const hay = [
      r.category, r.conditionCategory, r.type, r.kind, r.label, r.finding,
      r.diagnosis, r.disease, r.issue, r.condition, r.name, r.result,
      r.possibleDiseaseOrPest, r.noticed,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return '';
    const m = hay.match(/(blight|mildew|rust|rot|wilt|mold|mould|fungus|fungal|lesion|spot|infection|infected|canker|smut|anthracnose|mosaic|virus|disease)/);
    return m ? m[1] : '';
  }, '');
}

// Returns a normalized pest label if a record mentions a pest finding, else ''.
function _pestToken(rec: any): string {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return '';
    const hay = [
      r.category, r.conditionCategory, r.type, r.kind, r.label, r.finding,
      r.diagnosis, r.pest, r.issue, r.condition, r.name, r.result,
      r.possibleDiseaseOrPest, r.noticed,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return '';
    const m = hay.match(/(aphid|worm|borer|beetle|caterpillar|mite|larvae|locust|weevil|thrip|whitefly|armyworm|infestation|insect|pest)/);
    return m ? m[1] : '';
  }, '');
}

// Pulls a coarse severity number off a record if one exists (else NaN).
function _recordSeverity(rec: any): number {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return NaN;
    const candidates = [r.severity, r.severityScore, r.urgency, r.score, r.risk];
    for (let i = 0; i < candidates.length; i++) {
      const n = _num(candidates[i]);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  }, NaN);
}

export interface RegionalIntelligenceEnvelope {
  runtimeVersion: 'regional-intelligence-v1';
  initialized: true;
  value: {
    region: string;
    crop: string;
    diseaseRisk: Risk;
    pestRisk: Risk;
    weatherRisk: Risk;
    outbreakSignal: OutbreakSignal;
  };
  dataPoints: number;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export const REGIONAL_INTELLIGENCE_ENGINE_VERSION = 'regional-intelligence-v1';

export function regionalIntelligenceHealth(): RegionalIntelligenceEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ------------------
      // Read ONLY this device/org's own slots — never another tenant's data.
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const activeFarm = _obj(_ls('farroway_active_farm'));

      // --- probes (any may be null) ---------------------------------------
      const weatherRiskHealth = _probe('__weatherRiskHealth');
      const outcomeHealth = _probe('__outcomeHealth');

      // --- region (from the active farm's region/country) -----------------
      const region = _safe(() => {
        if (!activeFarm) return 'unknown';
        const f: any = activeFarm;
        const r = _str(f.region).trim() || _str(f.country).trim();
        return r ? r : 'unknown';
      }, 'unknown');

      // --- dominant crop (from managed plants, else scan history) ---------
      const crop = _safe(() => {
        const tally: Record<string, number> = {};
        const add = (raw: any) => {
          const c = _str(raw).trim();
          if (c) tally[c] = (tally[c] || 0) + 1;
        };
        for (let i = 0; i < managedPlants.length; i++) {
          const p = _obj(managedPlants[i]);
          if (!p) continue;
          add((p as any).crop ?? (p as any).plant ?? (p as any).plantName ?? (p as any).species ?? (p as any).cropName ?? (p as any).name);
        }
        if (Object.keys(tally).length === 0) {
          for (let i = 0; i < scanHistory.length; i++) {
            const s = _obj(scanHistory[i]);
            if (!s) continue;
            add((s as any).crop ?? (s as any).plantType ?? (s as any).plant ?? (s as any).cropName ?? (s as any).species);
          }
        }
        const names = Object.keys(tally);
        if (names.length === 0) return 'unknown';
        names.sort((a, b) => tally[b] - tally[a]);
        return names[0];
      }, 'unknown');

      // --- count REAL records that inform a regional read -----------------
      const dataPoints = _safe(
        () => scanHistory.length + eventLog.length,
        0,
      );

      // --- honest data sources (only what we actually saw / used) ---------
      const dataSources: string[] = [];
      if (scanHistory.length > 0) dataSources.push('farroway_scan_history_v1');
      if (managedPlants.length > 0) dataSources.push('farroway_managed_plants');
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (activeFarm) dataSources.push('farroway_active_farm');
      if (weatherRiskHealth) dataSources.push('__weatherRiskHealth');
      if (outcomeHealth) dataSources.push('__outcomeHealth');

      // --- limitations note (constant, honest) ----------------------------
      const limitations =
        'This only looks at what has been saved on this device and organization ' +
        'so far, and it shows coarse risk categories, not exact numbers, yields, ' +
        'or guaranteed results. It does not include other farms, other devices, ' +
        'deleted records, or anything you have not yet scanned or logged, and it ' +
        'is not a verified outbreak report or advice about chemicals or treatments. ' +
        'When information is missing, the reading is shown as "unknown" on purpose. ' +
        GUIDANCE_TAIL;

      // --- honest fallback: not enough regional data yet ------------------
      if (dataPoints < MIN_REGIONAL_DATA_POINTS) {
        return Object.freeze({
          runtimeVersion: 'regional-intelligence-v1' as const,
          initialized: true as const,
          value: Object.freeze({
            region,
            crop,
            diseaseRisk: 'unknown' as Risk,
            pestRisk: 'unknown' as Risk,
            weatherRisk: 'unknown' as Risk,
            outbreakSignal: 'unknown' as OutbreakSignal,
          }),
          dataPoints,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze(dataSources) as unknown as string[],
          explanation: 'Not enough regional data yet',
          limitations,
        }) as RegionalIntelligenceEnvelope;
      }

      // --- recency window (last 30 days) for corroboration ----------------
      // We use a record's OWN saved timestamp for recency — never a fresh
      // clock-seeded value as a data signal. The current time is used only as
      // a relative cutoff, and absence of a usable timestamp degrades safely.
      const nowMs = _safe(() => Date.now(), NaN);
      const RECENT_MS = 30 * 24 * 60 * 60 * 1000;
      const isRecent = (rec: any): boolean => {
        return _safe(() => {
          const t = _recordTime(rec);
          if (!Number.isFinite(t) || !Number.isFinite(nowMs)) return false;
          return nowMs - t <= RECENT_MS;
        }, false);
      };

      // --- DISEASE RISK + recent-disease corroboration --------------------
      const diseaseTokenCounts: Record<string, number> = {};
      let diseaseFound = false;
      let diseaseWorst: Risk = 'low';
      const scanDisease = (rec: any) => {
        const tok = _diseaseToken(rec);
        if (!tok) return;
        diseaseFound = true;
        const sev = _recordSeverity(rec);
        const fromSev = _riskFromSeverity(sev);
        diseaseWorst = _combineRisk(diseaseWorst, fromSev === 'unknown' ? 'elevated' : fromSev);
        if (isRecent(rec)) {
          diseaseTokenCounts[tok] = (diseaseTokenCounts[tok] || 0) + 1;
        }
      };
      for (let i = 0; i < scanHistory.length; i++) scanDisease(scanHistory[i]);
      for (let i = 0; i < eventLog.length; i++) scanDisease(eventLog[i]);
      const diseaseRisk: Risk = _safe(
        () => (diseaseFound ? diseaseWorst : 'low'),
        'unknown',
      );

      // --- PEST RISK + recent-pest corroboration --------------------------
      const pestTokenCounts: Record<string, number> = {};
      let pestFound = false;
      let pestWorst: Risk = 'low';
      const scanPest = (rec: any) => {
        const tok = _pestToken(rec);
        if (!tok) return;
        pestFound = true;
        const sev = _recordSeverity(rec);
        const fromSev = _riskFromSeverity(sev);
        pestWorst = _combineRisk(pestWorst, fromSev === 'unknown' ? 'elevated' : fromSev);
        if (isRecent(rec)) {
          pestTokenCounts[tok] = (pestTokenCounts[tok] || 0) + 1;
        }
      };
      for (let i = 0; i < scanHistory.length; i++) scanPest(scanHistory[i]);
      for (let i = 0; i < eventLog.length; i++) scanPest(eventLog[i]);
      const pestRisk: Risk = _safe(
        () => (pestFound ? pestWorst : 'low'),
        'unknown',
      );

      // --- WEATHER RISK: from the __weatherRiskHealth probe only ----------
      const weatherRisk: Risk = _safe(() => {
        if (!weatherRiskHealth) return 'unknown';
        const wr: any = weatherRiskHealth;
        const lvl = _riskFromLevelWord(wr.level ?? wr.riskLevel ?? wr.risk ?? wr.category);
        if (lvl !== 'unknown') return lvl;
        const sev = _riskFromSeverity(wr.severity ?? wr.score ?? wr.value);
        if (sev !== 'unknown') return sev;
        const flags = _arr(wr.flags ?? wr.alerts ?? wr.warnings);
        if (flags.length > 0) return 'elevated';
        return 'unknown';
      }, 'unknown');

      // --- OUTBREAK SIGNAL: careful, never a fake outbreak ----------------
      // 'emerging' requires MANY corroborating recent detections of the SAME
      // disease/pest token. Otherwise: 'watch' for a smaller cluster, 'none'
      // when findings exist but no recent cluster, 'unknown' with no findings.
      const outbreakSignal: OutbreakSignal = _safe(() => {
        const peakRecent = (counts: Record<string, number>) => {
          let peak = 0;
          const keys = Object.keys(counts);
          for (let i = 0; i < keys.length; i++) {
            if (counts[keys[i]] > peak) peak = counts[keys[i]];
          }
          return peak;
        };
        const topDisease = peakRecent(diseaseTokenCounts);
        const topPest = peakRecent(pestTokenCounts);
        const peak = Math.max(topDisease, topPest);

        if (!diseaseFound && !pestFound) return 'unknown';
        // Many corroborating recent detections of the same finding → emerging.
        if (peak >= 4) return 'emerging';
        // A smaller but real recent cluster → watch.
        if (peak >= 2) return 'watch';
        // Findings exist but no recent same-finding cluster → none.
        return 'none';
      }, 'unknown');

      // --- confidence: scales with real corroboration --------------------
      // Honest scaling: never 'high' without ample records and several
      // corroborating context signals.
      const knownCategories =
        (diseaseRisk !== 'unknown' ? 1 : 0) +
        (pestRisk !== 'unknown' ? 1 : 0) +
        (weatherRisk !== 'unknown' ? 1 : 0);

      const contextSignals =
        (region !== 'unknown' ? 1 : 0) +
        (crop !== 'unknown' ? 1 : 0) +
        (!!weatherRiskHealth ? 1 : 0) +
        (!!outcomeHealth ? 1 : 0);

      let confidence: Confidence = 'low';
      if (dataPoints >= 15 && knownCategories >= 2 && contextSignals >= 3) {
        confidence = 'high';
      } else if (dataPoints >= MIN_REGIONAL_DATA_POINTS && knownCategories >= 1 && contextSignals >= 1) {
        confidence = 'medium';
      }

      // --- plain-language, low-literacy-friendly explanation --------------
      const explanation = _safe(() => {
        const label = (r: Risk) => (r === 'unknown' ? 'not enough data yet' : r);
        const bits: string[] = [];
        const where = region !== 'unknown' ? ('in ' + region) : 'in your area';
        const what = crop !== 'unknown' ? (' for ' + crop) : '';
        bits.push('Based on what is saved on this device ' + where + what + ', here is the regional picture:');
        bits.push('Disease watch is ' + label(diseaseRisk) + '.');
        bits.push('Pest watch is ' + label(pestRisk) + '.');
        bits.push('Weather watch is ' + label(weatherRisk) + '.');
        if (outbreakSignal === 'emerging') {
          bits.push('Several recent scans point to the same problem — it may be wise to walk nearby fields and monitor closely.');
        } else if (outbreakSignal === 'watch') {
          bits.push('A few recent scans show a similar problem — keep watching, nothing is certain.');
        } else if (outbreakSignal === 'none') {
          bits.push('No clustered pattern stands out right now.');
        } else {
          bits.push('Keep scanning and logging to keep this regional picture clear.');
        }
        return bits.join(' ');
      }, 'Regional risk categories based on the real data saved on this device.');

      const value = {
        region,
        crop,
        diseaseRisk,
        pestRisk,
        weatherRisk,
        outbreakSignal,
      };

      return Object.freeze({
        runtimeVersion: 'regional-intelligence-v1' as const,
        initialized: true as const,
        value: Object.freeze(value),
        dataPoints,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as RegionalIntelligenceEnvelope;
    },
    // --- absolute fallback if anything above throws ---------------------
    Object.freeze({
      runtimeVersion: 'regional-intelligence-v1' as const,
      initialized: true as const,
      value: Object.freeze({
        region: 'unknown',
        crop: 'unknown',
        diseaseRisk: 'unknown' as Risk,
        pestRisk: 'unknown' as Risk,
        weatherRisk: 'unknown' as Risk,
        outbreakSignal: 'unknown' as OutbreakSignal,
      }),
      dataPoints: 0,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough regional data yet',
      limitations:
        'This only looks at what has been saved on this device and organization ' +
        'so far, and it shows coarse risk categories, not exact numbers or ' +
        'guaranteed results. ' +
        GUIDANCE_TAIL,
    }) as RegionalIntelligenceEnvelope,
  );
}

export function installRegionalIntelligenceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__regionalIntelligenceHealth !== 'function') {
      w.__regionalIntelligenceHealth = function () {
        const out = regionalIntelligenceHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Regional Intelligence]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
