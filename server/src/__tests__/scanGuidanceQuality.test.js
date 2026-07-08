/**
 * scanGuidanceQuality.test.js — locks the 2026-07-06 fix that stops the scan failure
 * card from leaking the raw internal quality label "unknown" to the farmer.
 *
 * Observed bug: ScanGuidanceCard's _qualityText() ended with `return String(label)`, so a
 * PhotoQualityEngine label of "unknown" (or any unrecognised internal string) rendered as
 * "Photo quality: unknown" — a raw internal term on the farmer screen. Fix: unknown/
 * unmeasured/unrecognised → "Not measured yet"; only the mapped farmer words otherwise.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '../../../src/components/scan/ScanGuidanceCard.jsx'), 'utf8');

describe('ScanGuidanceCard — quality label never leaks "unknown"', () => {
  it('does NOT fall back to the raw internal label (the removed `return String(label)`)', () => {
    expect(SRC).not.toMatch(/return\s+String\(label\)/);
  });

  it('maps unknown/unmeasured to a "Not measured yet" farmer string', () => {
    expect(SRC).toMatch(/unknown['"]?\s*\|\|/); // unknown handled explicitly
    expect(SRC).toMatch(/scan\.guidance\.quality\.notMeasured/);
    expect(SRC).toMatch(/Not measured yet/);
  });

  it('the final fallback is notMeasured, not the raw label', () => {
    // last return in _qualityText must be the notMeasured sentinel
    const fn = SRC.slice(SRC.indexOf('function _qualityText'), SRC.indexOf('const TIPS'));
    const returns = fn.match(/return\s+([^;]+);/g) || [];
    const last = returns[returns.length - 1] || '';
    expect(last).toMatch(/notMeasured/);
    expect(last).not.toMatch(/String\(label\)/);
  });

  it('the farmer word map is preserved (Excellent/Good/Fair/Poor still honest)', () => {
    for (const w of ['excellent', 'good', 'fair', 'poor']) {
      expect(SRC.toLowerCase()).toContain(`'${w}'`);
    }
  });
});
