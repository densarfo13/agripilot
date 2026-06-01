/**
 * NotificationTemplateResolver.ts — resolves {placeholder} tokens in
 * notification template strings against a context, with safe fallbacks
 * so a missing field never leaks `{crop}` style raw text to the UI.
 *
 * Self-contained — zero imports. Frozen exports. Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const NOTIFICATION_TEMPLATE_RESOLVER_VERSION = 'notification-template-resolver-v1' as const;

// Per-token safe fallbacks. Any token not listed here renders as the empty
// string (the resolver strips it from the final text — never raw `{foo}`).
const SAFE_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
  crop: 'your crop',
  plant: 'your plant',
  farm: 'your farm',
  task: 'your task',
  days: 'a few days',
  date: 'soon',
  stage: 'this stage',
  name: 'there',
});

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

export interface ResolveResult {
  text: string;                        // final user-visible text
  unresolvedKeys: ReadonlyArray<string>; // tokens that fell back / were stripped
  hadUnresolvedTokens: boolean;        // true when at least one fallback was used
}

/**
 * Resolve a template string against a context. Order:
 *   1. context[key] (non-empty string / number)
 *   2. SAFE_FALLBACKS[key] (e.g. 'your crop')
 *   3. '' (token stripped entirely so no raw `{key}` ever renders)
 *
 * Examples:
 *   resolve('Check {crop} today', { crop: 'onion' })  → { text: 'Check onion today', ... }
 *   resolve('Check {crop} today', {})                 → { text: 'Check your crop today', unresolvedKeys:['crop'] }
 *   resolve('Update for {unknown}', {})               → { text: 'Update for ', unresolvedKeys:['unknown'] }
 *
 * Returns frozen result. Never throws; never includes raw `{...}` braces.
 */
export function resolve(template: any, context: any): Readonly<ResolveResult> {
  return _safe(() => {
    if (typeof template !== 'string' || !template) {
      return Object.freeze({ text: '', unresolvedKeys: Object.freeze([]) as ReadonlyArray<string>, hadUnresolvedTokens: false });
    }
    const ctx = (context && typeof context === 'object') ? context : {};
    const unresolved: string[] = [];
    const out = template.replace(PLACEHOLDER_RE, (_match, key) => {
      const v = ctx[key];
      if (typeof v === 'string' && v.trim().length > 0) return v;
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      // Fallback path
      unresolved.push(String(key));
      const fb = SAFE_FALLBACKS[String(key)];
      return typeof fb === 'string' ? fb : '';
    }).replace(/\s{2,}/g, ' ').trim();
    return Object.freeze({
      text: out,
      unresolvedKeys: Object.freeze(unresolved.slice()) as ReadonlyArray<string>,
      hadUnresolvedTokens: unresolved.length > 0,
    });
  }, Object.freeze({ text: '', unresolvedKeys: Object.freeze([]) as ReadonlyArray<string>, hadUnresolvedTokens: false }));
}

/** Strict assert helper for the gate / runtime: returns true when the
 *  given text contains NO unresolved `{token}` patterns. */
export function isFullyResolved(text: any): boolean {
  return _safe(() => typeof text === 'string' && !PLACEHOLDER_RE.test(text), false);
}
