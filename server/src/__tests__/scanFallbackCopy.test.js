/**
 * scanFallbackCopy.test.js — Scan + Asset Final Blocker Fix §7.
 *
 * The generic "Scan is taking longer than expected" was the
 * visible dead-end the spec called out. ScanFallback's RETRY_COPY
 * now maps every state-specific reason to a calm copy block with
 * a clear next action.
 *
 * Coverage:
 *   - Every spec-mandated state has dedicated copy (no
 *     generic-timeout fall-through for known states)
 *   - The legacy `timeout` key keeps a CALMER message (the old
 *     scary one is gone)
 *   - No copy entry is empty
 *   - No copy still contains the legacy "Scan is taking longer
 *     than expected" string
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('ScanFallback RETRY_COPY — state-specific outcomes (spec §7)', () => {
  const src = read('src/components/scan/ScanFallback.jsx');

  it('has copy for the new spec-mandated reasons', () => {
    expect(src).toMatch(/upload_failed:/);
    expect(src).toMatch(/analysis_delayed:/);
    expect(src).toMatch(/ai_unavailable:/);
    expect(src).toMatch(/low_confidence:/);
    expect(src).toMatch(/network_unavailable:/);
  });

  it('legacy "Scan is taking longer than expected" message is GONE', () => {
    expect(src).not.toMatch(/Scan is taking longer than expected/);
  });

  it('permission_denied uses the calm "Camera is blocked" copy + upload CTA', () => {
    const idx = src.indexOf('permission_denied:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/Camera is blocked/);
    expect(window).toMatch(/Upload a photo/);
  });

  it('upload_failed suggests a smaller photo', () => {
    const idx = src.indexOf('upload_failed:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/smaller photo/);
  });

  it('analysis_delayed reassures the user the photo is saved', () => {
    const idx = src.indexOf('analysis_delayed:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/saved for retry/);
  });

  it('ai_unavailable promotes the manual fallback path', () => {
    const idx = src.indexOf('ai_unavailable:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/Smart check unavailable/);
    expect(window).toMatch(/manually/);
  });

  it('low_confidence offers retake OR manual pick', () => {
    const idx = src.indexOf('low_confidence:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/Retake/);
    expect(window).toMatch(/symptom/);
  });

  it('network_unavailable promises auto-retry on reconnect', () => {
    const idx = src.indexOf('network_unavailable:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/offline/);
    expect(window).toMatch(/automatically/);
  });

  it('legacy timeout entry kept (back-compat) but uses calmer wording', () => {
    const idx = src.indexOf('timeout:');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).toMatch(/Camera is taking a moment/);
    expect(window).not.toMatch(/taking longer than expected/);
  });
});

// ─── Acceptance — the typo rename is reflected ─────────────

describe('Acceptance — afrca → africa rename', () => {
  it('REALISM_ASSETS no longer references the typo path', () => {
    const src = read('src/lib/realVisuals.jsx');
    expect(src).not.toMatch(/afrca-sunrise-farm\.jpeg/);
    expect(src).toMatch(/africa-sunrise-farm\.jpeg/);
  });

  it('no src/ file references "afrca" string anymore', () => {
    // Walk the most likely places. The check:assets script + the
    // assetManifestGuard suite cover the on-disk verification;
    // this test pins the README-level guarantee that the typo
    // is gone from active source.
    const files = [
      'src/lib/realVisuals.jsx',
      'src/constants/pageHeroImages.js',
      'src/lib/farmActiveCache.js',
    ];
    for (const f of files) {
      const content = read(f);
      expect(content).not.toMatch(/afrca-sunrise/);
    }
  });
});
