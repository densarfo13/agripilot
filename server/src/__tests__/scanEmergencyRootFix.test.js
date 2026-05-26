/**
 * scanEmergencyRootFix.test.js — locks in the two upstream fixes
 * for the persistent field reports: ScanPage refuses to advance
 * into the analyze phase with only an Object URL (which would be
 * revoked by ScanCapture's unmount cleanup), and the iOS camera
 * deadline is no longer too short for cold-start Safari.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function _findRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'src/pages/ScanPage.jsx'))) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}
const ROOT = _findRoot();
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('ScanPage — refuses analyze without a safe (data:) image URL', () => {
  const src = read('src/pages/ScanPage.jsx');

  it('defines a safeImageUrl that prefers a dataURL over the Object URL', () => {
    // V5 stability change — imageBase64 is now the 2048-px
    // normalized JPEG (same bytes the AI sees), so it wins over
    // the 96-px thumbnail. imageUrl is included as a LAST resort
    // only when both dataURLs failed (rare); a revoked URL just
    // surfaces the recovery card via the <img> onError path.
    expect(src).toMatch(/const\s+safeImageUrl\s*=\s*imageBase64\s*\|\|\s*thumbnail\s*\|\|\s*imageUrl\s*\|\|\s*null/);
  });

  it('blocks analyze with the recovery banner copy when no safe URL exists', () => {
    expect(src).toMatch(/if\s*\(!safeImageUrl\)/);
    expect(src).toMatch(/Photo could not be loaded\. Please choose the photo again\./);
    expect(src).toMatch(/setPhase\(['"]error['"]\)/);
  });

  it('analyzingImageUrl is set ONLY from the resolved safe URL', () => {
    // The render path uses setAnalyzingImageUrl(safeImageUrl) —
    // we never reconstruct the priority chain inline (that's how
    // the original "object URL leaks into the result card" bug
    // sneaked back in twice).
    expect(src).toMatch(/setAnalyzingImageUrl\(safeImageUrl\)/);
    expect(src).not.toMatch(/setAnalyzingImageUrl\(thumbnail \|\| imageBase64 \|\| imageUrl/);
  });
});

describe('LiveCameraScanner — iOS deadline is generous enough for cold Safari', () => {
  const src = read('src/components/scan/LiveCameraScanner.jsx');

  it('the iOS camera-ready deadline is at least 18 seconds', () => {
    const match = src.match(/CAMERA_READY_DEADLINE_MS_IOS\s*=\s*(\d+)/);
    expect(match).toBeTruthy();
    const ms = Number(match[1]);
    expect(ms).toBeGreaterThanOrEqual(18000);
  });
});
