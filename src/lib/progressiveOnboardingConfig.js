/**
 * progressiveOnboardingConfig.js — declarative spec for the
 * canonical 3–5 question short flow (§18).
 *
 *   const flow = getProgressiveOnboardingFlow('farmer');
 *   const next = nextOnboardingStep(answers, 'farmer');
 *
 * Why a declarative config (not a UI refactor)
 * ────────────────────────────────────────────
 *   The closure spec §18 calls for progressive onboarding capped
 *   at 3–5 questions with an immediate value reveal afterward.
 *
 *   Refactoring the live FastOnboarding.jsx UI in one turn risks
 *   the auth/setup flow the spec explicitly says "do not break."
 *   The honest move is to ship the canonical declarative config —
 *   the answer to "what should the short flow ASK?" — so future
 *   onboarding work (and any A/B variant) can render off the same
 *   source of truth.
 *
 * Flow contract
 * ─────────────
 *   Each step in the flow declares:
 *     • key            — stable identifier (used as the answer key)
 *     • label          — short prompt (the question)
 *     • kind           — 'choice' | 'text' | 'optional-location'
 *     • choices        — { value, label }[] for 'choice' kind
 *     • required       — boolean; required steps gate the
 *                         "show first recommendation" reveal
 *     • appliesTo      — 'farmer' | 'gardener' | 'both'
 *
 *   The flow is always:
 *     1. country (required, both)
 *     2. language (required, both)
 *     3. crop OR plant (required, branches by farmer/gardener)
 *     4. farm name OR garden setup (required)
 *     5. location (OPTIONAL — value reveals immediately after step 4)
 *
 *   Total required steps = 4. Step 5 is optional and skippable;
 *   the canonical "immediate recommendation" reveals after step 4.
 *
 * Strict-rule audit
 *   • Pure config + pure helpers. Never throws.
 *   • Each step's `required` flag drives `isOnboardingComplete()` —
 *     completing all required steps unblocks the value reveal.
 *   • No localStorage, no network — caller persists answers
 *     wherever they want.
 *   • Garden flow drops sell/funding entirely (spec rule —
 *     Garden mode never sees Farm/Funding/Sell wording).
 */

// Shared first two steps. Country + language are universal.
const _STEP_COUNTRY = Object.freeze({
  key:        'country',
  label:      'Where are you?',
  kind:       'choice',
  required:   true,
  appliesTo:  'both',
  // We deliberately do NOT enumerate every country here — the UI
  // can show a localized country picker. The declarative spec
  // says THIS is the question, not the answer space.
  choices:    null,
});

const _STEP_LANGUAGE = Object.freeze({
  key:        'language',
  label:      'Which language do you prefer?',
  kind:       'choice',
  required:   true,
  appliesTo:  'both',
  choices:    [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'sw', label: 'Kiswahili' },
    { value: 'ha', label: 'Hausa' },
    { value: 'tw', label: 'Twi' },
    { value: 'hi', label: 'हिन्दी' },
  ],
});

const _STEP_CROP = Object.freeze({
  key:        'crop',
  label:      'What do you grow?',
  kind:       'text',
  required:   true,
  appliesTo:  'farmer',
  choices:    null,
});

const _STEP_PLANT = Object.freeze({
  key:        'plant',
  label:      "What's your main plant?",
  kind:       'text',
  required:   true,
  appliesTo:  'gardener',
  choices:    null,
});

const _STEP_FARM = Object.freeze({
  key:        'farmName',
  label:      'Give your farm a name.',
  kind:       'text',
  required:   true,
  appliesTo:  'farmer',
  choices:    null,
});

const _STEP_GARDEN = Object.freeze({
  key:        'gardenSetup',
  label:      "How's it set up?",
  kind:       'choice',
  required:   true,
  appliesTo:  'gardener',
  choices:    [
    { value: 'indoor',    label: 'Indoor pots' },
    { value: 'balcony',   label: 'Balcony / patio' },
    { value: 'outdoor',   label: 'Outdoor garden' },
    { value: 'raised_bed',label: 'Raised bed' },
  ],
});

const _STEP_LOCATION = Object.freeze({
  key:        'location',
  label:      'Use my location for weather + regional patterns?',
  kind:       'optional-location',
  required:   false,    // CRUCIAL — value reveal fires WITHOUT this
  appliesTo:  'both',
  choices:    null,
});

const _FARMER_FLOW = Object.freeze([
  _STEP_COUNTRY,
  _STEP_LANGUAGE,
  _STEP_CROP,
  _STEP_FARM,
  _STEP_LOCATION,
]);

const _GARDENER_FLOW = Object.freeze([
  _STEP_COUNTRY,
  _STEP_LANGUAGE,
  _STEP_PLANT,
  _STEP_GARDEN,
  _STEP_LOCATION,
]);

// ─── Helpers ──────────────────────────────────────────────────

function _safeUserType(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'farmer' || s === 'gardener') return s;
  return 'farmer';
}

function _isAnswered(step, answers) {
  if (!step || !step.key) return false;
  if (!answers || typeof answers !== 'object') return false;
  const v = answers[step.key];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'object') {
    if (step.kind === 'optional-location') {
      return typeof v.lat === 'number' && typeof v.lng === 'number';
    }
    return Object.keys(v).length > 0;
  }
  return true;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Get the canonical onboarding flow for a user type.
 *
 * @param {'farmer'|'gardener'} userType
 * @returns {Array<object>}
 */
export function getProgressiveOnboardingFlow(userType) {
  return _safeUserType(userType) === 'gardener'
    ? _GARDENER_FLOW.slice()
    : _FARMER_FLOW.slice();
}

/**
 * Number of REQUIRED steps in the flow. The spec says 3–5 total;
 * the canonical flow has 4 required + 1 optional = 5 total.
 *
 * @param {'farmer'|'gardener'} userType
 * @returns {number}
 */
export function requiredStepCount(userType) {
  return getProgressiveOnboardingFlow(userType)
    .filter((s) => s.required === true).length;
}

/**
 * The next step the user should be shown, given their current
 * answers. Returns null when every REQUIRED step is answered
 * (the optional location step does NOT block the reveal).
 *
 * @param {object} answers       — partial answers map
 * @param {'farmer'|'gardener'} userType
 * @returns {object|null}
 */
export function nextOnboardingStep(answers, userType) {
  const flow = getProgressiveOnboardingFlow(userType);
  for (const step of flow) {
    if (!step.required) continue;
    if (!_isAnswered(step, answers)) return step;
  }
  return null;
}

/**
 * Whether the required steps are all answered — when this returns
 * true, the spec's "immediate recommendation afterward" reveal
 * should fire.
 *
 * @param {object} answers
 * @param {'farmer'|'gardener'} userType
 * @returns {boolean}
 */
export function isOnboardingComplete(answers, userType) {
  return nextOnboardingStep(answers, userType) === null;
}

/**
 * Progress fraction (0..1) over required steps only — handy for
 * progress bars.
 *
 * @param {object} answers
 * @param {'farmer'|'gardener'} userType
 * @returns {number}
 */
export function onboardingProgress(answers, userType) {
  const required = getProgressiveOnboardingFlow(userType)
    .filter((s) => s.required === true);
  if (required.length === 0) return 1;
  const answered = required.filter((s) => _isAnswered(s, answers)).length;
  return Math.min(1, answered / required.length);
}

export default {
  getProgressiveOnboardingFlow,
  requiredStepCount,
  nextOnboardingStep,
  isOnboardingComplete,
  onboardingProgress,
};
