/**
 * featureGuard.js — Express middleware factory that 404s every
 * request to a feature-flagged route when the flag is off.
 *
 *   router.use(requireFeature('marketplace'))
 *
 * 404 (not 403) so the endpoint is INDISTINGUISHABLE from a
 * non-existent one when disabled — keeps probes from leaking
 * module presence.
 *
 * The predicate is injected for testability. Default imports
 * the live isFeatureEnabled from config/features.js.
 */

import features from '../config/features.js';
const { isFeatureEnabled: defaultIsEnabled } = features;

/**
 * requireFeature(name, opts?) → Express middleware
 *
 * opts.isEnabled — optional predicate override (tests).
 */
export function requireFeature(name, opts = {}) {
  const predicate = typeof opts.isEnabled === 'function'
    ? opts.isEnabled
    : defaultIsEnabled;
  return function featureGuardMiddleware(_req, res, next) {
    let enabled = false;
    try { enabled = predicate(name) === true; } catch { enabled = false; }
    if (enabled) return next();
    return res.status(404).json({
      success: false,
      error:   'Feature not available',
      feature: name,
    });
  };
}

export default { requireFeature };
