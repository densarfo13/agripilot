/**
 * scanResultRealism.test.js — pins the May 2026 scan-system
 * production rebuild contract for the active result card.
 *
 *   • UsefulResultCard imports RealisticIcon (no more raw emoji
 *     glyphs as primary visual).
 *   • The 7 GUIDANCE entries use `iconName` (canonical
 *     RealisticIcon catalogue key), NOT `emoji`.
 *   • Category chip render no longer interpolates `guidance.emoji`
 *     — it now renders <RealisticIcon name={guidance.iconName}>.
 *   • Retake button label has no leading emoji prefix; the
 *     RealisticIcon component handles the visual.
 *   • Task / agronomy toast strings have no leading ✅ prefix
 *     (the toast text itself communicates success calmly).
 *
 * Failures here are regression-meaningful: anyone reintroducing
 * an `emoji:` field on a guidance entry, or a leading 📷/✅
 * prefix on a user-facing button or toast, fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('UsefulResultCard — scan-system production rebuild', () => {
  it('imports the canonical RealisticIcon component', () => {
    const src = read('src/components/scan/UsefulResultCard.jsx');
    expect(src).toMatch(/import\s+RealisticIcon/);
    expect(src).toMatch(/from '\.\.\/\.\.\/assets\/realism\/icons\/RealisticIcon\.jsx'/);
  });

  it('GUIDANCE entries use iconName (not emoji) for visual', () => {
    const src = read('src/components/scan/UsefulResultCard.jsx');
    // Find the GUIDANCE = Object.freeze({ ... }) block.
    const idx = src.indexOf('const GUIDANCE = Object.freeze({');
    expect(idx).toBeGreaterThan(0);
    const close = src.indexOf('});', idx);
    expect(close).toBeGreaterThan(idx);
    const block = src.slice(idx, close);
    // Every guidance entry now declares iconName.
    const iconCount = (block.match(/iconName:/g) || []).length;
    expect(iconCount).toBeGreaterThanOrEqual(7); // 7 spec categories
    // No `emoji:` keys remain in the GUIDANCE object.
    expect(block).not.toMatch(/^\s*emoji:/m);
  });

  it('category chip renders RealisticIcon, not raw guidance.emoji', () => {
    const src = read('src/components/scan/UsefulResultCard.jsx');
    // Find the `useful-result-category` chip render.
    const idx = src.indexOf('data-testid="useful-result-category"');
    expect(idx).toBeGreaterThan(0);
    // Look at the surrounding 600 chars (the chip's body).
    const block = src.slice(idx, idx + 600);
    expect(block).toMatch(/<RealisticIcon\s+name=\{guidance\.iconName/);
    // The legacy `{guidance.emoji}` interpolation MUST be gone
    // from this chip body.
    expect(block).not.toMatch(/\{guidance\.emoji\}/);
  });

  it('retake button has no leading emoji prefix', () => {
    const src = read('src/components/scan/UsefulResultCard.jsx');
    // The legacy fallback strings carried "📷 Retake plant photo"
    // / "📷 Retake crop photo" / "📷 Retake photo". They must
    // be plain text now — RealisticIcon component handles the
    // visual.
    expect(src).toMatch(/'scan\.button\.retakePlant',\s*'Retake plant photo'/);
    expect(src).toMatch(/'scan\.button\.retakeCrop',\s*'Retake crop photo'/);
    expect(src).toMatch(/'scan\.button\.retake',\s*'Retake photo'/);
  });

  it('task-added + agronomy-sent toasts have no leading ✅ prefix', () => {
    const src = read('src/components/scan/UsefulResultCard.jsx');
    expect(src).toMatch(/'scan\.toast\.taskAdded',\s*'Task added'/);
    expect(src).toMatch(/'scan\.toast\.agronomySent',\s*'Request saved\./);
    // Defence-in-depth: no ✅-prefixed fallback strings remain.
    expect(src).not.toMatch(/'✅\s+Task added'/);
    expect(src).not.toMatch(/'✅\s+Request saved/);
  });
});
