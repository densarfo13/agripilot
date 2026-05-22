/**
 * scanRecoveryStateGuard.test.js — locks in the source-level
 * contract that UsefulResultCard renders a controlled recovery
 * banner (not a macro fallback / not a broken icon) when neither
 * the captured photo nor a thumbnail is available.
 *
 * Also asserts the stableScanSessionStore alias re-exports the
 * spec-named entries and that storeScanSession returns a record
 * with a previewUrl field.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  storeScanSession, getCurrentScanSession, clearScanSession,
  isValidForAnalysis, toAnalyzerInput,
  _setUrlHooks, _resetUrlHooks,
} from '../../../src/core/scan/stableScanSessionStore.js';

function _findRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'src/components/scan/UsefulResultCard.jsx'))) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}
const ROOT = _findRoot();
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── Source-level guard on UsefulResultCard ───────────────

describe('UsefulResultCard — controlled recovery banner', () => {
  const src = read('src/components/scan/UsefulResultCard.jsx');

  it('renders a recovery banner (data-testid="useful-result-image-recovery") when no user photo exists', () => {
    expect(src).toMatch(/useful-result-image-recovery/);
    expect(src).toMatch(/Photo could not be loaded/);
    expect(src).toMatch(/Please choose the photo again/);
  });

  it('still uses SafeImage for the happy path when a user photo is available', () => {
    expect(src).toMatch(/<SafeImage/);
    expect(src).toMatch(/uploadedImageUrl\s*\|\|\s*previewThumb/);
  });
});

// ─── stableScanSessionStore — single-source-of-truth alias ─

describe('stableScanSessionStore — spec-named single source', () => {
  // In-memory URL hooks so the JSDOM-less test env can run.
  let nextUrl = 1;
  beforeEach(() => {
    nextUrl = 1;
    _setUrlHooks(() => `blob://farroway/${nextUrl++}`, () => {});
    clearScanSession();
  });

  it('storeScanSession returns a record with previewUrl + canonical fields', () => {
    const r = storeScanSession({ blob: { size: 200_000, type: 'image/jpeg' } });
    expect(r).toBeTruthy();
    expect(typeof r.previewUrl).toBe('string');
    expect(r.previewUrl).toMatch(/^blob:\/\//);
    expect(r.mimeType).toBe('image/jpeg');
    expect(r.size).toBe(200_000);
  });

  it('getCurrentScanSession exposes the stored record', () => {
    storeScanSession({ blob: { size: 50_000, type: 'image/png' } });
    const cur = getCurrentScanSession();
    expect(cur).toBeTruthy();
    expect(cur.mimeType).toBe('image/png');
    expect(typeof cur.previewUrl).toBe('string');
  });

  it('isValidForAnalysis blocks on missing image / wrong mime / no dims', () => {
    clearScanSession();
    expect(isValidForAnalysis().reason).toBe('no_image');

    storeScanSession({ blob: { size: 200_000, type: 'application/pdf' } });
    expect(isValidForAnalysis().reason).toBe('bad_mime');

    storeScanSession({ blob: { size: 200_000, type: 'image/jpeg' } });
    expect(isValidForAnalysis().reason).toBe('not_loaded');
  });

  it('toAnalyzerInput projects into the classifier shape', () => {
    storeScanSession({ blob: { size: 200_000, type: 'image/jpeg' } });
    const a = toAnalyzerInput();
    expect(a.imageBlob).toBeTruthy();
    expect(a.imageMeta.mimeType).toBe('image/jpeg');
  });

  it('never throws on garbage input', () => {
    expect(() => storeScanSession(null)).not.toThrow();
    expect(storeScanSession(null)).toBe(null);
    expect(() => clearScanSession()).not.toThrow();
  });
});

afterAll(() => _resetUrlHooks());
function afterAll(fn) {
  try {
    if (typeof globalThis.afterAll === 'function') globalThis.afterAll(fn);
    else fn();
  } catch { /* ignore */ }
}
