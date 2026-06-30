/**
 * resolveCompletionCrop.js — does this farm actually have a crop?
 *
 * The Home onboarding ladder (homeNextStep) must NOT show "Add your crop" once a crop
 * exists. The bug: the ladder's completion input read only `farm.crop || farm.cropId`,
 * but a crop can be stored under cropName / cropType / cropDisplayName depending on the
 * creation path (FastOnboarding writes `crop`, the API layer uses `cropType`, and
 * _resolveCrop treats `cropName` as primary). So a farm with a crop under cropName
 * reported cropSelected=false → stale "Add your crop".
 *
 * This is the SINGLE resolver for "the farm's crop, or empty when there is none" — it
 * checks every field the app uses, in the same priority as _resolveCrop, and returns ''
 * when no crop is set (so buildFarmerCompletion marks cropSelected correctly).
 *
 * Pure, total, never throws. No I/O, no React.
 */
const _str = (v) => (typeof v === 'string' ? v.trim() : '');

export function resolveCompletionCrop(farm) {
  if (!farm || typeof farm !== 'object') return '';
  // Priority mirrors _resolveCrop / resolveCropName across the app — any non-empty wins.
  return (
    _str(farm.cropName) ||
    _str(farm.crop) ||
    _str(farm.cropType) ||
    _str(farm.cropDisplayName) ||
    _str(farm.cropId) ||
    ''
  );
}

export default resolveCompletionCrop;
