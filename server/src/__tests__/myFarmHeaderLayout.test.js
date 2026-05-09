/**
 * myFarmHeaderLayout.test.js — pins the May 2026 My Farm /
 * My Grow header simplification:
 *
 *   • <ExperienceTabs> (the Farms / Gardens toggle) lives
 *     INSIDE the <PremiumPageHero> children slot, not as a
 *     standalone block below.
 *   • Exactly ONE <ExperienceTabs> render — no duplicate
 *     toggle floating below the hero.
 *   • The "Farm: {Name}" / "From farm: {Name}" duplicate
 *     mode label between FarmSwitcher and FarmIdentityCard
 *     is gone (removed because it repeated info both
 *     surfaces already render).
 *
 * The test reads the file source — failures are
 * regression-meaningful: anyone reintroducing the standalone
 * toggle or the duplicate mode label fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('My Farm — header simplification (May 2026)', () => {
  it('renders <ExperienceTabs /> exactly ONCE', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // Open tag count — covers both `<ExperienceTabs>` and
    // self-closing `<ExperienceTabs ... />`.
    const opens = (src.match(/<ExperienceTabs(?=[\s/>])/g) || []).length;
    expect(opens).toBe(1);
  });

  it('the toggle now lives INSIDE PremiumPageHero (children slot)', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // Find the slice from `<PremiumPageHero` to its closing
    // `</PremiumPageHero>` — the toggle should appear in that span.
    const open  = src.indexOf('<PremiumPageHero');
    const close = src.indexOf('</PremiumPageHero>');
    expect(open).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(open);
    const heroBlock = src.slice(open, close);
    expect(heroBlock).toMatch(/<ExperienceTabs/);
  });

  it('the duplicate "Farm: {Name}" mode-label block is removed', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // The legacy markup carried `data-testid="my-farm-mode-label"`
    // — that's the single greppable signature for the removed block.
    expect(src).not.toMatch(/data-testid="my-farm-mode-label"/);
    // Plus the legacy i18n keys `myFarm.modeLabel.fromFarm` /
    // `myFarm.modeLabel.farm` are no longer referenced from
    // MyFarmPage.
    expect(src).not.toMatch(/myFarm\.modeLabel\.fromFarm/);
    expect(src).not.toMatch(/myFarm\.modeLabel\.farm/);
  });

  it('PremiumPageHero accepts a children slot (contract)', () => {
    const src = read('src/components/premium/PremiumPageHero.jsx');
    expect(src).toMatch(/children\s*=\s*null/);
    // It must actually render the children somewhere in the JSX.
    expect(src).toMatch(/\{children\s*&&\s*<div\s+style=\{S\.actionRow\}>\{children\}<\/div>\}/);
  });
});
