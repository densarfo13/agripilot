/**
 * scanAutoAnalyze.test.js — Remove Manual Analyze Button Fix.
 *
 * The bug: after a camera capture, LiveCameraScanner parked on an
 * "image_captured" review screen behind an "Analyze photo" button.
 * The fix: the shutter tap auto-fires onCaptured — the capture IS
 * the analyze intent. The review phase is never entered, so the
 * "Analyze photo" button can no longer render.
 *
 * Source-inspection tests (the components are camera/JSX-heavy;
 * mirrors scanFallbackCopy.test.js's approach).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Camera capture auto-analyzes ───────────────────────

describe('LiveCameraScanner — camera capture auto-analyzes', () => {
  const src = read('src/components/scan/LiveCameraScanner.jsx');

  it('the capture handler fires onCaptured immediately', () => {
    expect(src).toMatch(/onCaptured && onCaptured\(\{ file, dataUrl \}\)/);
  });

  it('the capture path no longer enters the image_captured review phase', () => {
    // setPhase('image_captured') was the only thing that surfaced
    // the "Analyze photo" review screen — it must be gone.
    expect(src).not.toMatch(/setPhase\(\s*['"]image_captured['"]\s*\)/);
  });

  it('"Analyze photo" review screen is therefore unreachable', () => {
    // The button text may still exist in now-dead JSX, but it is
    // gated on phase === 'image_captured', which is never set.
    const idx = src.indexOf("'Analyze photo'");
    if (idx > -1) {
      // if the literal survives, it is inside a phase-gated branch
      const before = src.slice(Math.max(0, idx - 1200), idx);
      expect(before).toMatch(/phase === 'image_captured'/);
    }
    // and nothing sets that phase:
    expect(src).not.toMatch(/setPhase\(\s*['"]image_captured['"]\s*\)/);
  });
});

// ─── 2. Gallery within the overlay auto-analyzes ───────────

describe('LiveCameraScanner — gallery upload auto-analyzes', () => {
  const src = read('src/components/scan/LiveCameraScanner.jsx');

  it('onFileInputChange hands the file straight to onFallbackUpload', () => {
    const idx = src.indexOf('onFileInputChange');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 240);
    expect(block).toMatch(/onFallbackUpload\s*&&\s*onFallbackUpload\(f\)/);
  });
});

// ─── 3. ScanCapture: every path auto-fires analysis ────────

describe('ScanCapture — camera + gallery both auto-analyze', () => {
  const src = read('src/components/scan/ScanCapture.jsx');

  it('camera capture auto-fires continueAnalysis', () => {
    // the live-camera capture handler fires analysis directly
    expect(src).toMatch(/continueAnalysisRef\.current\(capturedFile/);
  });

  it('gallery upload auto-fires continueAnalysis (no Analyze button)', () => {
    // onFileChange auto-fires analysis — the boxed preview wrapper
    // with a manual button was removed.
    expect(src).toMatch(/continueAnalysisRef\.current\(next, url\)/);
  });

  it('does not gate analysis behind an "Analyze photo" button', () => {
    expect(src).not.toMatch(/Analyze photo/);
  });
});
