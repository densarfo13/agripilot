/**
 * safeTranslate.js — the canonical "one language per block" helper.
 *
 * Wraps the existing `resolveBlock` with the exact API the gap-fix
 * spec §1 calls for, so new callers have a single obvious import:
 *
 *   safeTranslate(t, keysForBlock, englishFallbacks, { required? })
 *     → { values, translated }
 *
 * Behaviour (spec §1):
 *   • If every required key has a real translation → return the
 *     translated values.
 *   • If any required key is missing → fall the ENTIRE block back
 *     to English. No mixed-language render possible within a block.
 *   • Never returns the raw translation key (so `auth.foo.bar` can
 *     never leak to the screen).
 *
 * This is an *additive* helper. Existing `resolveBlock` callers keep
 * working unchanged; new cards/screens import `safeTranslate` for a
 * more obvious name.
 *
 *   import { safeTranslate } from '../lib/i18n/safeTranslate.js';
 *   const { values } = safeTranslate(t,
 *     { title: 'home.title', cta: 'home.cta' },
 *     { title: 'Welcome',    cta: 'Open'     });
 *   return <h1>{values.title}</h1>;
 */

import { resolveBlock, resolveOne } from './blockResolve.js';

/**
 * safeTranslate — atomic per-block resolution.
 *
 *   t             — translator function from the i18n context
 *   keysForBlock  — { name: 'dot.notation.key', ... }
 *   englishFallbacks — { name: 'English string',  ... }
 *   opts.required — optional subset of keys that MUST translate for
 *                   the block to render in the active locale
 *
 *   returns { values, translated }
 */
export function safeTranslate(t, keysForBlock = {}, englishFallbacks = {}, opts = {}) {
  return resolveBlock(t, keysForBlock, englishFallbacks, opts);
}

/**
 * safeTranslateOne — per-key variant. Never returns the raw key —
 * falls back to the supplied English string (or empty) when the
 * translation is missing. Convenience for card titles / button
 * labels where the block pattern is overkill.
 */
export function safeTranslateOne(t, key, fallback = '') {
  return resolveOne(t, key, fallback);
}

// Re-export the original name so existing imports keep working.
export { resolveBlock, resolveOne };
