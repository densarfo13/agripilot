/**
 * Camera Diagnosis Engine — pure, dependency-free.
 *
 * Spec §3: V2 ships a deterministic stand-in, not an ML model. The
 * classifier shape is the hand-off point — when a real inference
 * service lands later, callers swap `classifyCropImage` for the
 * remote call and every downstream step (action mapping, history,
 * task injection, localization) stays unchanged.
 */

// ─── Detection categories (spec §3) ────────────────────────
export const DIAGNOSIS_CATEGORY = Object.freeze({
  PEST_DETECTED: 'pest_detected',
  LEAF_DAMAGE: 'leaf_damage',
  DISCOLORATION: 'discoloration',
  UNKNOWN_ISSUE: 'unknown_issue',
  NO_ISSUE_DETECTED: 'no_issue_detected',
});

// ─── Action mapping (spec §4) ──────────────────────────────
// Each entry is rendered straight into a task-shaped view model.
// Steps are stored as pipe-separated i18n keys so the UI splits once.

const ACTIONS = {
  [DIAGNOSIS_CATEGORY.PEST_DETECTED]: {
    titleKey: 'camera.action.pest.title',
    whyKey: 'camera.action.pest.why',
    stepsKey: 'camera.action.pest.steps',
    urgency: 'today',
    priority: 'high',
    icon: '\uD83D\uDC1B',
    iconBg: 'rgba(239,68,68,0.12)',
  },
  [DIAGNOSIS_CATEGORY.LEAF_DAMAGE]: {
    titleKey: 'camera.action.leaf.title',
    whyKey: 'camera.action.leaf.why',
    stepsKey: 'camera.action.leaf.steps',
    urgency: 'today',
    priority: 'high',
    icon: '\uD83C\uDF42',
    iconBg: 'rgba(245,158,11,0.12)',
  },
  [DIAGNOSIS_CATEGORY.DISCOLORATION]: {
    titleKey: 'camera.action.color.title',
    whyKey: 'camera.action.color.why',
    stepsKey: 'camera.action.color.steps',
    urgency: 'today',
    priority: 'medium',
    icon: '\uD83D\uDCA7',
    iconBg: 'rgba(59,130,246,0.12)',
  },
  [DIAGNOSIS_CATEGORY.UNKNOWN_ISSUE]: {
    titleKey: 'camera.action.unknown.title',
    whyKey: 'camera.action.unknown.why',
    stepsKey: 'camera.action.unknown.steps',
    urgency: 'this_week',
    priority: 'medium',
    icon: '\uD83D\uDD0D',
    iconBg: 'rgba(255,255,255,0.06)',
  },
  [DIAGNOSIS_CATEGORY.NO_ISSUE_DETECTED]: {
    titleKey: 'camera.action.healthy.title',
    whyKey: 'camera.action.healthy.why',
    ctaKey: 'camera.action.healthy.cta',
    urgency: 'optional',
    priority: 'low',
    icon: '\u2705',
    iconBg: 'rgba(34,197,94,0.12)',
  },
};

/**
 * Fallback action used when the scan pipeline fails outright (spec §9).
 * Never blocks the farmer — gives them a safe inspection routine.
 */
export const SCAN_FAILED_ACTION = {
  category: 'scan_failed',
  titleKey: 'camera.fail.title',
  whyKey: 'camera.fail.why',
  stepsKey: 'camera.fail.steps',
  urgency: 'this_week',
  priority: 'medium',
  icon: '\u26A0\uFE0F',
  iconBg: 'rgba(251,191,36,0.12)',
  isFailure: true,
};

// ─── Classifier (deterministic placeholder) ────────────────
// Spec §3 says any of: mock classifier / rule-based / placeholder API.
// We use a stable hash of image bytes so the SAME image always yields
// the SAME category — this makes testing and farmer trust easier than
// a random roll. A real service drops in later by replacing this one
// function; the rest of the pipeline is untouched.

function hashBytes(bytes) {
  let h = 0;
  for (let i = 0; i < bytes.length; i++) {
    h = (h * 31 + bytes[i]) | 0;
  }
  return Math.abs(h);
}

const CATEGORY_ORDER = [
  DIAGNOSIS_CATEGORY.PEST_DETECTED,
  DIAGNOSIS_CATEGORY.LEAF_DAMAGE,
  DIAGNOSIS_CATEGORY.DISCOLORATION,
  DIAGNOSIS_CATEGORY.UNKNOWN_ISSUE,
  DIAGNOSIS_CATEGORY.NO_ISSUE_DETECTED,
];

/**
 * Classify an image (File or Blob). Returns { category, ms }.
 * Reads a short byte sample for hashing so we don't pay the cost of
 * the whole image on low-end devices.
 */
export async function classifyCropImage(fileOrBlob) {
  if (!fileOrBlob) throw new Error('camera.fail.noImage');
  const buf = await fileOrBlob.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length === 0) throw new Error('camera.fail.emptyImage');

  // Artificial latency so the "Analyzing your crop..." state is
  // visible long enough to feel real. Kept deliberately short.
  await new Promise((r) => setTimeout(r, 600));

  const category = CATEGORY_ORDER[hashBytes(bytes) % CATEGORY_ORDER.length];
  return { category, ms: 600 };
}

// ─── Action builder ────────────────────────────────────────

/**
 * Map a classifier category into a task-shaped view model payload.
 * Callers run t(...) on the keys at render time.
 */
export function actionForCategory(category) {
  const spec = ACTIONS[category];
  if (!spec) return SCAN_FAILED_ACTION;
  return { category, ...spec };
}

/**
 * One-shot end-to-end: classify + action map. Callers that just want
 * the result (not raw category) can skip the classifier helper.
 */
export async function diagnoseCropImage(fileOrBlob) {
  try {
    const { category } = await classifyCropImage(fileOrBlob);
    return { ok: true, action: actionForCategory(category) };
  } catch (err) {
    return { ok: false, action: SCAN_FAILED_ACTION, error: err?.message };
  }
}

export const _internal = { hashBytes, CATEGORY_ORDER, ACTIONS };
