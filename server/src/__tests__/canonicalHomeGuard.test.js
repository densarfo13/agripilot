/**
 * canonicalHomeGuard.test.js — verifies the dev-only assertion
 * that ONLY src/pages/Home.jsx may render the canonical Home.
 *
 *   • No-op in production.
 *   • Throws when called from a non-canonical file URL.
 *   • Throws when called from a SECOND distinct canonical URL
 *     (defence-in-depth for the "two Home files" mistake).
 *   • Idempotent for re-mounts of the same canonical caller.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Note: production no-op behaviour is verified by build
// inspection (Vite folds `import.meta.env.DEV` to false in
// production builds, dropping the assertion body). It can't
// reliably be exercised here because `import.meta` is
// parse-time-resolved inside the imported module — runtime
// stubGlobal does not reach it. The vitest environment runs
// with DEV=true so the assertions below DO fire.

describe('canonicalHomeGuard', () => {
  it('accepts a canonical caller URL (Home.jsx)', async () => {
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome('file:///src/pages/Home.jsx')).not.toThrow();
  });

  it('accepts a canonical caller URL (Home.tsx — future rename)', async () => {
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome('file:///src/pages/Home.tsx')).not.toThrow();
  });

  it('throws when called from a non-canonical file', async () => {
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome('file:///src/pages/PilotHome.jsx'))
      .toThrow(/\[CANONICAL_HOME\] guard violated/);
  });

  it('throws when called from undefined / null / empty url', async () => {
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome(undefined))
      .toThrow(/\[CANONICAL_HOME\] guard violated/);
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome(''))
      .toThrow(/\[CANONICAL_HOME\] guard violated/);
  });

  it('is idempotent for re-mounts of the same canonical caller', async () => {
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    const url = 'file:///src/pages/Home.jsx';
    // Three consecutive mounts of the SAME canonical file — fine.
    expect(() => mod.assertCanonicalHome(url)).not.toThrow();
    expect(() => mod.assertCanonicalHome(url)).not.toThrow();
    expect(() => mod.assertCanonicalHome(url)).not.toThrow();
  });

  it('throws when a SECOND distinct canonical-shaped URL appears', async () => {
    // Defence-in-depth: even if a future file is named so its URL
    // also contains "/pages/Home" (e.g. /pages/Home2.jsx that
    // matches the fragment check by accident — though our regex
    // requires the exact path), the singleton check catches it.
    // This test uses two URLs that BOTH pass the fragment check
    // (both contain /pages/Home.jsx) to exercise the second-caller
    // branch — the dedupe is purely by string equality.
    const mod = await import('../../../src/lib/canonicalHomeGuard.js');
    mod._resetCanonicalHomeGuard();
    expect(() => mod.assertCanonicalHome('file:///foo/src/pages/Home.jsx')).not.toThrow();
    // Different path prefix, same canonical fragment — second-caller violation.
    expect(() => mod.assertCanonicalHome('file:///bar/src/pages/Home.jsx'))
      .toThrow(/two distinct callers/);
  });
});
