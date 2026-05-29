/**
 * runtime/adoption/onboardingScore.js — Phase 13 onboarding tracker.
 *
 *   import { computeOnboardingScore, ONBOARDING_STEPS }
 *     from 'src/runtime/adoption/onboardingScore.js';
 *
 *   const score = computeOnboardingScore({
 *     farm: { id, name, locationLabel, crops },
 *     scanHistory: [...],
 *     taskState: { completed: [...] },
 *   });
 *
 * What this is
 * ────────────
 *   Pure computation of "how far through onboarding is this farmer."
 *   Five canonical steps:
 *     1. farmCreated         — farm record exists
 *     2. locationAdded       — farm has a non-empty location label
 *     3. cropAdded           — farm has at least one crop
 *     4. firstScan           — scanHistory has at least one entry
 *     5. firstTaskCompleted  — taskState records at least one done
 *
 *   Returns a frozen envelope:
 *     {
 *       steps:        [{key, done, label, ariaKey, ariaDefault}],
 *       completedCount, totalCount, percent,
 *       isComplete,   nextStep,
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Composition-only — does not mutate inputs.
 *   • No persistence writes. No fetch.
 *   • Caller-injected data only.
 */

export const ONBOARDING_VERSION = 'onboarding-score-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const ONBOARDING_STEPS = Object.freeze({
  farmCreated:        'farmCreated',
  locationAdded:      'locationAdded',
  cropAdded:          'cropAdded',
  firstScan:          'firstScan',
  firstTaskCompleted: 'firstTaskCompleted',
});

const STEP_META = Object.freeze([
  { key: 'farmCreated',
    labelKey: 'adoption.onboarding.step.farmCreated',
    labelDefault: 'Create your farm' },
  { key: 'locationAdded',
    labelKey: 'adoption.onboarding.step.locationAdded',
    labelDefault: 'Add your location' },
  { key: 'cropAdded',
    labelKey: 'adoption.onboarding.step.cropAdded',
    labelDefault: 'Add your first crop' },
  { key: 'firstScan',
    labelKey: 'adoption.onboarding.step.firstScan',
    labelDefault: 'Run your first scan' },
  { key: 'firstTaskCompleted',
    labelKey: 'adoption.onboarding.step.firstTaskCompleted',
    labelDefault: 'Complete your first task' },
]);

function _farmExists(farm) {
  if (!_isObj(farm)) return false;
  return !!(_str(farm.id) || _str(farm.farmId) || _str(farm.name));
}

function _farmHasLocation(farm) {
  if (!_isObj(farm)) return false;
  return !!(_str(farm.locationLabel) || _str(farm.region)
         || _str(farm.country)       || _str(farm.location));
}

function _farmHasCrop(farm) {
  if (!_isObj(farm)) return false;
  if (_arr(farm.crops).length > 0) return true;
  if (_str(farm.primaryCrop)) return true;
  if (_str(farm.cropType))    return true;
  return false;
}

function _hasScan(scanHistory) {
  return _arr(scanHistory).some((s) => _isObj(s));
}

function _hasCompletedTask(taskState) {
  if (!_isObj(taskState)) return false;
  if (_arr(taskState.completed).some((t) => _isObj(t) || _str(t))) return true;
  if (_arr(taskState.tasks).some((t) =>
    _isObj(t) && (t.status === 'done' || t.status === 'completed'
               || t.completedAt))) return true;
  return false;
}

export function computeOnboardingScore(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const farm = c.farm;
    const checks = {
      farmCreated:        _farmExists(farm),
      locationAdded:      _farmHasLocation(farm),
      cropAdded:          _farmHasCrop(farm),
      firstScan:          _hasScan(c.scanHistory),
      firstTaskCompleted: _hasCompletedTask(c.taskState),
    };

    const steps = STEP_META.map((m) => Object.freeze({
      key:          m.key,
      done:         !!checks[m.key],
      labelKey:     m.labelKey,
      labelDefault: m.labelDefault,
    }));

    const completedCount = steps.filter((s) => s.done).length;
    const totalCount     = steps.length;
    const percent        = totalCount === 0
      ? 0
      : Math.round((completedCount / totalCount) * 100);
    const isComplete     = completedCount === totalCount;
    const nextStep       = steps.find((s) => !s.done) || null;

    return Object.freeze({
      runtimeVersion: ONBOARDING_VERSION,
      steps:          Object.freeze(steps),
      completedCount,
      totalCount,
      percent,
      isComplete,
      nextStep,
    });
  }, Object.freeze({
    runtimeVersion: ONBOARDING_VERSION,
    steps: Object.freeze([]),
    completedCount: 0,
    totalCount: 5,
    percent: 0,
    isComplete: false,
    nextStep: null,
  }));
}
