/**
 * visualHeaderConsistency.test.js — verifies the Visual Header
 * Consistency Fix:
 *
 *   1. safeImage(): render-safety guard + canonical fallback
 *   2. pageHeroImages map: every key maps to a real realism photo
 *   3. PageHero component: thin wrapper around PremiumPageHero
 *      delegates props correctly
 *   4. Replacement contract: Tasks / Sell / SoilScan now reference
 *      the realism path (not the flat /images/page-hero/*.svg)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

import {
  safeImage,
  isRenderableImage,
  DEFAULT_FARM_IMAGE,
} from '../../../src/utils/safeImage.js';
import {
  PAGE_HERO_IMAGES,
  getPageHeroImage,
} from '../../../src/constants/pageHeroImages.js';
import PageHero from '../../../src/components/ui/PageHero.jsx';

// ─── 1. safeImage ─────────────────────────────────────────────

describe('safeImage', () => {
  it('returns the canonical farm photo for null / undefined / empty input', () => {
    expect(safeImage(null)).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage(undefined)).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage('')).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage('   ')).toBe(DEFAULT_FARM_IMAGE);
  });

  it('returns the canonical farm photo for non-string input', () => {
    expect(safeImage(42)).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage({ foo: 1 })).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage([])).toBe(DEFAULT_FARM_IMAGE);
  });

  it('rejects path-traversal attempts', () => {
    expect(safeImage('../etc/passwd')).toBe(DEFAULT_FARM_IMAGE);
    expect(safeImage('/assets/../secrets')).toBe(DEFAULT_FARM_IMAGE);
  });

  it('accepts root-relative paths', () => {
    expect(safeImage('/assets/realism/heroes/x.jpeg')).toBe('/assets/realism/heroes/x.jpeg');
    expect(safeImage('/icons/logo.svg')).toBe('/icons/logo.svg');
  });

  it('accepts http(s), data, blob URLs', () => {
    expect(safeImage('https://cdn.example/img.jpg')).toBe('https://cdn.example/img.jpg');
    expect(safeImage('http://x.test/img.png')).toBe('http://x.test/img.png');
    expect(safeImage('data:image/jpeg;base64,abc')).toBe('data:image/jpeg;base64,abc');
    expect(safeImage('blob:http://x.test/abc')).toBe('blob:http://x.test/abc');
  });

  it('uses caller-supplied fallback when input is bad', () => {
    expect(safeImage(null, '/icons/logo-192.png')).toBe('/icons/logo-192.png');
  });

  it('falls through to DEFAULT when both candidate AND fallback are bad', () => {
    expect(safeImage(null, '../bad')).toBe(DEFAULT_FARM_IMAGE);
  });

  it('isRenderableImage matches safeImage acceptance', () => {
    expect(isRenderableImage('/assets/realism/x.jpeg')).toBe(true);
    expect(isRenderableImage('https://x.test/x.jpeg')).toBe(true);
    expect(isRenderableImage('../bad')).toBe(false);
    expect(isRenderableImage(null)).toBe(false);
  });
});

// ─── 2. pageHeroImages map ────────────────────────────────────

describe('pageHeroImages map', () => {
  it('every key maps to a realism /assets/realism/* path', () => {
    const keys = Object.keys(PAGE_HERO_IMAGES);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    for (const key of keys) {
      expect(PAGE_HERO_IMAGES[key]).toMatch(/^\/assets\/realism\//);
    }
  });

  it('covers the spec-mandated page keys', () => {
    for (const key of ['home', 'tasks', 'myFarm', 'progress', 'scan', 'funding', 'sell', 'journal']) {
      expect(PAGE_HERO_IMAGES[key]).toBeTruthy();
    }
  });

  it('getPageHeroImage falls back to the default on unknown keys', () => {
    expect(getPageHeroImage('not-a-real-page')).toBe(DEFAULT_FARM_IMAGE);
    expect(getPageHeroImage(null)).toBe(DEFAULT_FARM_IMAGE);
    expect(getPageHeroImage('')).toBe(DEFAULT_FARM_IMAGE);
  });

  it('the registry is frozen at runtime', () => {
    expect(Object.isFrozen(PAGE_HERO_IMAGES)).toBe(true);
  });
});

// ─── 3. PageHero wrapper ─────────────────────────────────────

describe('PageHero (thin wrapper)', () => {
  it('returns null when title is missing or non-string', () => {
    expect(PageHero({ pageKey: 'tasks' })).toBeNull();
    expect(PageHero({ pageKey: 'tasks', title: '' })).toBeNull();
    expect(PageHero({ pageKey: 'tasks', title: 42 })).toBeNull();
  });

  it('renders a React element with PremiumPageHero under the hood', () => {
    const el = PageHero({
      pageKey: 'tasks',
      title:   'Tasks',
      subtitle: 'Stay on top of what matters most.',
    });
    expect(el).toBeTruthy();
    // The wrapper hands off to PremiumPageHero — verify by checking
    // the element's type displayName/name.
    const typeName = el.type && (el.type.displayName || el.type.name);
    expect(typeName).toBe('PremiumPageHero');
  });

  it('forwards the realism image from the map to PremiumPageHero', () => {
    const el = PageHero({ pageKey: 'tasks', title: 'Tasks' });
    expect(el.props.bgImage).toBe(PAGE_HERO_IMAGES.tasks);
  });

  it('explicit image prop wins over pageKey lookup', () => {
    const el = PageHero({
      pageKey: 'tasks',
      title:   'X',
      image:   'https://cdn.example/custom.jpg',
    });
    expect(el.props.bgImage).toBe('https://cdn.example/custom.jpg');
  });

  it('first chip becomes the right-side hero chip', () => {
    const el = PageHero({
      pageKey: 'tasks',
      title:   'Tasks',
      chips: [{ label: '2 of 2 done today', tone: 'green' }],
    });
    expect(el.props.chip).toBeTruthy();
    expect(el.props.chip.label).toBe('2 of 2 done today');
    expect(el.props.chip.tone).toBe('green');
  });

  it('garden variant flips mode', () => {
    const el = PageHero({ pageKey: 'journal', title: 'Journal', variant: 'garden' });
    expect(el.props.mode).toBe('garden');
  });

  it('no chips → primary is null, no extra-chips slot', () => {
    const el = PageHero({ pageKey: 'tasks', title: 'Tasks' });
    expect(el.props.chip).toBeNull();
    expect(el.props.accent).toBe('green');
  });

  it('drops malformed chip entries', () => {
    const el = PageHero({
      pageKey: 'tasks', title: 'Tasks',
      chips: [null, 'string', { label: '' }, { label: 'Valid', tone: 'amber' }],
    });
    expect(el.props.chip.label).toBe('Valid');
    expect(el.props.chip.tone).toBe('amber');
  });
});

// ─── 4. Replacement contract — the offending pages now ───────
//      reference the realism map (NOT the flat SVG) ───────────

describe('Page sources no longer reference the flat hero SVGs', () => {
  it('AllTasksPage imports getPageHeroImage + drops /images/page-hero/tasks.svg', () => {
    const src = read('src/pages/AllTasksPage.jsx');
    expect(src).toMatch(/getPageHeroImage/);
    expect(src).not.toMatch(/\/images\/page-hero\/tasks\.svg/);
  });

  it('Sell imports getPageHeroImage + drops /images/page-hero/sell.svg', () => {
    const src = read('src/pages/Sell.jsx');
    expect(src).toMatch(/getPageHeroImage/);
    expect(src).not.toMatch(/\/images\/page-hero\/sell\.svg/);
  });

  it('SoilScanPage imports getPageHeroImage + drops /images/page-hero/scan.svg', () => {
    const src = read('src/pages/SoilScanPage.jsx');
    expect(src).toMatch(/getPageHeroImage/);
    expect(src).not.toMatch(/\/images\/page-hero\/scan\.svg/);
  });
});
