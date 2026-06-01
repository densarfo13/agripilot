/**
 * Farroway · Outcome Learning Loop (outcome-learning-loop-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` / `_winVar()` helpers below, and never
 * fabricates outcomes, effectiveness, or improvement rates.
 *
 * It traces the REAL end-to-end learning chain that exists in the saved
 * event log — scan → diagnosis → recommendation → task → completion →
 * follow-up scan → recorded outcome — and only reports an improved-rate
 * once a minimum honest sample of recorded outcomes exists. Otherwise it
 * returns an honest "NEEDS_DATA" fallback.
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

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// Minimum number of recorded outcomes before any improved-rate is reported.
// Below this we NEVER claim an effectiveness or improvement rate.
const MIN_OUTCOME_SAMPLE = 5;

type OutcomeStatus = 'IMPROVED' | 'UNCHANGED' | 'WORSENED' | 'UNKNOWN';

export const OUTCOME_LEARNING_LOOP_VERSION = 'outcome-learning-loop-v1';

export interface OutcomeLearningLoopEnvelope {
  runtimeVersion: 'outcome-learning-loop-v1';
  initialized: true;
  scanLinked: boolean;
  diagnosisLinked: boolean;
  recommendationLinked: boolean;
  taskLinked: boolean;
  followUpScanLinked: boolean;
  outcomeRecorded: boolean;
  learningSnapshotReady: boolean;
  minSampleRulesEnforced: true;
  noFakeEffectiveness: true;
  value: any;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// --- canonical chain event types (matched against several name fields) ---
function _eventType(e: any): string {
  return _safe(() => {
    const t = e && (e.type ?? e.eventType ?? e.name ?? e.kind);
    return t != null ? String(t) : '';
  }, '');
}

// classify an OutcomeRecorded event by its status field (synonyms tolerated)
function _classifyOutcome(e: any): OutcomeStatus {
  return _safe(() => {
    const raw =
      e &&
      (e.status ??
        e.outcome ??
        e.outcomeStatus ??
        e.result ??
        (e.payload && (e.payload.status ?? e.payload.outcome)) ??
        null);
    if (raw == null) return 'UNKNOWN';
    const s = String(raw).trim().toUpperCase();
    if (s === 'IMPROVED' || s === 'RESOLVED' || s === 'BETTER' || s === 'RECOVERED')
      return 'IMPROVED';
    if (s === 'UNCHANGED' || s === 'SAME' || s === 'NO_CHANGE' || s === 'STABLE')
      return 'UNCHANGED';
    if (s === 'WORSENED' || s === 'WORSE' || s === 'DECLINED' || s === 'DETERIORATED')
      return 'WORSENED';
    return 'UNKNOWN';
  }, 'UNKNOWN');
}

export function outcomeLearningLoopHealth(): OutcomeLearningLoopEnvelope {
  return _safe(
    () => {
      // --- real stored event log (may be absent) ---
      const eventLog = _arr(_ls('farroway_event_log'));

      // --- probes (any may be null) ---
      const outcome = _probe('__outcomeHealth');
      const outcomeCapture = _probe('__outcomeCaptureHealth');

      // --- canonical chain link presence (from the real event log) ---
      const seen: Record<string, boolean> = {};
      const outcomeStatuses: OutcomeStatus[] = [];
      for (let i = 0; i < eventLog.length; i++) {
        const e: any = eventLog[i];
        if (!e || typeof e !== 'object') continue;
        const t = _eventType(e);
        if (!t) continue;
        seen[t] = true;
        if (t === 'OutcomeRecorded') {
          outcomeStatuses.push(_classifyOutcome(e));
        }
      }

      const scanLinked = seen['ScanCompleted'] === true;
      const diagnosisLinked = seen['DiagnosisCreated'] === true;
      const recommendationLinked = seen['RecommendationCreated'] === true;
      const taskLinked =
        seen['TaskCreatedFromScan'] === true || seen['TaskCompleted'] === true;
      const followUpScanLinked = seen['FollowUpScanCompleted'] === true;
      const outcomeRecorded = seen['OutcomeRecorded'] === true;

      // learningSnapshotReady = chain reached OutcomeRecorded with at least one
      // follow-up scan logged (a real before/after pair exists).
      const learningSnapshotReady = outcomeRecorded && followUpScanLinked;

      // --- tally recorded outcomes (real classifications only) ---
      let improved = 0;
      let unchanged = 0;
      let worsened = 0;
      let unknown = 0;
      for (let i = 0; i < outcomeStatuses.length; i++) {
        const s = outcomeStatuses[i];
        if (s === 'IMPROVED') improved++;
        else if (s === 'UNCHANGED') unchanged++;
        else if (s === 'WORSENED') worsened++;
        else unknown++;
      }
      const totalOutcomes = outcomeStatuses.length;

      // improvedRate ONLY when we have a real minimum sample; otherwise null.
      const hasMinSample = totalOutcomes >= MIN_OUTCOME_SAMPLE;
      const improvedRate = hasMinSample
        ? _safe(() => improved / totalOutcomes, null as number | null)
        : null;

      // --- assemble honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (eventLog.length > 0) dataSources.push('farroway_event_log');
      if (outcome) dataSources.push('__outcomeHealth');
      if (outcomeCapture) dataSources.push('__outcomeCaptureHealth');

      // --- limitations note (constant, honest, ends with the disclaimer) ---
      const limitations =
        'This learning loop only reflects outcomes that have actually been ' +
        'recorded on this device, after a follow-up scan. It does not include ' +
        'other devices, deleted records, or treatments you have not followed up ' +
        'on. Improvement rates are withheld until at least ' +
        MIN_OUTCOME_SAMPLE +
        ' outcomes are recorded, and it never claims effectiveness below that ' +
        'sample. It is a summary of your own results, not advice about chemicals ' +
        'or treatments. ' +
        GUIDANCE_TAIL;

      // --- confidence (honest) -------------------------------------------
      // May only rise above 'low' when follow-up scans are linked AND we have
      // the minimum recorded-outcome sample. Follow-up is required first.
      let confidence: Confidence = 'low';
      if (followUpScanLinked && hasMinSample) {
        confidence = totalOutcomes >= MIN_OUTCOME_SAMPLE * 2 ? 'high' : 'medium';
      }

      // --- honest NEEDS_DATA fallback (no min sample yet) ----------------
      if (!hasMinSample) {
        const explanationParts: string[] = [];
        explanationParts.push(
          'The learning loop is tracing the real chain saved on this device: ' +
            'scan ' +
            (scanLinked ? '✓' : '—') +
            ', diagnosis ' +
            (diagnosisLinked ? '✓' : '—') +
            ', recommendation ' +
            (recommendationLinked ? '✓' : '—') +
            ', task ' +
            (taskLinked ? '✓' : '—') +
            ', follow-up scan ' +
            (followUpScanLinked ? '✓' : '—') +
            ', recorded outcome ' +
            (outcomeRecorded ? '✓' : '—') +
            '.',
        );
        explanationParts.push(
          'Only ' +
            totalOutcomes +
            ' outcome(s) recorded so far — at least ' +
            MIN_OUTCOME_SAMPLE +
            ' are needed before any improvement rate can be shown.',
        );

        const value = {
          summary:
            'Not enough recorded outcomes yet to learn from (' +
            totalOutcomes +
            ' of ' +
            MIN_OUTCOME_SAMPLE +
            ').',
          totalOutcomes,
          minSample: MIN_OUTCOME_SAMPLE,
          improvedRate: null,
          guidance:
            'Complete a treatment, then do a follow-up scan and record the ' +
            'outcome. Once a few outcomes are saved, this will gently show how ' +
            'often things improved. ' +
            GUIDANCE_TAIL,
        };

        return Object.freeze({
          runtimeVersion: OUTCOME_LEARNING_LOOP_VERSION,
          initialized: true as const,
          scanLinked,
          diagnosisLinked,
          recommendationLinked,
          taskLinked,
          followUpScanLinked,
          outcomeRecorded,
          learningSnapshotReady,
          minSampleRulesEnforced: true as const,
          noFakeEffectiveness: true as const,
          value: 'NEEDS_DATA',
          confidence: 'low' as Confidence,
          dataSources: Object.freeze(dataSources) as unknown as string[],
          explanation: explanationParts.join(' '),
          limitations,
        }) as OutcomeLearningLoopEnvelope;
      }

      // --- real learning snapshot (min sample reached) -------------------
      const value = {
        summary:
          'Learning from ' +
          totalOutcomes +
          ' recorded outcome(s) on this device.',
        totalOutcomes,
        improved,
        unchanged,
        worsened,
        unknown,
        improvedRate,
        minSample: MIN_OUTCOME_SAMPLE,
        guidance: _safe(() => {
          const parts: string[] = [];
          if (improvedRate != null) {
            const pct = Math.round(improvedRate * 100);
            parts.push(
              'So far, ' +
                improved +
                ' of ' +
                totalOutcomes +
                ' recorded outcomes improved (' +
                pct +
                '%).',
            );
          }
          if (worsened > 0) {
            parts.push(worsened + ' worsened — worth a closer look.');
          }
          parts.push('Keep recording follow-ups to make this clearer.');
          return parts.join(' ') + ' ' + GUIDANCE_TAIL;
        }, 'Keep recording follow-ups to make this clearer. ' + GUIDANCE_TAIL),
      };

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'This is a summary of the real outcomes recorded on this device: ' +
            improved +
            ' improved, ' +
            unchanged +
            ' unchanged, ' +
            worsened +
            ' worsened, and ' +
            unknown +
            ' unknown, across ' +
            totalOutcomes +
            ' recorded outcome(s).',
        );
        bits.push(
          'Chain links present: scan ' +
            (scanLinked ? '✓' : '—') +
            ', diagnosis ' +
            (diagnosisLinked ? '✓' : '—') +
            ', recommendation ' +
            (recommendationLinked ? '✓' : '—') +
            ', task ' +
            (taskLinked ? '✓' : '—') +
            ', follow-up scan ' +
            (followUpScanLinked ? '✓' : '—') +
            ', recorded outcome ' +
            (outcomeRecorded ? '✓' : '—') +
            '.',
        );
        if (!followUpScanLinked) {
          bits.push(
            'No follow-up scans are linked yet, so confidence stays low.',
          );
        }
        return bits.join(' ');
      }, 'Summary of the real outcomes recorded on this device.');

      return Object.freeze({
        runtimeVersion: OUTCOME_LEARNING_LOOP_VERSION,
        initialized: true as const,
        scanLinked,
        diagnosisLinked,
        recommendationLinked,
        taskLinked,
        followUpScanLinked,
        outcomeRecorded,
        learningSnapshotReady,
        minSampleRulesEnforced: true as const,
        noFakeEffectiveness: true as const,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as OutcomeLearningLoopEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: OUTCOME_LEARNING_LOOP_VERSION,
      initialized: true as const,
      scanLinked: false,
      diagnosisLinked: false,
      recommendationLinked: false,
      taskLinked: false,
      followUpScanLinked: false,
      outcomeRecorded: false,
      learningSnapshotReady: false,
      minSampleRulesEnforced: true as const,
      noFakeEffectiveness: true as const,
      value: 'NEEDS_DATA',
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — record outcomes after follow-up scans to start ' +
        'this learning loop.',
      limitations:
        'This learning loop only reflects outcomes that have actually been ' +
        'recorded on this device so far. ' +
        GUIDANCE_TAIL,
    }) as OutcomeLearningLoopEnvelope,
  );
}

export function installOutcomeLearningLoopHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeLearningLoopHealth !== 'function') {
      w.__outcomeLearningLoopHealth = function () {
        const out = outcomeLearningLoopHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Outcome Learning Loop]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
