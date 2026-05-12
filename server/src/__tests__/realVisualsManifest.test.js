/**
 * realVisualsManifest.test.js — guards the realism image registry.
 *
 * Every path literal of the shape `/assets/realism/...` referenced
 * inside src/lib/realVisuals.jsx must correspond to an actual file
 * under public/. When this test fails, the consumer renders a 404
 * in production (background-image still 404s in DevTools even when
 * the visible UI uses a gradient fallback).
 *
 * Typical drift signal:
 *   • A new hero is added to a region pack but the file was renamed
 *     during the upload and never re-stamped in the resolver.
 *   • An operator photo is moved between region folders and the
 *     resolver still points at the old path.
 *   • A file is removed from public/ but a stale entry survives in
 *     realVisuals.jsx.
 *
 * Failure mode is calm: the failed assertion lists every missing
 * file alongside its on-disk lookup path so the author can either
 * (a) commit the missing file under public/, or (b) drop the stale
 * entry from realVisuals.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 10000 });

// `__dirname` here is server/src/__tests__ — climb to repo root.
const ROOT = resolve(__dirname, '../../../');

describe('resolveRealismImage — runtime-safe path resolver', () => {
  it('echoes a valid /assets/realism/ path back', async () => {
    const { resolveRealismImage } = await import('../../../src/lib/realVisuals.jsx');
    const p = '/assets/realism/farm/cassava-leaf.jpeg';
    expect(resolveRealismImage(p)).toBe(p);
  });

  it('returns the default fallback for undefined / null / empty', async () => {
    const { resolveRealismImage, DEFAULT_REALISM_FALLBACK } =
      await import('../../../src/lib/realVisuals.jsx');
    expect(resolveRealismImage(undefined)).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage(null)).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage('')).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage('   ')).toBe(DEFAULT_REALISM_FALLBACK);
  });

  it('honours caller-supplied fallback', async () => {
    const { resolveRealismImage } = await import('../../../src/lib/realVisuals.jsx');
    expect(resolveRealismImage(undefined, '/custom/x.jpeg')).toBe('/custom/x.jpeg');
  });

  it('rejects non-realism paths (defends against ../, ./, src/)', async () => {
    const { resolveRealismImage, DEFAULT_REALISM_FALLBACK } =
      await import('../../../src/lib/realVisuals.jsx');
    // ./, ../, and src/ paths can crash Vite's build URL rewriter
    // or escape the public/ root in production — all must fall back.
    expect(resolveRealismImage('./assets/realism/farm/x.jpeg')).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage('../assets/realism/farm/x.jpeg')).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage('src/assets/realism/farm/x.jpeg')).toBe(DEFAULT_REALISM_FALLBACK);
    // Anything that isn't /assets/realism/ falls back too.
    expect(resolveRealismImage('/icons/logo-premium.jpg')).toBe(DEFAULT_REALISM_FALLBACK);
  });

  it('blocks path traversal attempts (.. segments anywhere)', async () => {
    const { resolveRealismImage, DEFAULT_REALISM_FALLBACK } =
      await import('../../../src/lib/realVisuals.jsx');
    expect(resolveRealismImage('/assets/realism/../etc/passwd')).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage('/assets/realism/farm/../../../etc')).toBe(DEFAULT_REALISM_FALLBACK);
  });

  it('never throws on arbitrary garbage input', async () => {
    const { resolveRealismImage, DEFAULT_REALISM_FALLBACK } =
      await import('../../../src/lib/realVisuals.jsx');
    // Non-string types — number, object, boolean, symbol.
    expect(resolveRealismImage(42)).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage({})).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage(false)).toBe(DEFAULT_REALISM_FALLBACK);
    expect(resolveRealismImage([])).toBe(DEFAULT_REALISM_FALLBACK);
  });
});

describe('realVisuals manifest — every referenced asset exists in public/', () => {
  it('lists no path that 404s on the deployed build', () => {
    const src = readFileSync(resolve(ROOT, 'src/lib/realVisuals.jsx'), 'utf8');

    // Match anything inside single quotes that starts with
    // `/assets/realism/`. Vite serves public/ at /, so a path like
    // `/assets/realism/farm/pepper-closeup.jpeg` resolves to
    // `public/assets/realism/farm/pepper-closeup.jpeg`.
    const re = /'(\/assets\/realism\/[^']+)'/g;
    const seen = new Set();
    let m;
    while ((m = re.exec(src)) !== null) {
      seen.add(m[1]);
    }

    // Sanity: realVisuals.jsx WILL reference at least one path.
    // A zero count means the regex broke, not that we have no assets.
    expect(seen.size).toBeGreaterThan(0);

    const missing = [];
    for (const p of seen) {
      // `/assets/...` → `public/assets/...`
      const onDisk = resolve(ROOT, 'public' + p);
      if (!existsSync(onDisk)) missing.push({ path: p, onDisk });
    }

    if (missing.length > 0) {
      // Build a human-readable diff so the author sees every gap
      // at once. Vitest renders the assertion message verbatim
      // alongside the failed `expect` line.
      const lines = missing.map((row) => `  • ${row.path}\n      not found at: ${row.onDisk}`);
      const msg =
        `realVisuals.jsx references ${missing.length} path` +
        `${missing.length === 1 ? '' : 's'} that do not exist under public/:\n` +
        lines.join('\n') +
        '\n\nFix by either:\n' +
        '  (a) committing the missing file under public/, or\n' +
        '  (b) removing the stale entry from src/lib/realVisuals.jsx.';
      throw new Error(msg);
    }
    expect(missing).toEqual([]);
  });
});
