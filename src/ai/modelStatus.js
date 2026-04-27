/**
 * modelStatus.js — classify a shipped model JSON and produce
 * the user-visible warning, if any.
 *
 *   getModelStatus(model)
 *     -> {
 *          status,        // 'placeholder' | 'baseline' | 'trained' | 'stale'
 *          warning,       // { messageKey, fallback } | null
 *          trainedAt,     // ISO string from the model file
 *          datasetRows,   // training-set size from the model file
 *          ageDays,       // days since trainedAt (null if unknown)
 *          isTrustworthy, // boolean — caller can use to gate
 *                         //   "show ML risk" vs "use rule engine"
 *        }
 *
 * Statuses + their semantics
 *
 *   placeholder  — model file exists but every weight is zero
 *                  (the zero-weight bootstrap shipped before
 *                  any real training run). The app silently
 *                  falls back to the rule engine, but surfaces
 *                  that fact to anyone who asks.
 *
 *   baseline     — non-zero weights but trained on fewer than
 *                  MIN_TRUSTWORTHY_ROWS labeled examples (per
 *                  spec § 9). Inference runs, but the warning
 *                  banner must be displayed: "Baseline model
 *                  only — more data needed."
 *
 *   trained      — non-zero weights, trained on enough rows.
 *                  No warning required. The model is the
 *                  primary risk source.
 *
 *   stale        — trained but the trainedAt timestamp is
 *                  older than STALE_AFTER_DAYS. Inference
 *                  still runs, but a softer "weights are old"
 *                  warning is suggested to ops.
 *
 * Why a separate module
 *   The spec § 9 guardrail ("Baseline model only — more data
 *   needed.") was previously enforced ONLY in the trainer and
 *   the model JSON file; the app never surfaced it. Centralising
 *   the classification here means every UI surface (NGO panel,
 *   admin dashboard, future risk-detail modal) reads the same
 *   single source of truth.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no side effects, no globals
 *   * Never throws — every branch handles missing / malformed
 *     input
 *   * Never leaks weights — output never echoes weights or bias
 *   * Translatable — warning is { messageKey, fallback } so
 *     callers route through tSafe
 */

export const MIN_TRUSTWORTHY_ROWS = 500;
export const STALE_AFTER_DAYS    = 90;

export const MODEL_STATUS = Object.freeze({
  PLACEHOLDER: 'placeholder',
  BASELINE:    'baseline',
  TRAINED:     'trained',
  STALE:       'stale',
});

const _SAFE_NULL = Object.freeze({
  status:        MODEL_STATUS.PLACEHOLDER,
  warning: {
    messageKey: 'ml.warning.placeholder',
    fallback:   'No model trained yet. Using rule-based risk.',
  },
  trainedAt:     null,
  datasetRows:   0,
  ageDays:       null,
  isTrustworthy: false,
});

function _isAllZeroWeights(model) {
  if (!model || !Array.isArray(model.weights)) return true;
  if (model.weights.length === 0) return true;
  const allZero = model.weights.every((w) => w === 0);
  const biasZero = model.bias === 0 || model.bias == null;
  return allZero && biasZero;
}

function _safeAgeDays(trainedAt) {
  if (!trainedAt) return null;
  try {
    const t = new Date(trainedAt).getTime();
    if (!Number.isFinite(t) || t <= 0) return null;
    const ms = Date.now() - t;
    if (ms < 0) return 0;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  } catch { return null; }
}

/**
 * getModelStatus(model) → status descriptor
 *
 * Accepts the parsed model JSON (or null/undefined). Returns
 * the SAFE_NULL placeholder shape on missing input so callers
 * can destructure without null-checks.
 */
export function getModelStatus(model) {
  if (!model || typeof model !== 'object') return _SAFE_NULL;

  // Placeholder: the zero-weight bootstrap shipped before the
  // first real training run. Always falls back to the rule
  // engine, regardless of any "warning" text in the file.
  if (_isAllZeroWeights(model)) {
    return Object.freeze({
      status:        MODEL_STATUS.PLACEHOLDER,
      warning: {
        messageKey: 'ml.warning.placeholder',
        fallback:   'No model trained yet. Using rule-based risk.',
      },
      trainedAt:     model.trainedAt || null,
      datasetRows:   Number(model.datasetRows) || 0,
      ageDays:       _safeAgeDays(model.trainedAt),
      isTrustworthy: false,
    });
  }

  const datasetRows = Number(model.datasetRows) || 0;
  const ageDays     = _safeAgeDays(model.trainedAt);

  // Stale check first: an old "trained" model is more dangerous
  // than a "baseline" one because callers might trust it. Surface
  // staleness even when the dataset was once large enough.
  if (ageDays != null && ageDays > STALE_AFTER_DAYS) {
    return Object.freeze({
      status:        MODEL_STATUS.STALE,
      warning: {
        messageKey: 'ml.warning.stale',
        fallback:   'Model weights are old. Retraining recommended.',
      },
      trainedAt:     model.trainedAt || null,
      datasetRows,
      ageDays,
      // Stale models are still PROBABLY usable — the caller can
      // decide based on isTrustworthy alone whether to show ML
      // numbers prominently. We mark stale as not trustworthy so
      // the default behavior is the safer one (rule engine wins).
      isTrustworthy: false,
    });
  }

  // Baseline: non-zero weights but small training set. The
  // warning is the verbatim spec § 9 guardrail. The model still
  // runs — caller chooses whether to surface predictions.
  if (datasetRows < MIN_TRUSTWORTHY_ROWS) {
    return Object.freeze({
      status:        MODEL_STATUS.BASELINE,
      warning: {
        messageKey: 'ml.warning.baseline',
        fallback:   'Baseline model only \u2014 more data needed.',
      },
      trainedAt:     model.trainedAt || null,
      datasetRows,
      ageDays,
      isTrustworthy: false,
    });
  }

  return Object.freeze({
    status:        MODEL_STATUS.TRAINED,
    warning:       null,
    trainedAt:     model.trainedAt || null,
    datasetRows,
    ageDays,
    isTrustworthy: true,
  });
}

/**
 * combineStatuses(pestStatus, droughtStatus) → single banner-ready
 * descriptor for surfaces that show ONE warning regardless of
 * which model triggered it. Picks the worst of the two.
 */
export function combineStatuses(pestStatus, droughtStatus) {
  const ranks = {
    [MODEL_STATUS.PLACEHOLDER]: 3,
    [MODEL_STATUS.STALE]:       2,
    [MODEL_STATUS.BASELINE]:    1,
    [MODEL_STATUS.TRAINED]:     0,
  };
  const a = pestStatus    || _SAFE_NULL;
  const b = droughtStatus || _SAFE_NULL;
  const pick = (ranks[a.status] >= ranks[b.status]) ? a : b;
  return pick;
}

export default getModelStatus;
