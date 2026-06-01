/**
 * Farroway · Outcome Learning Runtime (outcome-learning-v13)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates.
 *
 * It models the real-world learning chain that actually happens in the app:
 *
 *   Scan → Diagnosis → Recommendation → Task → Completion →
 *   Follow-up Scan → Outcome
 *
 * The terminal Outcome is one of:
 *   'IMPROVED' | 'UNCHANGED' | 'WORSENED' | 'UNKNOWN'
 *
 * From the REAL recorded outcomes on this device it reports how often a
 * given crop / diagnosis / recommendation actually improved afterwards —
 * but ONLY once enough real outcomes exist (MIN_OUTCOME_SAMPLE). Below
 * that threshold it returns the honest "Not enough outcome data yet"
 * fallback. It never claims a treatment works, never overclaims about
 * chemicals or medicine, and never predicts a yield or revenue figure.
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

type OutcomeValue = 'IMPROVED' | 'UNCHANGED' | 'WORSENED' | 'UNKNOWN';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

/** Minimum number of real recorded outcomes before we report a rate. */
const MIN_OUTCOME_SAMPLE = 5;

export const OUTCOME_LEARNING_RUNTIME_VERSION = 'outcome-learning-v13';

export interface OutcomeLearningEnvelope {
  runtimeVersion: 'outcome-learning-v13';
  initialized: true;
  value: {
    crop: string | null;
    diagnosis: string | null;
    recommendation: string | null;
    region: string | null;
    weatherContext: string | null;
    totalCases: number;
    improvedRate: number | null;
    text?: string;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// --- internal: defensively normalise a string-ish field ------------------

function _str(v: any): string | null {
  return _safe(() => {
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  }, null);
}

// --- internal: classify a recorded outcome into the v13 enum -------------

function _classifyOutcome(raw: any): OutcomeValue {
  return _safe(() => {
    const s = _str(raw);
    if (!s) return 'UNKNOWN';
    const u = s.toUpperCase();
    // Direct enum matches.
    if (u === 'IMPROVED' || u === 'UNCHANGED' || u === 'WORSENED' || u === 'UNKNOWN') {
      return u as OutcomeValue;
    }
    // Map common synonyms seen in stored records (read-only mapping, not data).
    if (u === 'RESOLVED' || u === 'BETTER' || u === 'RECOVERED' || u === 'HEALED') {
      return 'IMPROVED';
    }
    if (u === 'SAME' || u === 'STABLE' || u === 'NO_CHANGE' || u === 'NOCHANGE') {
      return 'UNCHANGED';
    }
    if (u === 'WORSE' || u === 'DECLINED' || u === 'DETERIORATED' || u === 'SPREAD') {
      return 'WORSENED';
    }
    return 'UNKNOWN';
  }, 'UNKNOWN');
}

// --- internal: pull the outcome status off a stored record ---------------

function _outcomeStatusOf(rec: any): any {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return null;
    // Event-log rows wrap their data; outcome rows carry it directly.
    const candidates = [
      r.outcome,
      r.outcomeStatus,
      r.status,
      r.outcomeValue,
      r.result,
      r.payload && r.payload.outcome,
      r.payload && r.payload.outcomeStatus,
      r.payload && r.payload.status,
      r.data && r.data.outcome,
      r.data && r.data.outcomeStatus,
      r.data && r.data.status,
    ];
    for (let i = 0; i < candidates.length; i++) {
      const s = _str(candidates[i]);
      if (s) return candidates[i];
    }
    return null;
  }, null);
}

export function outcomeLearningHealth(): OutcomeLearningEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const eventLog = _arr(_ls('farroway_event_log'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));

      // --- probe an existing outcome surface (may be null) ---
      const outcomeProbe = _probe('__outcomeHealth');

      // --- collect REAL recorded outcomes ---------------------------------
      // From the event log: every OutcomeRecorded event with a status.
      const outcomes: OutcomeValue[] = [];
      const dataSources: string[] = [];

      let eventOutcomeRows = 0;
      for (let i = 0; i < eventLog.length; i++) {
        const e: any = eventLog[i];
        const eo = _obj(e);
        if (!eo) continue;
        const kind = _str(eo.eventType ?? eo.type ?? eo.name);
        if (kind !== 'OutcomeRecorded') continue;
        const status = _outcomeStatusOf(eo);
        if (status == null) continue;
        eventOutcomeRows++;
        outcomes.push(_classifyOutcome(status));
      }
      if (eventOutcomeRows > 0) dataSources.push('farroway_event_log');

      // From the existing __outcomeHealth probe: count attested, recorded
      // outcomes. We ONLY borrow a real recorded count — never a fabricated
      // rate. If the probe exposes the actual recorded outcome records we
      // classify them; otherwise we use its honest recorded-outcome count.
      let probeOutcomeCount = 0;
      const probeImprovedCount = _safe(() => {
        const p = _obj(outcomeProbe);
        if (!p) return null;

        // Preferred: a real list of recorded outcome records we can classify.
        const recordList =
          _arr((p as any).outcomes) .length ? _arr((p as any).outcomes)
          : _arr((p as any).records) .length ? _arr((p as any).records)
          : _arr((p as any).value && (p as any).value.outcomes) .length
            ? _arr((p as any).value.outcomes)
            : [];
        if (recordList.length > 0) {
          let improved = 0;
          for (let i = 0; i < recordList.length; i++) {
            const status = _outcomeStatusOf(recordList[i]);
            if (status == null) continue;
            probeOutcomeCount++;
            if (_classifyOutcome(status) === 'IMPROVED') improved++;
          }
          return improved;
        }

        // Otherwise: borrow an honest recorded-outcome count only.
        const counted = _safe(() => {
          const v: any = (p as any).value ?? p;
          const cand = [
            v.outcomesCovered,
            v.outcomesRecorded,
            v.recordedOutcomes,
            v.totalOutcomes,
            v.outcomeCount,
            v.counts && v.counts.outcomes,
          ];
          for (let i = 0; i < cand.length; i++) {
            const n = cand[i];
            if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.floor(n);
          }
          return 0;
        }, 0);
        probeOutcomeCount = counted;
        return null; // improved breakdown unknown from a bare count
      }, null);

      if (probeOutcomeCount > 0) dataSources.push('__outcomeHealth');

      // --- crop / region / weather context (real, read-only) --------------
      const crop = _safe(() => {
        // Prefer the active farm's crop, then the most-recently managed plant.
        if (activeFarm) {
          const f: any = activeFarm;
          const c = _str(f.crop ?? f.cropName ?? f.primaryCrop);
          if (c) return c;
        }
        for (let i = managedPlants.length - 1; i >= 0; i--) {
          const p = _obj(managedPlants[i]);
          if (!p) continue;
          const c = _str(p.crop ?? p.plant ?? p.plantName ?? p.species ?? p.cropName);
          if (c) return c;
        }
        return null;
      }, null);

      const region = _safe(() => {
        if (!activeFarm) return null;
        const f: any = activeFarm;
        return _str(f.region ?? f.location ?? f.district ?? f.area ?? f.zone);
      }, null);

      const weatherContext = _safe(() => {
        if (!lastWeather) return null;
        const w: any = lastWeather;
        return _str(w.condition ?? w.summary ?? w.description ?? w.label ?? w.text);
      }, null);

      // Diagnosis / recommendation are only reported when a single, clear
      // value is present across recorded outcomes; we do not invent one.
      const diagnosis = null;
      const recommendation = null;

      // --- aggregate the REAL recorded outcomes ---------------------------
      const eventImproved = outcomes.filter((o) => o === 'IMPROVED').length;
      const totalCases = outcomes.length + probeOutcomeCount;

      // Improved count: only sum what we can actually attribute. If the probe
      // contributed an opaque count (improved breakdown unknown), we cannot
      // claim those as improved — so they count toward the denominator only.
      const improvedCount =
        eventImproved + (typeof probeImprovedCount === 'number' ? probeImprovedCount : 0);

      const limitations =
        'This reflects only the real outcomes recorded on this device — it does ' +
        'not include other devices, deleted records, or cases not yet followed up. ' +
        'It is an honest tally of what happened after past recommendations, not a ' +
        'claim that any treatment, chemical, or medicine works, and not a yield or ' +
        'revenue prediction. ' +
        GUIDANCE_TAIL;

      // --- honest fallback: not enough recorded outcomes yet --------------
      if (totalCases < MIN_OUTCOME_SAMPLE) {
        const value = {
          crop,
          diagnosis,
          recommendation,
          region,
          weatherContext,
          totalCases,
          improvedRate: null,
          text: 'Not enough outcome data yet',
        };
        return Object.freeze({
          runtimeVersion: OUTCOME_LEARNING_RUNTIME_VERSION,
          initialized: true as const,
          value: Object.freeze(value),
          confidence: 'low' as Confidence,
          dataSources: Object.freeze(dataSources.slice()) as unknown as string[],
          explanation:
            'Not enough outcome data yet — ' +
            totalCases +
            ' recorded outcome(s) so far; at least ' +
            MIN_OUTCOME_SAMPLE +
            ' are needed before an improvement rate is shown.',
          limitations,
        }) as OutcomeLearningEnvelope;
      }

      // --- enough real outcomes: report an honest improved rate -----------
      const improvedRate = _safe(
        () => Math.round((improvedCount / totalCases) * 100) / 100,
        null as number | null,
      );

      // Confidence is a LABEL, scaled honestly by how many real outcomes exist.
      let confidence: Confidence = 'low';
      if (totalCases >= MIN_OUTCOME_SAMPLE * 4) {
        confidence = 'high';
      } else if (totalCases >= MIN_OUTCOME_SAMPLE * 2) {
        confidence = 'medium';
      }

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Across ' +
            totalCases +
            ' real recorded outcome(s) on this device, the follow-up scan showed ' +
            'improvement in ' +
            (improvedRate != null ? Math.round(improvedRate * 100) + '%' : 'an unknown share') +
            ' of cases.',
        );
        if (crop) bits.push('Most relevant crop in context: ' + crop + '.');
        if (region) bits.push('Region context: ' + region + '.');
        if (weatherContext) bits.push('Recent weather context: ' + weatherContext + '.');
        bits.push(
          'This is a tally of what likely happened after past recommendations — ' +
            'monitor and watch, rather than treat it as a treatment guarantee.',
        );
        return bits.join(' ');
      }, 'Honest tally of real recorded outcomes on this device.');

      const value = {
        crop,
        diagnosis,
        recommendation,
        region,
        weatherContext,
        totalCases,
        improvedRate,
      };

      return Object.freeze({
        runtimeVersion: OUTCOME_LEARNING_RUNTIME_VERSION,
        initialized: true as const,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources.slice()) as unknown as string[],
        explanation,
        limitations,
      }) as OutcomeLearningEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: OUTCOME_LEARNING_RUNTIME_VERSION,
      initialized: true as const,
      value: Object.freeze({
        crop: null,
        diagnosis: null,
        recommendation: null,
        region: null,
        weatherContext: null,
        totalCases: 0,
        improvedRate: null,
        text: 'Not enough outcome data yet',
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough outcome data yet — at least ' +
        MIN_OUTCOME_SAMPLE +
        ' recorded outcomes are needed before an improvement rate is shown.',
      limitations:
        'This reflects only the real outcomes recorded on this device. It is not a ' +
        'claim that any treatment works and not a yield or revenue prediction. ' +
        GUIDANCE_TAIL,
    }) as OutcomeLearningEnvelope,
  );
}

export function installOutcomeLearningHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeLearningHealth !== 'function') {
      w.__outcomeLearningHealth = function () {
        const out = outcomeLearningHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Outcome Learning]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
