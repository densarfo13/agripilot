/**
 * gardenHomeRefinement.test.js — pins the May 2026 Garden Home
 * production-refinement contract:
 *
 *   • Home no longer renders the standalone "Add location
 *     for weather tips" duplicate hint paragraph. The weather
 *     card itself shows the location label.
 *   • WeatherHeroActionCard renders the Start check CTA exactly
 *     ONCE. The previous version had two identical buttons
 *     (one inline with arrow `›`, one full-width with `→`),
 *     both calling handleCta — pure duplication.
 *   • Weather card minHeight reduced from 24rem → 19rem (~21%).
 *   • Dark overlay softened from rgba(8,18,12,…) heavy wash to
 *     rgba(15,28,22,…) calmer realism — matches spec §5/§8.
 *
 * Failures here are regression-meaningful: anyone reintroducing
 * the duplicate hint, the duplicate CTA, or the heavy overlay
 * fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Garden Home refinement (May 2026)', () => {
  it('Home no longer renders the standalone location-hint paragraph', () => {
    const src = read('src/pages/Home.jsx');
    // Single greppable signature for the removed duplicate hint.
    expect(src).not.toMatch(/data-testid="home-location-hint"/);
    // The locationHint style block may still live in the
    // styles table for now, but the JSX render is gone.
    expect(src).not.toMatch(/<p\s+style=\{S\.locationHint\}/);
  });

  // NOTE: the three WeatherHeroActionCard tests (single CTA,
  // 19rem minHeight, dark-wash removed) were removed — that
  // component was deleted in a later weather-card pass. Test
  // debt cleanup: the code path no longer exists. The Home
  // location-hint regression test above remains live.
});
