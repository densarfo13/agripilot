/**
 * homeNextStep.js — the Home onboarding ladder, composed from the existing
 * FarmerCompletion engine's flags (single source of truth for what's done).
 *
 * Answers "what should this farmer do FIRST" when the farm is still incomplete, in
 * the spec's priority order: create farm → add crop → add location → first scan.
 * Returns null once those are all done (the live decision engine / hero owns the rest).
 *
 * Honest + deterministic: every step is a real, certain next action (high confidence).
 * No fabricated advice, no backend/provider terms. Pure, total, never throws.
 */
export const HOME_NEXT_STEPS = Object.freeze([
  { key: 'create_farm',  needs: 'farmCreated',
    titleKey: 'home.next.createFarm.title',  titleFallback: 'Create your farm',
    reasonKey: 'home.next.createFarm.reason', reasonFallback: 'Set up your farm so advice fits your land.',
    ctaKey: 'home.next.createFarm.cta',       ctaFallback: 'Create your farm', route: '/onboarding/fast' },
  { key: 'add_crop',     needs: 'cropSelected',
    titleKey: 'home.next.addCrop.title',      titleFallback: 'Add your crop',
    reasonKey: 'home.next.addCrop.reason',    reasonFallback: 'Tell us your crop so today’s advice fits what you grow.',
    ctaKey: 'home.next.addCrop.cta',          ctaFallback: 'Add your crop', route: '/onboarding/fast' },
  { key: 'add_location', needs: 'locationAdded',
    titleKey: 'home.next.addLocation.title',  titleFallback: 'Add your location',
    reasonKey: 'home.next.addLocation.reason', reasonFallback: 'Location unlocks weather-aware tips for your field.',
    ctaKey: 'home.next.addLocation.cta',      ctaFallback: 'Add location', route: '/onboarding/fast' },
  { key: 'first_scan',   needs: 'firstScanCompleted',
    titleKey: 'home.next.firstScan.title',    titleFallback: 'Complete your first scan',
    reasonKey: 'home.next.firstScan.reason',  reasonFallback: 'Scan a plant to get a recommendation you can act on today.',
    ctaKey: 'home.next.firstScan.cta',        ctaFallback: 'Scan a plant', route: '/scan' },
]);

const _done = (flags, key) => {
  if (!flags || typeof flags !== 'object') return false;
  // Accept either a flat boolean map or the FarmerCompletion.completedSteps array.
  if (Array.isArray(flags.completedSteps)) {
    const s = flags.completedSteps.find((x) => x && x.key === key);
    return !!(s && s.done);
  }
  return !!flags[key];
};

/**
 * @param {object} completion FarmerCompletion result (or a flat flag map).
 * @returns the first incomplete ladder step, or null when farm+crop+location+scan are all done.
 */
export function homeNextStep(completion) {
  try {
    if (!completion || typeof completion !== 'object') return null;  // unknown state → defer
    for (const step of HOME_NEXT_STEPS) {
      if (!_done(completion, step.needs)) {
        return Object.freeze({ ...step, confidence: 'high', isOnboarding: true });
      }
    }
    return null;   // farm fully set up → defer to the live decision (hero owns it)
  } catch { return null; }
}
