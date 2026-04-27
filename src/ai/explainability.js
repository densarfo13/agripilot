/**
 * explainability.js — turn a model's per-feature contributions
 * into a short, human-readable "why" line.
 *
 *   topReasons(featuresMap, modelSpec, opts?)
 *     -> { lines: string[], contributors: [...] }
 *
 * Output shape is intentionally tiny. The UI shows a single
 * "High humidity + nearby reports" string; the contributors
 * array is also returned so a richer surface (NGO panel) can
 * render multiple reasons.
 *
 * Strict-rule audit
 *   * pure (calls modelRunner.contributions which is pure)
 *   * never throws (defensive on every input)
 *   * i18n-aware via tSafe + FEATURE_LABEL_KEYS so the reasons
 *     surface in the active UI language without re-training
 */

import { contributions } from './modelRunner.js';
import { tSafe } from '../i18n/tSafe.js';
import { FEATURE_LABEL_KEYS, FEATURE_LABEL_FALLBACKS } from './modelSpec.js';

/**
 * topReasons(featuresMap, modelSpec, opts?)
 *
 * opts:
 *   limit         (number, default 2)   number of contributors to surface
 *   onlyPositive  (boolean, default true) only contributors that
 *                                        increased the prob; the
 *                                        farmer doesn't need to
 *                                        hear "low humidity"
 *                                        when pest risk is HIGH.
 *
 * Returns:
 *   {
 *     lines:        string[]        already-i18n'd labels
 *     contributors: [...]           raw contributors for richer UIs
 *     summary:      string          " + "-joined `lines`
 *   }
 */
export function topReasons(featuresMap, modelSpec, opts = {}) {
  const { limit = 2, onlyPositive = true } = opts || {};
  const all = contributions(featuresMap, modelSpec);
  const filtered = onlyPositive
    ? all.filter((c) => Number.isFinite(c.contribution) && c.contribution > 0)
    : all;

  const top = filtered.slice(0, Math.max(0, Number(limit) || 0));
  const lines = top.map((c) => {
    const key = FEATURE_LABEL_KEYS[c.feature];
    const fb  = FEATURE_LABEL_FALLBACKS[c.feature] || c.feature;
    return tSafe(key || '', fb);
  });

  return Object.freeze({
    lines:        Object.freeze(lines),
    contributors: Object.freeze(top),
    summary:      lines.join(' + '),
  });
}

/**
 * Quick "did the model use the cluster signal?" hint - useful
 * for the farmer banner copy ("Pest activity reported within
 * Xkm" vs "High humidity rising").
 */
export function usedClusterSignal(featuresMap, modelSpec) {
  if (!featuresMap) return false;
  const r = Number(featuresMap.pest_reports);
  if (!Number.isFinite(r) || r <= 0) return false;
  const cs = contributions(featuresMap, modelSpec);
  const pestC = cs.find((c) => c.feature === 'pest_reports');
  return !!(pestC && pestC.contribution > 0);
}
