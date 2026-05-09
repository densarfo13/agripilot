/**
 * gardenHomeRefinement.test.js — pins the May 2026 Garden Home
 * production-refinement contract:
 *
 *   • PilotHome no longer renders the standalone "Add location
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
  it('PilotHome no longer renders the standalone location-hint paragraph', () => {
    const src = read('src/pages/PilotHome.jsx');
    // Single greppable signature for the removed duplicate.
    expect(src).not.toMatch(/data-testid="pilot-home-location-hint"/);
    // The locationHint style block may still live in the
    // styles table for now, but the JSX render is gone.
    expect(src).not.toMatch(/<p\s+style=\{S\.locationHint\}/);
  });

  it('WeatherHeroActionCard renders the CTA button exactly ONCE', () => {
    const src = read('src/components/WeatherHeroActionCard.jsx');
    // Match the actual <button> render with the canonical
    // testid. We expect ONE such match in the JSX.
    const matches = src.match(/<button[\s\S]*?data-testid="weather-hero-action-cta"[\s\S]*?<\/button>/g) || [];
    expect(matches.length).toBe(1);
  });

  it('weather card minHeight is the reduced 19rem (was 24rem)', () => {
    const src = read('src/components/WeatherHeroActionCard.jsx');
    // The S.section style block is the only minHeight in the
    // file — assert it dropped to 19rem.
    const sectionIdx = src.indexOf('section: {');
    expect(sectionIdx).toBeGreaterThan(0);
    const block = src.slice(sectionIdx, sectionIdx + 400);
    expect(block).toMatch(/minHeight:\s*'19rem'/);
    expect(block).not.toMatch(/minHeight:\s*'24rem'/);
  });

  it('dark overlay softened to warmer rgba(15,28,22,*) tones', () => {
    const src = read('src/components/WeatherHeroActionCard.jsx');
    // The new overlay uses rgba(15,28,22,*) at lower alphas.
    expect(src).toMatch(/rgba\(15,28,22,0\.32\)/);
    // The legacy heavy stops are gone.
    expect(src).not.toMatch(/rgba\(8,18,12,0\.92\)/);
    expect(src).not.toMatch(/rgba\(8,18,12,0\.78\)/);
  });
});
