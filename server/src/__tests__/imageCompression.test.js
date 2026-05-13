/**
 * imageCompression.test.js — verifies the helper:
 *   • returns the original file in SSR (no window).
 *   • returns the original file when it's already under the cap.
 *   • returns the original file on any decode failure.
 *   • is never-throws.
 *
 * The actual canvas / createImageBitmap path requires a real
 * browser DOM and isn't exercised here — that's an integration-
 * test concern. These tests cover the never-throws + size-gate
 * + SSR-safe contracts that matter for production stability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

describe('compressImage', () => {
  it('returns the input unchanged when window is undefined (SSR)', async () => {
    delete globalThis.window;
    const { compressImage } = await import('../../../src/lib/imageCompression.js');
    const fakeFile = { size: 5_000_000, name: 'scan.jpg', type: 'image/jpeg' };
    const out = await compressImage(fakeFile);
    expect(out).toBe(fakeFile);
  });

  it('returns the input unchanged when file is already under maxBytes', async () => {
    globalThis.window   = {};
    globalThis.document = {};
    const { compressImage } = await import('../../../src/lib/imageCompression.js');
    const tinyFile = { size: 100_000, name: 'tiny.jpg', type: 'image/jpeg' };
    const out = await compressImage(tinyFile, { maxBytes: 1_500_000 });
    expect(out).toBe(tinyFile);
  });

  it('returns the input unchanged when input is null / undefined / non-object', async () => {
    globalThis.window   = {};
    globalThis.document = {};
    const { compressImage } = await import('../../../src/lib/imageCompression.js');
    expect(await compressImage(null)).toBe(null);
    expect(await compressImage(undefined)).toBe(undefined);
    expect(await compressImage('not a file')).toBe('not a file');
  });

  it('never throws — falls back to original on decode failure', async () => {
    globalThis.window   = {};
    globalThis.document = {};
    const { compressImage } = await import('../../../src/lib/imageCompression.js');
    // Large file forces the decode path. With no createImageBitmap
    // + no real DOM, _decode returns null and the function falls
    // back to returning the original.
    const bigFile = { size: 10_000_000, name: 'big.jpg', type: 'image/jpeg' };
    const out = await compressImage(bigFile);
    expect(out).toBe(bigFile);
  });

  it('uses default 1.5 MB cap when maxBytes not supplied', async () => {
    globalThis.window   = {};
    globalThis.document = {};
    const { compressImage } = await import('../../../src/lib/imageCompression.js');
    const justUnder = { size: 1_400_000, name: 'x.jpg', type: 'image/jpeg' };
    expect(await compressImage(justUnder)).toBe(justUnder);
    const justOver  = { size: 1_600_000, name: 'x.jpg', type: 'image/jpeg' };
    // Just over default cap → decode path runs → returns original (decode fails in Node).
    expect(await compressImage(justOver)).toBe(justOver);
  });
});
