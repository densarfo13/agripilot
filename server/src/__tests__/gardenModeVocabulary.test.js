/**
 * gardenModeVocabulary.test.js — pins the May 2026 Garden Mode
 * semantic-cleanup contract:
 *
 *   • MyFarmPage carries a _unnamedLabel helper that branches on
 *     `isBackyardActive` so garden-mode users never see "My Farm"
 *     as a fallback name.
 *   • Both FarmIdentityCard + FarmSnapshotCard consume that
 *     branched value (not the raw `tSafe('myFarm.unnamedFarm',
 *     'My Farm')` literal that used to be hardcoded).
 *   • The hero eyebrow + page title + details title all branch
 *     correctly between Farm and Garden vocabulary.
 *   • FarmGardenProfileCard's "My New Farm" string is gated on
 *     farm mode only — garden mode renders "My Grow".
 *
 * The test reads file source — failures are regression-meaningful.
 * Anyone reintroducing a hardcoded "My Farm" fallback that
 * doesn't branch on garden mode fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Garden Mode — semantic vocabulary lock (May 2026)', () => {
  it('MyFarmPage exposes a mode-branched _unnamedLabel helper', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/const\s+_unnamedLabel\s*=\s*isBackyardActive/);
    expect(src).toMatch(/'myGrow\.unnamedGarden',\s*'My Garden'/);
    expect(src).toMatch(/'myFarm\.unnamedFarm',\s*'My Farm'/);
  });

  it('FarmIdentityCard receives the branched _unnamedLabel (not raw "My Farm")', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // Find the FarmIdentityCard JSX block and assert it consumes
    // _unnamedLabel as the fallback in the farmName prop.
    const idx = src.indexOf('<FarmIdentityCard');
    expect(idx).toBeGreaterThan(0);
    const close = src.indexOf('/>', idx);
    expect(close).toBeGreaterThan(idx);
    const block = src.slice(idx, close);
    expect(block).toMatch(/farmName=\{[^}]*_unnamedLabel/);
    // The legacy hardcoded fallback MUST be gone from this prop.
    expect(block).not.toMatch(/farmName=\{[^}]*tSafe\('myFarm\.unnamedFarm',\s*'My Farm'\)/);
  });

  it('FarmSnapshotCard receives the branched _unnamedLabel', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    const idx = src.indexOf('<FarmSnapshotCard');
    expect(idx).toBeGreaterThan(0);
    const close = src.indexOf('/>', idx);
    expect(close).toBeGreaterThan(idx);
    const block = src.slice(idx, close);
    expect(block).toMatch(/farmName=\{[^}]*_unnamedLabel/);
  });

  it('hero eyebrow branches: My Grow vs My Farm', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/_heroEyebrow\s*=\s*isBackyardActive/);
    expect(src).toMatch(/'premium\.eyebrow\.myGrow',\s*'My Grow'/);
    expect(src).toMatch(/'premium\.eyebrow\.myFarm',\s*'My Farm'/);
  });

  it('hero title branches: Your living garden vs Your farm at a glance', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/'myGrow\.hero\.title',\s*'Your living garden'/);
    expect(src).toMatch(/'myFarm\.hero\.title',\s*'Your farm at a glance'/);
  });

  it('page title branches: My Grow vs My Farm', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/'myGrow\.title',\s*'My Grow'/);
    expect(src).toMatch(/'myFarm\.title',\s*'My Farm'/);
  });

  it('details title branches: My Grow Details vs My Farm Details', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/'myGrow\.details\.title',\s*'My Grow Details'/);
    expect(src).toMatch(/'myFarm\.details\.title',\s*'My Farm Details'/);
  });

  it('FarmGardenProfileCard "My New Farm" default is gated on farm mode only', () => {
    const src = read('src/components/home/FarmGardenProfileCard.jsx');
    // The literal string is allowed to live in source — but it
    // MUST be inside an `isGarden ? ... : ...` branch so garden
    // mode renders "My Grow" instead.
    expect(src).toMatch(/isGarden\s*\?\s*tSafe\('home\.profile\.defaultGarden',\s*'My Grow'\)\s*:\s*tSafe\('home\.profile\.defaultFarm',\s*'My New Farm'\)/);
  });
});
