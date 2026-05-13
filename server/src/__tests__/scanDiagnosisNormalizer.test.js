/**
 * scanDiagnosisNormalizer.test.js — pins the progressive-certainty
 * disease/pest spec contract.
 *
 *   1. < 50% → disease name HIDDEN; "Plant type unclear" wording
 *   2. 50–75% → "Possible …" prefix
 *   3. 75–90% → "Likely …" prefix
 *   4. 90%+ → "High likelihood of …" prefix
 *   5. Banned words ('confirmed' / 'definitely' / 'guaranteed' /
 *      'certain') NEVER appear in any output
 *   6. Condition category (Fungal / Pest / etc.) is inferred from
 *      keywords and ALWAYS surfaces
 *   7. Safety note never names a specific pesticide
 *   8. taskSuggestion includes scan reference + safe action
 *   9. weatherContext is null when source has no weather data —
 *      NEVER fabricated
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_BANDS,
  CONDITION_CATEGORIES,
  normalizeDiagnosis,
  getSafeTreatmentPhrases,
} from '../../../src/lib/scanDiagnosisNormalizer.js';

// ─── Confidence bands ──────────────────────────────────────────

describe('confidence bands per percent', () => {
  it('< 50% → very_low, disease name HIDDEN', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'early blight', confidenceTone: 'low' },
    });
    expect(r.confidenceLevel).toBe(CONFIDENCE_BANDS.VERY_LOW);
    expect(r.possibleDiseaseOrPest).toBeNull();
    expect(r.certaintyLanguage.toLowerCase()).toMatch(/unclear/);
  });

  it('50-75% → possible band with "Possible …" prefix', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'early blight' },
    }, { confidencePercentOverride: 65 });
    expect(r.confidenceLevel).toBe(CONFIDENCE_BANDS.POSSIBLE);
    expect(r.possibleDiseaseOrPest).toMatch(/^Possible /);
    expect(r.possibleDiseaseOrPest.toLowerCase()).toContain('early blight');
  });

  it('75-90% → likely band with "Likely …" prefix', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'aphid damage' },
    }, { confidencePercentOverride: 80 });
    expect(r.confidenceLevel).toBe(CONFIDENCE_BANDS.LIKELY);
    expect(r.possibleDiseaseOrPest).toMatch(/^Likely /);
  });

  it('90%+ → high band with "High likelihood of …" prefix', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'mildew activity' },
    }, { confidencePercentOverride: 95 });
    expect(r.confidenceLevel).toBe(CONFIDENCE_BANDS.HIGH);
    expect(r.possibleDiseaseOrPest).toMatch(/^High likelihood of /);
  });

  it('boundary values land in the correct band', () => {
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 49 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.VERY_LOW);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 50 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.POSSIBLE);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 74 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.POSSIBLE);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 75 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.LIKELY);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 89 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.LIKELY);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 90 }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.HIGH);
  });

  it('falls back to qualitative confidence when no percent supplied', () => {
    expect(normalizeDiagnosis({ confidence: 'high' }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.LIKELY);    // 'high' maps to 85% → likely
    expect(normalizeDiagnosis({ confidence: 'medium' }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.POSSIBLE);   // 65% → possible
    expect(normalizeDiagnosis({ confidence: 'low' }).confidenceLevel)
      .toBe(CONFIDENCE_BANDS.VERY_LOW);
  });

  it('clamps confidencePercent to [0, 100]', () => {
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 200 }).confidencePercent).toBe(100);
    expect(normalizeDiagnosis({}, { confidencePercentOverride: -10 }).confidencePercent).toBe(0);
  });
});

// ─── Banned wording defensive guard ───────────────────────────

describe('never uses banned wording', () => {
  it('"confirmed" leaking from engine is sanitised', () => {
    const r = normalizeDiagnosis({
      decision: {
        issueDetected: 'blight',
        whatItMeans:   'This is the confirmed early blight outbreak.',
      },
    }, { confidencePercentOverride: 80 });
    expect(r.whyFarrowayThinksThis.toLowerCase()).not.toMatch(/\bconfirmed\b/);
  });

  it('"definitely" leaking from engine is sanitised', () => {
    const r = normalizeDiagnosis({
      decision: {
        whatItMeans: 'It is definitely fungal damage.',
        actionToday: 'You should definitely spray immediately.',
      },
    }, { confidencePercentOverride: 80 });
    expect(r.whyFarrowayThinksThis.toLowerCase()).not.toMatch(/\bdefinitely\b/);
    expect(r.actionToday.toLowerCase()).not.toMatch(/\bdefinitely\b/);
  });

  it('"guaranteed" / "certain" never surface', () => {
    const r = normalizeDiagnosis({
      decision: {
        whatItMeans: 'Guaranteed harvest loss is certain.',
      },
    }, { confidencePercentOverride: 95 });
    expect(r.whyFarrowayThinksThis.toLowerCase()).not.toMatch(/\bguaranteed\b/);
    expect(r.whyFarrowayThinksThis.toLowerCase()).not.toMatch(/\bcertain(?:ly)?\b/);
  });

  it('every confidence band output contains zero banned words', () => {
    for (const pct of [10, 30, 60, 80, 95]) {
      const r = normalizeDiagnosis({
        decision: { issueDetected: 'blight', whatItMeans: 'visible signs' },
      }, { confidencePercentOverride: pct });
      const allText = JSON.stringify(r).toLowerCase();
      expect(allText).not.toMatch(/\bconfirmed\b/);
      expect(allText).not.toMatch(/\bdefinitely\b/);
      expect(allText).not.toMatch(/\bguaranteed\b/);
    }
  });
});

// ─── Condition category inference ─────────────────────────────

describe('condition category — always inferred, always surfaced', () => {
  it('infers FUNGAL from blight/mildew/rust', () => {
    expect(normalizeDiagnosis({
      decision: { issueDetected: 'early blight' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.FUNGAL);

    expect(normalizeDiagnosis({
      decision: { issueDetected: 'powdery mildew' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.FUNGAL);

    expect(normalizeDiagnosis({
      decision: { issueDetected: 'leaf rust' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.FUNGAL);
  });

  it('infers PEST from aphid/caterpillar/mite/whitefly', () => {
    expect(normalizeDiagnosis({
      decision: { issueDetected: 'aphid damage' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.PEST);

    expect(normalizeDiagnosis({
      decision: { issueDetected: 'whitefly infestation' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.PEST);
  });

  it('infers NUTRIENT / WATER / HEAT correctly', () => {
    expect(normalizeDiagnosis({
      decision: { issueDetected: 'nitrogen deficiency' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.NUTRIENT);

    expect(normalizeDiagnosis({
      decision: { issueDetected: 'water stress wilting' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.WATER);

    expect(normalizeDiagnosis({
      decision: { issueDetected: 'sunscald heat stress' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.HEAT);
  });

  it('defaults to LEAF (safest generic) when no keyword matches', () => {
    expect(normalizeDiagnosis({
      decision: { issueDetected: 'unfamiliar marking' },
    }, { confidencePercentOverride: 80 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.LEAF);
  });

  it('detects HEALTHY from no_issue', () => {
    expect(normalizeDiagnosis({
      decision: { issueDetected: 'no_issue' },
    }, { confidencePercentOverride: 90 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.HEALTHY);
  });

  it('UNKNOWN when nothing supplied', () => {
    expect(normalizeDiagnosis({}, { confidencePercentOverride: 0 }).conditionCategory)
      .toBe(CONDITION_CATEGORIES.UNKNOWN);
  });
});

// ─── Safety note enforcement ──────────────────────────────────

describe('safety note — curated phrases only, never specific pesticides', () => {
  it('FUNGAL safety mentions agronomist, never specific chemical', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'early blight' },
    }, { confidencePercentOverride: 80 });
    expect(r.safetyNote.toLowerCase()).toContain('agronomist');
    expect(r.safetyNote.toLowerCase()).not.toMatch(/captan|chlorothalonil|mancozeb|imidacloprid/);
  });

  it('PEST safety mentions inspection + agronomist, no chemicals', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'aphid damage' },
    }, { confidencePercentOverride: 80 });
    expect(r.safetyNote.toLowerCase()).toContain('inspect');
    expect(r.safetyNote.toLowerCase()).not.toMatch(/permethrin|deltamethrin/);
  });

  it('HEALTHY → no safety note (nothing to warn about)', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'no_issue' },
    }, { confidencePercentOverride: 95 });
    expect(r.safetyNote).toBeNull();
  });

  it('getSafeTreatmentPhrases returns the curated 4 phrases', () => {
    const list = getSafeTreatmentPhrases();
    expect(list).toContain('Inspect affected leaves');
    expect(list).toContain('Avoid overhead watering');
    expect(list).toContain('Remove heavily damaged leaves');
    expect(list).toContain('Consult a local agronomist before applying chemicals');
  });
});

// ─── Task suggestion + weather context ────────────────────────

describe('task suggestion + weather context', () => {
  it('low-confidence task suggests a rescan', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'unclear' },
      cropName: 'maize',
    }, { confidencePercentOverride: 30 });
    expect(r.taskSuggestion.title.toLowerCase()).toMatch(/rescan/);
    expect(r.taskSuggestion.actionType).toBe('scan');
  });

  it('actionable confidence produces inspect task referencing category', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'aphid damage' },
      cropName: 'tomato',
    }, { confidencePercentOverride: 80 });
    expect(r.taskSuggestion.title.toLowerCase()).toMatch(/inspect/);
    expect(r.taskSuggestion.actionType).toBe('inspect');
  });

  it('weatherContext is null when engine has no weather caution (never fabricated)', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'blight' },
    }, { confidencePercentOverride: 80 });
    expect(r.weatherContext).toBeNull();
  });

  it('weatherContext flows through when engine provided it', () => {
    const r = normalizeDiagnosis({
      decision: {
        issueDetected: 'blight',
        weatherCaution: 'Recent humidity may increase fungal pressure.',
      },
    }, { confidencePercentOverride: 80 });
    expect(r.weatherContext).toMatch(/humidity/);
  });
});

// ─── Canonical shape ──────────────────────────────────────────

describe('canonical 14-field shape', () => {
  it('returns all 14 spec fields', () => {
    const r = normalizeDiagnosis({
      decision: { issueDetected: 'blight' },
      cropName: 'tomato',
    }, { confidencePercentOverride: 80 });
    expect(Object.keys(r).sort()).toEqual([
      'actionToday',
      'certaintyLanguage',
      'conditionCategory',
      'confidenceLevel',
      'confidencePercent',
      'cropDetected',
      'nextCheck',
      'possibleDiseaseOrPest',
      'preventionTip',
      'safetyNote',
      'severity',
      'taskSuggestion',
      'weatherContext',
      'whyFarrowayThinksThis',
    ]);
  });

  it('result is frozen — UI cannot mutate canonical strings', () => {
    const r = normalizeDiagnosis({}, { confidencePercentOverride: 80 });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.taskSuggestion)).toBe(true);
  });

  it('actionToday is ALWAYS non-empty (spec rule)', () => {
    for (const pct of [10, 30, 60, 80, 95]) {
      const r = normalizeDiagnosis({}, { confidencePercentOverride: pct });
      expect(r.actionToday).toBeTruthy();
      expect(r.actionToday.length).toBeGreaterThan(5);
    }
  });

  it('never throws on null / garbage input', () => {
    expect(() => normalizeDiagnosis(null)).not.toThrow();
    expect(() => normalizeDiagnosis('not an object')).not.toThrow();
    expect(() => normalizeDiagnosis({})).not.toThrow();
  });
});
