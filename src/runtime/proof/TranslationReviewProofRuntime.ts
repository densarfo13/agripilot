/**
 * Farroway · Translation Review PROOF Runtime (translation-review-proof-v1)
 *
 * Self-contained (ZERO imports) browser diagnostic that PROVES whether human
 * translation review is actually VISIBLE and recorded — it does NOT, and can
 * NEVER, fake translation completion. It reads ONLY real evidence:
 *   - the wired capability probe `__languageQualityHealth`
 *   - recorded manual proof runs in localStorage ('farroway_proof_runs')
 *   - canonical event logs ('farroway.farmEvents' + 'farroway_event_log')
 *
 * HONESTY CONTRACT: a per-locale status only becomes 'REVIEWED' when the probe
 * POSITIVELY shows a completed human review for that locale; otherwise it
 * degrades honestly to 'NEEDS_REVIEW' (or 'IN_REVIEW' / 'UNKNOWN'). proofStatus
 * is 'PASS' ONLY when ALL FOUR locales are 'REVIEWED' AND a real
 * validationSource exists. It NEVER returns PASS from configuration alone.
 */

// --- proven helper block (copied verbatim from GrowTimeframeEngine.ts) -----

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

// --- proof evidence helpers (self-contained) ------------------------------

interface ProofRun {
  ranAt: any;
  result: any;
  source: any;
  note: any;
}

function _proofRun(name: string): ProofRun | null {
  return _safe(() => {
    const store = _obj(_ls('farroway_proof_runs'));
    if (!store) return null;
    const row = _obj(store[name]);
    if (!row) return null;
    return {
      ranAt: row.ranAt ?? null,
      result: row.result ?? null,
      source: row.source ?? null,
      note: row.note ?? null,
    } as ProofRun;
  }, null);
}

function _events(): any[] {
  return _safe(() => {
    const a = _arr(_ls('farroway.farmEvents'));
    const b = _arr(_ls('farroway_event_log'));
    return a.concat(b);
  }, []);
}

function _eventTypes(): Set<string> {
  return _safe(() => {
    const out = new Set<string>();
    for (const row of _events()) {
      const o = _obj(row);
      if (!o) continue;
      const t = o.type ?? o.eventType ?? o.name ?? o.kind;
      if (typeof t === 'string' && t.length > 0) out.add(t);
    }
    return out;
  }, new Set<string>());
}

function _hasEvent(list: string[]): boolean {
  return _safe(() => {
    const present = _eventTypes();
    for (const t of list) if (present.has(t)) return true;
    return false;
  }, false);
}

// -------------------------------------------------------------------------

export const TRANSLATION_REVIEW_PROOF_VERSION = 'translation-review-proof-v1' as const;

export type LocaleReviewStatus = 'REVIEWED' | 'IN_REVIEW' | 'NEEDS_REVIEW' | 'UNKNOWN';
export type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST';

export interface TranslationReviewProofEnvelope {
  runtimeVersion: typeof TRANSLATION_REVIEW_PROOF_VERSION;
  missingKeysTracked: boolean;
  fallbackUsageTracked: boolean;
  reviewQueueVisible: boolean;
  twReviewStatus: LocaleReviewStatus;
  haReviewStatus: LocaleReviewStatus;
  swReviewStatus: LocaleReviewStatus;
  hiReviewStatus: LocaleReviewStatus;
  proofStatus: ProofStatus;
  validationSource: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Per-locale review status (HONEST: defaults to NEEDS_REVIEW; never fakes
// completion). Reads lq.translatorReviewSummary?.[locale] first, then falls
// back to lq.translatorReviewLocales inclusion.
// -------------------------------------------------------------------------

function _normStatus(raw: any): LocaleReviewStatus | null {
  return _safe(() => {
    if (raw == null) return null;
    const s = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (s === 'reviewed' || s === 'complete' || s === 'completed' || s === 'done' || s === 'approved') {
      return 'REVIEWED';
    }
    if (s === 'inreview' || s === 'reviewing' || s === 'pending' || s === 'inprogress') {
      return 'IN_REVIEW';
    }
    if (s === 'needsreview' || s === 'unreviewed' || s === 'todo' || s === 'queued') {
      return 'NEEDS_REVIEW';
    }
    return null;
  }, null);
}

function _summaryStatus(summaryEntry: any): LocaleReviewStatus | null {
  return _safe(() => {
    if (summaryEntry == null) return null;
    // Direct string verdict (e.g. summary[locale] === 'reviewed').
    if (typeof summaryEntry === 'string') return _normStatus(summaryEntry);
    const o = _obj(summaryEntry);
    if (!o) return null;
    // Explicit boolean completion is the ONLY thing that proves REVIEWED.
    if (o.reviewed === true || o.completed === true || o.approved === true) return 'REVIEWED';
    if (o.reviewed === false || o.completed === false) return 'NEEDS_REVIEW';
    // A textual status field.
    const fromStatus = _normStatus(o.status ?? o.state ?? o.reviewStatus);
    if (fromStatus) return fromStatus;
    // Counts: pending items mean it is still in/awaiting review — never REVIEWED.
    if (typeof o.pending === 'number') return o.pending > 0 ? 'IN_REVIEW' : null;
    if (typeof o.remaining === 'number') return o.remaining > 0 ? 'IN_REVIEW' : null;
    return null;
  }, null);
}

function _reviewStatus(locale: string, lq: any): LocaleReviewStatus {
  return _safe(() => {
    const q = _obj(lq);
    // No probe at all → genuinely unknown.
    if (!q) return 'UNKNOWN';

    // 1) Per-locale summary verdict (the authoritative, positive signal).
    const summary = _obj(q.translatorReviewSummary);
    if (summary && typeof summary[locale] !== 'undefined') {
      const s = _summaryStatus(summary[locale]);
      if (s) return s;
    }

    // 2) Inclusion in the translatorReviewLocales list = it still NEEDS review
    //    (being on the review list does NOT prove a completed human review).
    const locales = _arr(q.translatorReviewLocales);
    if (locales.indexOf(locale) !== -1) return 'NEEDS_REVIEW';

    // 3) Probe present but says nothing about this locale → still needs review;
    //    we never assume completion from silence.
    return 'NEEDS_REVIEW';
  }, 'NEEDS_REVIEW');
}

// -------------------------------------------------------------------------
// Public health function
// -------------------------------------------------------------------------

export function translationReviewHealth(): TranslationReviewProofEnvelope {
  return _safe(
    () => {
      const lq = _obj(_probe('__languageQualityHealth'));

      const missingKeysTracked = !!(lq && typeof lq.missingKeys !== 'undefined');
      const fallbackUsageTracked = !!(lq && typeof lq.fallbackUsage !== 'undefined');
      const reviewQueueVisible = !!(lq && lq.reviewQueueReady === true);

      const twReviewStatus = _reviewStatus('tw', lq);
      const haReviewStatus = _reviewStatus('ha', lq);
      const swReviewStatus = _reviewStatus('sw', lq);
      const hiReviewStatus = _reviewStatus('hi', lq);

      const allReviewed =
        twReviewStatus === 'REVIEWED' &&
        haReviewStatus === 'REVIEWED' &&
        swReviewStatus === 'REVIEWED' &&
        hiReviewStatus === 'REVIEWED';

      // validationSource is proven ONLY when the review queue is genuinely
      // visible via the wired probe. Otherwise null (unproven).
      const validationSource: string | null = reviewQueueVisible
        ? 'probe:languageQualityHealth.reviewQueue'
        : null;

      // Touch corroborating real evidence (recorded manual run + canonical
      // event logs) so it is read honestly — used only to lift confidence,
      // NEVER to fabricate a pass.
      const recordedRun = _proofRun('translation_review');
      const sawReviewEvent = _hasEvent([
        'translation_reviewed',
        'translation_review_completed',
        'translator_review_completed',
        'language_review_completed',
      ]);

      // proofStatus: PASS ONLY when all four locales REVIEWED AND a real
      // validationSource exists. Never PASS from config alone; degrade to
      // NEEDS_TEST honestly when the probe is absent or review incomplete.
      const proofStatus: ProofStatus =
        allReviewed && !!validationSource ? 'PASS' : 'NEEDS_TEST';

      let confidence: Confidence = 'low';
      if (proofStatus === 'PASS') {
        confidence = recordedRun || sawReviewEvent ? 'high' : 'medium';
      } else if (reviewQueueVisible) {
        confidence = 'medium';
      }

      const reviewedCount =
        (twReviewStatus === 'REVIEWED' ? 1 : 0) +
        (haReviewStatus === 'REVIEWED' ? 1 : 0) +
        (swReviewStatus === 'REVIEWED' ? 1 : 0) +
        (hiReviewStatus === 'REVIEWED' ? 1 : 0);

      const explanation = !lq
        ? 'The language quality probe (__languageQualityHealth) is not present, so human ' +
          'translation review cannot be proven. Each locale defaults to NEEDS_REVIEW. ' +
          'This is honest: no review is assumed without real evidence.'
        : proofStatus === 'PASS'
        ? 'Human translation review is visible and all four reviewed locales (tw, ha, sw, hi) ' +
          'show a completed review in the language quality probe' +
          (recordedRun ? ', corroborated by a recorded manual proof run.' :
            sawReviewEvent ? ', corroborated by a translation-review event in the log.' : '.')
        : 'Translation review tracking is ' +
          (reviewQueueVisible ? 'visible' : 'not yet visible') +
          ' (' + reviewedCount + ' of 4 locales show a completed human review). ' +
          'Completion is NEVER assumed — locales without positive review evidence remain NEEDS_REVIEW. ' +
          'A human must run and record the review for PASS.';

      const limitations =
        'This proof checks only that human translation review is VISIBLE and recorded — it does ' +
        'NOT verify translation accuracy or fake completion. missingKeysTracked=' + missingKeysTracked +
        ', fallbackUsageTracked=' + fallbackUsageTracked + ', reviewQueueVisible=' + reviewQueueVisible +
        '. A locale is REVIEWED only when the probe positively reports a completed review; otherwise it ' +
        'degrades to NEEDS_REVIEW. PASS requires all four locales REVIEWED with a real validation source. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: TRANSLATION_REVIEW_PROOF_VERSION,
        missingKeysTracked,
        fallbackUsageTracked,
        reviewQueueVisible,
        twReviewStatus,
        haReviewStatus,
        swReviewStatus,
        hiReviewStatus,
        proofStatus,
        validationSource,
        confidence,
        explanation,
        limitations,
      }) as TranslationReviewProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: TRANSLATION_REVIEW_PROOF_VERSION,
      missingKeysTracked: false,
      fallbackUsageTracked: false,
      reviewQueueVisible: false,
      twReviewStatus: 'UNKNOWN' as LocaleReviewStatus,
      haReviewStatus: 'UNKNOWN' as LocaleReviewStatus,
      swReviewStatus: 'UNKNOWN' as LocaleReviewStatus,
      hiReviewStatus: 'UNKNOWN' as LocaleReviewStatus,
      proofStatus: 'NEEDS_TEST' as ProofStatus,
      validationSource: null,
      confidence: 'low' as Confidence,
      explanation:
        'Translation review proof runtime could not initialize — no review can be proven. ' +
        'Defaulting to NEEDS_TEST with no validation source.',
      limitations:
        'No translation review evidence could be read. Human translation review is NOT assumed ' +
        'complete. PASS requires all four locales REVIEWED with a real validation source. ' +
        GUIDANCE_TAIL,
    }) as TranslationReviewProofEnvelope,
  );
}

// -------------------------------------------------------------------------
// Installer (SHAPE copied from the proven pattern): pins the window global
// ONLY if not already a function; dev-only console.log gated on DEV flag.
// -------------------------------------------------------------------------

export function installTranslationReviewProofGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__translationReviewHealth !== 'function') {
      w.__translationReviewHealth = function () {
        const out = translationReviewHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Translation Review Proof]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
