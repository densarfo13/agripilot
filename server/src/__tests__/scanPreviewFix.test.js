/**
 * scanPreviewFix.test.js — Final Scan Preview + Gallery-First Fix.
 *
 * The scan result was dropping the farmer's own captured photo:
 * UsefulResultCard computed `userImage` but never rendered it, and
 * a revoked blob: URL / 404'd remote URL would show the browser's
 * broken-image icon. The fix renders the captured photo through
 * SafeImage (one-shot fallback) so the result always shows an
 * image and never a broken placeholder.
 *
 * Source-inspection tests (the components use hooks + JSX; this
 * mirrors scanFallbackCopy.test.js's approach).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Result preview renders via SafeImage ───────────────

describe('UsefulResultCard — result image preview fix', () => {
  const src = read('src/components/scan/UsefulResultCard.jsx');

  it('imports SafeImage', () => {
    expect(src).toMatch(/import SafeImage from '\.\.\/common\/SafeImage\.jsx'/);
  });

  it('renders the result image through <SafeImage> (no bare broken <img>)', () => {
    expect(src).toMatch(/<SafeImage/);
    // the old macro-only raw <img src={macroPhoto}> block is gone
    expect(src).not.toMatch(/<img\s+src=\{macroPhoto\}/);
  });

  it('prefers the farmer’s captured photo, falls back to thumbnail then macro', () => {
    expect(src).toMatch(/uploadedImageUrl\s*\|\|\s*previewThumb/);
    expect(src).toMatch(/displayFallback\s*=\s*previewThumb\s*\|\|\s*macroPhoto/);
  });

  it('passes a fallback to SafeImage so a revoked/404 URL never breaks', () => {
    const idx = src.indexOf('<SafeImage');
    const block = src.slice(idx, idx + 320);
    expect(block).toMatch(/src=\{displaySrc\}/);
    expect(block).toMatch(/fallback=\{displayFallback\}/);
  });
});

// ─── 2. [SCAN_PREVIEW] dev diagnostic (spec §6) ────────────

describe('UsefulResultCard — [SCAN_PREVIEW] diagnostic', () => {
  const src = read('src/components/scan/UsefulResultCard.jsx');

  it('logs the [SCAN_PREVIEW] diagnostic with the documented fields', () => {
    expect(src).toMatch(/\[SCAN_PREVIEW\]/);
    expect(src).toMatch(/hasSelectedImage:/);
    expect(src).toMatch(/hasPreviewUrl:/);
    expect(src).toMatch(/hasUploadedImageUrl:/);
    expect(src).toMatch(/resultImageSource/);
    expect(src).toMatch(/revokedTooEarly/);
  });

  it('the diagnostic is dev-gated (import.meta.env.DEV)', () => {
    const idx = src.indexOf("console.log('[SCAN_PREVIEW]'");
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 200), idx);
    expect(before).toMatch(/import\.meta\.env\.DEV/);
  });
});

// ─── 3. Camera fallback wording (spec §3) ──────────────────

describe('ScanFallback — camera-not-ready wording', () => {
  const src = read('src/components/scan/ScanFallback.jsx');

  it('camera_unavailable uses the calm "Camera is not available right now" copy', () => {
    const idx = src.indexOf('camera_unavailable:');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 200);
    expect(block).toMatch(/Camera is not available right now/);
    expect(block).toMatch(/Upload a photo instead/);
  });

  it('the legacy "Scan is taking longer than expected" wording stays gone', () => {
    expect(src).not.toMatch(/Scan is taking longer than expected/);
  });
});
