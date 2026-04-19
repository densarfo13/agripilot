/**
 * useDynamicGreeting — thin wrapper that composes the greeting
 * from caller-supplied state. It re-computes only when the input
 * object changes (shallow compare via useMemo).
 *
 * Decoupled from app state on purpose: callers pass whatever they
 * know (todayState, missedDays, hasActiveCropCycle, ...) so the
 * hook works equally well on the Today screen, the post-harvest
 * summary, and the first-value screen.
 *
 * Example:
 *   const greeting = useDynamicGreeting({
 *     hasCompletedOnboarding,
 *     hasActiveCropCycle:   !!primaryCrop,
 *     todayState,
 *     missedDays,
 *     hasJustCompletedHarvest,
 *     cropLabel: getCropDisplayName(primaryCrop, language),
 *   }, t);
 *
 *   <DynamicGreeting input={/* ... same * /} t={t} />
 *   // ...or render using the hook output directly if you don't
 *   // want the component wrapper.
 */

import { useMemo } from 'react';
import { getDynamicGreeting } from '../utils/getDynamicGreeting.js';

export function useDynamicGreeting(input = {}, t = null) {
  // The input is expected to be a plain object built per-render;
  // useMemo with the serialized identity keeps us stable across
  // renders that produce the same object shape.
  const key = useMemo(() => stableKey(input) + ':' + (typeof t), [input, t]);
  return useMemo(() => getDynamicGreeting(input, t), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function stableKey(input) {
  if (!input || typeof input !== 'object') return '';
  // Include only fields that getDynamicGreeting actually consumes.
  const fields = [
    'timeOfDay', 'todayState', 'missedDays',
    'hasCompletedOnboarding', 'hasActiveCropCycle',
    'hasJustCompletedHarvest', 'hasCatchUpState',
    'cropLabel', 'inactiveThresholdDays',
  ];
  const parts = [];
  for (const f of fields) {
    const v = input[f];
    parts.push(`${f}=${v == null ? '' : String(v)}`);
  }
  return parts.join('|');
}

export default useDynamicGreeting;
