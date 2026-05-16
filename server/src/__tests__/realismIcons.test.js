/**
 * realismIcons.test.js — locks the May 2026 realism-icon catalogue
 * and pins the canonical scan surfaces' emoji-to-icon swap.
 *
 *   • Catalogue covers the spec-mandated agricultural glyphs.
 *   • slotPath() refuses unsafe filesystem fragments.
 *   • SafeCameraSurface no longer contains the 📷 emoji.
 *   • SoilScanPage placeholder no longer contains 📷.
 *   • ScanPage soil tile no longer contains 🪴.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

// ─── Catalogue ───────────────────────────────────────────────────
describe('realism/icons — catalogue lock', () => {
  it('exposes every spec-mandated icon name', async () => {
    const { REALISTIC_ICON_NAMES } =
      await import('../../../src/assets/realism/icons/RealisticIcon.jsx');
    const required = [
      'camera', 'crop', 'leaf', 'soil',
      'sun', 'cloud', 'rain',
      'scan', 'tasks', 'funding',
      'sell', 'buyer', 'spark',
    ];
    for (const name of required) {
      expect(REALISTIC_ICON_NAMES).toContain(name);
    }
  });

  it('is frozen so a downstream caller cannot mutate the list', async () => {
    const { REALISTIC_ICON_NAMES } =
      await import('../../../src/assets/realism/icons/RealisticIcon.jsx');
    expect(Object.isFrozen(REALISTIC_ICON_NAMES)).toBe(true);
  });
});

// ─── Photography manifest ───────────────────────────────────────
describe('realism/photography — slot manifest', () => {
  it('PHOTO_SLOTS is frozen and covers the spec slot families', async () => {
    const { PHOTO_SLOTS } = await import('../../../src/assets/realism/photography/manifest.js');
    expect(Object.isFrozen(PHOTO_SLOTS)).toBe(true);
    // Hero / crop / soil / produce / funding families all present.
    const families = ['HERO_DAYLIGHT_FIELD', 'CROP_MAIZE', 'SOIL_DRY_LOAM',
                      'PRODUCE_BASKET_TOMATO', 'FUNDING_DESK_PAPERWORK'];
    for (const k of families) expect(PHOTO_SLOTS[k]).toBeTruthy();
  });

  it('slotPath returns the canonical path only for slots in AVAILABLE_SLOTS', async () => {
    const { slotPath, AVAILABLE_SLOTS } = await import('../../../src/assets/realism/photography/manifest.js');
    // Production photo shoot pending — until a slot lands under
    // public/assets/realism/photography/<slot>.webp, slotPath()
    // returns '' so the RealisticPhoto fallback renders without
    // firing a 404. As soon as a slot name is added to
    // AVAILABLE_SLOTS, the resolver picks it up automatically.
    expect(slotPath('crop-maize')).toBe(
      AVAILABLE_SLOTS.has('crop-maize')
        ? '/assets/realism/photography/crop-maize.webp'
        : '',
    );
    // AVAILABLE_SLOTS is the gate: shipped slots return their path.
    for (const slot of AVAILABLE_SLOTS) {
      expect(slotPath(slot)).toBe(`/assets/realism/photography/${slot}.webp`);
    }
  });

  it('slotPath refuses path-traversal + unsafe slot strings', async () => {
    const { slotPath } = await import('../../../src/assets/realism/photography/manifest.js');
    expect(slotPath('../etc/passwd')).toBe('');
    expect(slotPath('crop_maize')).toBe('');     // underscore not allowed
    expect(slotPath('Crop-Maize')).toBe('');     // upper-case not allowed
    expect(slotPath('crop-maize/x')).toBe('');   // path separator not allowed
    expect(slotPath('')).toBe('');
    expect(slotPath(null)).toBe('');
  });
});

// ─── Canonical surfaces — emoji removed ──────────────────────────
describe('realism migration — canonical surfaces dropped legacy emoji', () => {
  // NOTE: the SafeCameraSurface emoji-swap test was removed — the
  // component was deleted in the canonical-home replacement pass
  // (LiveCameraScanner owns the camera surface now). Test debt
  // cleanup: the code path no longer exists.

  it('SoilScanPage placeholder uses RealisticIcon "soil" (no 📷)', () => {
    const src = read('src/pages/SoilScanPage.jsx');
    expect(src).not.toMatch(/📷/);
    expect(src).toMatch(/RealisticIcon/);
    expect(src).toMatch(/name="soil"/);
  });

  it('ScanPage soil tile uses RealisticIcon (no 🪴 emoji)', () => {
    const src = read('src/pages/ScanPage.jsx');
    expect(src).not.toMatch(/🪴/);
    expect(src).toMatch(/RealisticIconLazy|RealisticIcon/);
  });
});
