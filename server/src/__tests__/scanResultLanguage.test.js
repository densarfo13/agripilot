/**
 * scanResultLanguage.test.js — pins the Scan Intelligence + Trust
 * Polish contract.
 *
 *   1. getScanCategory infers crop / garden / grass / unclear / non_plant.
 *   2. getCalmStatus emits the spec's §1/§2 calm phrases per category.
 *   3. getUrgencyTone maps severity to GREEN/YELLOW/ORANGE/RED with
 *      calm labels (never panic language).
 *   4. getUncertaintyReason reads imageQuality stats when present;
 *      returns null when scan was clear.
 *   5. Non-plant detection returns calm "try a leaf" guidance —
 *      never fakes a diagnosis.
 *   6. composeScanResultStrings ALWAYS returns the canonical
 *      result-card shape.
 *   7. Defensive sanitiser pass swaps forbidden wording for calm
 *      category-aware status.
 */

import { describe, it, expect } from 'vitest';
import {
  SCAN_CATEGORIES,
  URGENCY_TONES,
  getScanCategory,
  getCalmStatus,
  getUrgencyTone,
  getUncertaintyReason,
  getRetakeHint,
  composeScanResultStrings,
} from '../../../src/lib/scanResultLanguage.js';

// ─── Category detection ────────────────────────────────────────

describe('getScanCategory', () => {
  it('detects crop from farm-crop name', () => {
    expect(getScanCategory({ decision: { cropDetected: 'maize' } })).toBe(SCAN_CATEGORIES.CROP);
    expect(getScanCategory({ decision: { cropDetected: 'cassava' } })).toBe(SCAN_CATEGORIES.CROP);
    expect(getScanCategory({ cropName: 'rice' })).toBe(SCAN_CATEGORIES.CROP);
  });

  it('detects garden from garden-plant name', () => {
    expect(getScanCategory({ decision: { cropDetected: 'tomato' } })).toBe(SCAN_CATEGORIES.GARDEN);
    expect(getScanCategory({ cropName: 'basil' })).toBe(SCAN_CATEGORIES.GARDEN);
  });

  it('detects grass from name hints', () => {
    expect(getScanCategory({ cropName: 'grass' })).toBe(SCAN_CATEGORIES.GRASS);
    expect(getScanCategory({ cropName: 'lawn turf' })).toBe(SCAN_CATEGORIES.GRASS);
  });

  it('detects non_plant from category field', () => {
    expect(getScanCategory({ category: 'non_plant' })).toBe(SCAN_CATEGORIES.NON_PLANT);
    expect(getScanCategory({ category: 'no_plant_detected' })).toBe(SCAN_CATEGORIES.NON_PLANT);
  });

  it('falls back to experience hint when crop unknown', () => {
    expect(getScanCategory({ experience: 'farm' })).toBe(SCAN_CATEGORIES.CROP);
    expect(getScanCategory({ experience: 'backyard' })).toBe(SCAN_CATEGORIES.GARDEN);
    expect(getScanCategory({ experience: 'farmer' })).toBe(SCAN_CATEGORIES.CROP);
  });

  it('returns unclear when nothing matches', () => {
    expect(getScanCategory({})).toBe(SCAN_CATEGORIES.UNCLEAR);
    expect(getScanCategory(null)).toBe(SCAN_CATEGORIES.UNCLEAR);
    expect(getScanCategory({ confidence: 'low' })).toBe(SCAN_CATEGORIES.UNCLEAR);
  });
});

// ─── Calm status per category ──────────────────────────────────

describe('getCalmStatus', () => {
  it('matches spec §1/§2 examples per category', () => {
    expect(getCalmStatus({}, SCAN_CATEGORIES.CROP)).toMatch(/Leaf condition/);
    expect(getCalmStatus({}, SCAN_CATEGORIES.GARDEN)).toMatch(/plant may need attention/);
    expect(getCalmStatus({}, SCAN_CATEGORIES.GRASS)).toMatch(/closer look/);
    expect(getCalmStatus({}, SCAN_CATEGORIES.NON_PLANT)).toMatch(/leaf, fruit, or plant/);
    expect(getCalmStatus({}, SCAN_CATEGORIES.UNCLEAR)).toMatch(/More detail needed/);
  });

  it('infers category when not passed explicitly', () => {
    expect(getCalmStatus({ cropName: 'maize' })).toMatch(/Leaf condition/);
  });

  it('never contains robotic / scary wording', () => {
    for (const c of Object.values(SCAN_CATEGORIES)) {
      const s = getCalmStatus({}, c);
      expect(s.toLowerCase()).not.toMatch(/critical|fatal|danger|catastrophic|severe error/);
      expect(s.toLowerCase()).not.toMatch(/affected crop|robotic|model output/);
    }
  });
});

// ─── Urgency tones ─────────────────────────────────────────────

describe('getUrgencyTone', () => {
  it('non_plant → GREEN', () => {
    const r = getUrgencyTone({}, SCAN_CATEGORIES.NON_PLANT);
    expect(r.tone).toBe('GREEN');
  });

  it('high severity → RED', () => {
    const r = getUrgencyTone({ decision: { severityTone: 'high' }, cropName: 'maize' });
    expect(r.tone).toBe('RED');
    expect(r.label).toMatch(/Urgent review recommended/);
  });

  it('medium severity → ORANGE', () => {
    const r = getUrgencyTone({ decision: { severityTone: 'medium' }, cropName: 'tomato' });
    expect(r.tone).toBe('ORANGE');
    expect(r.label).toMatch(/Attention needed/);
  });

  it('low severity → YELLOW', () => {
    const r = getUrgencyTone({ decision: { severityTone: 'low' }, cropName: 'maize' });
    expect(r.tone).toBe('YELLOW');
  });

  it('healthy → GREEN', () => {
    const r = getUrgencyTone({ decision: { severityTone: 'healthy' }, cropName: 'maize' });
    expect(r.tone).toBe('GREEN');
    expect(r.label).toMatch(/Looks stable/);
  });

  it('low confidence with no severity → YELLOW (calm hold)', () => {
    const r = getUrgencyTone({ confidence: 'low', cropName: 'maize' });
    expect(r.tone).toBe('YELLOW');
  });

  it('label is never scary at any tone', () => {
    for (const sev of ['high', 'medium', 'low', 'healthy']) {
      const r = getUrgencyTone({ decision: { severityTone: sev }, cropName: 'maize' });
      expect(r.label.toLowerCase()).not.toMatch(/danger|critical|fatal|emergency/);
    }
  });
});

// ─── Uncertainty "why" ─────────────────────────────────────────

describe('getUncertaintyReason', () => {
  it('returns null when confidence is not low', () => {
    expect(getUncertaintyReason({ decision: { confidenceTone: 'high' } })).toBeNull();
    expect(getUncertaintyReason({ confidence: 'medium' })).toBeNull();
  });

  it('reports lighting issue when luminance very low', () => {
    const r = getUncertaintyReason({
      confidence: 'low',
      imageQuality: { luminance: 0.1, sharpness: 0.5 },
    });
    expect(r).toMatch(/[Ll]ighting/);
  });

  it('reports washed-out issue when luminance very high', () => {
    const r = getUncertaintyReason({
      confidence: 'low',
      imageQuality: { luminance: 0.98, sharpness: 0.5 },
    });
    expect(r).toMatch(/washed out/);
  });

  it('reports blurry leaf when sharpness low', () => {
    const r = getUncertaintyReason({
      confidence: 'low',
      imageQuality: { luminance: 0.5, sharpness: 0.1 },
    });
    expect(r).toMatch(/Leaf detail/);
  });

  it('falls back to generic phrase when no quality stats present', () => {
    expect(getUncertaintyReason({ confidence: 'low' })).toMatch(/Leaf detail/);
  });
});

// ─── Retake hint ───────────────────────────────────────────────

describe('getRetakeHint', () => {
  it('non_plant → calm "try a leaf" hint', () => {
    const r = getRetakeHint({ category: 'non_plant' });
    expect(r).toMatch(/Try focusing/);
  });

  it('returns null when no quality issue + plant detected', () => {
    expect(getRetakeHint({ cropName: 'maize' })).toBeNull();
  });

  it('suggests brighter light when too dark', () => {
    const r = getRetakeHint({
      cropName: 'maize',
      imageQuality: { luminance: 0.1, sharpness: 0.5 },
    });
    expect(r).toMatch(/brighter light/);
  });

  it('suggests closer photo when blurry', () => {
    const r = getRetakeHint({
      cropName: 'maize',
      imageQuality: { luminance: 0.5, sharpness: 0.1 },
    });
    expect(r).toMatch(/closer photo/);
  });
});

// ─── Composite helper ──────────────────────────────────────────

describe('composeScanResultStrings — single-call helper', () => {
  it('returns the canonical 8-field shape', () => {
    const r = composeScanResultStrings({});
    expect(Object.keys(r).sort()).toEqual([
      'action', 'category', 'nextCheck', 'noticed',
      'retakeHint', 'status', 'urgency', 'whyUnclear',
    ]);
  });

  it('non_plant scan produces calm guidance not fake diagnosis', () => {
    const r = composeScanResultStrings({ category: 'non_plant' });
    expect(r.category).toBe('non_plant');
    expect(r.status.toLowerCase()).toMatch(/leaf, fruit/);
    expect(r.urgency.tone).toBe('GREEN');
  });

  it('crop + high severity → RED tone + composed wording', () => {
    const r = composeScanResultStrings({
      cropName: 'maize',
      decision: { severityTone: 'high', whatItMeans: 'Yellow patches on lower leaves' },
    });
    expect(r.category).toBe('crop');
    expect(r.urgency.tone).toBe('RED');
    expect(r.noticed).toMatch(/Yellow patches/);
  });

  it('low confidence + low-light quality stats produce whyUnclear + retakeHint', () => {
    const r = composeScanResultStrings({
      cropName: 'tomato',
      confidence: 'low',
      imageQuality: { luminance: 0.1, sharpness: 0.6 },
    });
    expect(r.whyUnclear).toMatch(/[Ll]ighting/);
    expect(r.retakeHint).toMatch(/brighter/);
  });

  it('sanitises forbidden wording on noticed/action', () => {
    const r = composeScanResultStrings({
      cropName: 'maize',
      decision: {
        whatItMeans: 'Model output: 72% critical error',
        actionToday: 'NDVI 0.42 indicates dangerous condition',
      },
    });
    expect(r.noticed.toLowerCase()).not.toMatch(/model output|72%|critical error/);
    expect(r.action.toLowerCase()).not.toMatch(/ndvi|0\.42|dangerous/);
  });

  it('returns a frozen result (can\'t be mutated)', () => {
    const r = composeScanResultStrings({});
    expect(Object.isFrozen(r)).toBe(true);
  });
});

describe('exports — frozen registries', () => {
  it('SCAN_CATEGORIES is frozen', () => {
    expect(Object.isFrozen(SCAN_CATEGORIES)).toBe(true);
  });
  it('URGENCY_TONES is frozen', () => {
    expect(Object.isFrozen(URGENCY_TONES)).toBe(true);
  });
});
