/**
 * myFarmRealismAlignment.test.js — locks the May 2026 My Farm
 * premium realism alignment pass.
 *
 * What this test pins:
 *   • Imports PREMIUM_TOKENS + RealisticIcon (no more inline
 *     legacy hex literals on the identity card).
 *   • Identity card no longer uses the dark navy `#102C47` or
 *     neon-green `rgba(34,197,94,*)` accents — those flow
 *     through the locked Soft Ochre tokens now.
 *   • Initials photoFallback dropped from 28 → 18 (no more
 *     billboard-sized initials circle).
 *   • Header title dropped from 1.4rem → 1.15rem.
 *   • Scan card no longer renders the 📷 emoji — uses the
 *     canonical RealisticIcon name="scan" instead.
 *   • Scan label is "Scan crop health" (spec §10), NOT
 *     "Scan plant".
 *
 * The test reads the file source — failures are
 * regression-meaningful: anyone reintroducing the legacy
 * styles fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('My Farm — premium realism alignment lock', () => {
  it('imports the locked PREMIUM_TOKENS forward', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/PREMIUM_TOKENS as T/);
    expect(src).toMatch(/from '\.\.\/components\/premium\/tokens\.js'/);
  });

  it('imports the canonical RealisticIcon', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    expect(src).toMatch(/import RealisticIcon/);
    expect(src).toMatch(/from '\.\.\/assets\/realism\/icons\/RealisticIcon\.jsx'/);
  });

  it('identity card no longer uses dark navy #102C47', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // Extract just the identityCard style block — we want to
    // assert the navy literal is gone there, not deny it
    // anywhere else in the file (other surfaces like the
    // legacy missingHint may still carry their own values).
    const idx = src.indexOf('identityCard:');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 400);
    expect(block).not.toMatch(/#102C47/);
    expect(block).toMatch(/T\.panelHi/);   // canonical surface
    expect(block).toMatch(/T\.border/);    // canonical border
  });

  it('photoFallback dropped from 28 → 18 (no billboard initials)', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    const idx = src.indexOf('photoFallback:');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 200);
    expect(block).toMatch(/fontSize:\s*18/);
    expect(block).not.toMatch(/fontSize:\s*28/);
    // Color shifted from neon `#86EFAC` to ochre ink token.
    expect(block).toMatch(/T\.ochreInk/);
    expect(block).not.toMatch(/#86EFAC/);
  });

  it('headerTitle reduced to 1.15rem ink-on-beige', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    const idx = src.indexOf('headerTitle:');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 240);
    expect(block).toMatch(/fontSize:\s*'1\.15rem'/);
    expect(block).not.toMatch(/fontSize:\s*'1\.4rem'/);
    expect(block).toMatch(/color:\s*T\.ink/);
  });

  it('photoWrap uses ochre tint, not neon-green border', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    const idx = src.indexOf('photoWrap:');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 400);
    expect(block).not.toMatch(/rgba\(34,\s*197,\s*94/);
    expect(block).toMatch(/T\.ochreSoft/);
    expect(block).toMatch(/T\.ochreBorder/);
  });

  it('scan card uses RealisticIcon instead of 📷 emoji', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    // Locate the `data-testid="my-farm-scan-plant"` button +
    // assert the surrounding 600 chars (the entire button
    // body) carries the canonical icon component instead of
    // the emoji literal.
    const idx = src.indexOf('data-testid="my-farm-scan-plant"');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 800);
    expect(block).toMatch(/RealisticIcon\s+name="scan"/);
    expect(block).not.toMatch(/📷/);
  });

  it('scan label renamed to "Scan crop health" per spec §10', () => {
    const src = read('src/pages/MyFarmPage.jsx');
    const idx = src.indexOf("'myFarm.scan.label'");
    expect(idx).toBeGreaterThan(0);
    // The fallback string is the second arg to tSafe — it's
    // what renders when the locale doesn't have the key.
    const block = src.slice(idx, idx + 200);
    expect(block).toMatch(/'Scan crop health'/);
    expect(block).not.toMatch(/'Scan plant'/);
  });
});
