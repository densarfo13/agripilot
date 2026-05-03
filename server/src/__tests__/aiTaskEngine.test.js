import { describe, it, expect } from 'vitest';

/**
 * AI Task Engine v1 — engine + schema unit tests.
 * Covers:
 *   • precedence ladder (profile_missing → weather → stage → fallback)
 *   • output envelope shape (8 spec fields + diagnostics)
 *   • localisation fallback to English when locale is absent
 *   • backyard vs farmer wording separation
 *   • Zod request validation (allow-list + size caps)
 */

import { generateTodayTask, _internal } from '../modules/aiTask/engine.js';
import { TASK_TEMPLATES } from '../modules/aiTask/taskTemplates.js';
import { todayTaskRequestSchema, USER_TYPES, SUPPORTED_LANGUAGES } from '../modules/aiTask/schemas.js';
import { KNOWN_EVENT_NAMES } from '../modules/events/schemas.js';

// ─── Engine — precedence ladder ──────────────────────────
describe('generateTodayTask — precedence ladder', () => {
  it('returns profile_missing when crop is absent', () => {
    const out = generateTodayTask({ userType: 'farmer', stage: 'vegetative' });
    expect(out.ruleId).toBe('profile_missing');
    expect(out.fallback).toBe(true);
    expect(out.urgency).toBe('high');
  });

  it('returns profile_missing when stage is absent', () => {
    const out = generateTodayTask({ userType: 'farmer', crop: 'maize' });
    expect(out.ruleId).toBe('profile_missing');
  });

  it('returns heavy_rain_warning when rainfallForecast >= threshold', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative',
      rainfallForecast: 30,
    });
    expect(out.ruleId).toBe('heavy_rain_warning');
    expect(out.urgency).toBe('high');
  });

  it('returns heavy_rain_warning when summary=rainy and no forecast number', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative',
      weather: 'rainy',
    });
    expect(out.ruleId).toBe('heavy_rain_warning');
  });

  it('returns heat_stress_warning when temperature >= 35', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative',
      temperature: 36,
    });
    expect(out.ruleId).toBe('heat_stress_warning');
  });

  it('returns cold_stress_warning when temperature <= 8', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      temperature: 5,
    });
    expect(out.ruleId).toBe('cold_stress_warning');
  });

  it('returns dry_irrigation when summary=dry and stage=vegetative', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative',
      weather: 'dry',
    });
    expect(out.ruleId).toBe('dry_irrigation');
  });

  it('returns stage default when no weather signal applies', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      temperature: 24, weather: 'cool',
    });
    expect(out.ruleId).toBe('stage_flowering');
  });

  it('falls back to fallback_check when stage has no template', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'mystery_stage',
    });
    expect(out.ruleId).toBe('fallback_check');
    expect(out.fallback).toBe(true);
  });
});

// ─── Engine — output envelope shape ──────────────────────
describe('generateTodayTask — output envelope', () => {
  it('returns the spec\'s 8 fields plus diagnostics', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
    });
    expect(out).toHaveProperty('todayTaskTitle');
    expect(out).toHaveProperty('taskReason');
    expect(out).toHaveProperty('urgency');
    expect(out).toHaveProperty('estimatedTime');
    expect(out).toHaveProperty('safetyNote');
    expect(out).toHaveProperty('localizedText');
    expect(out).toHaveProperty('nextRecommendedTask');
    expect(out).toHaveProperty('completionPrompt');
    // Diagnostics
    expect(out).toHaveProperty('ruleId');
    expect(out).toHaveProperty('userType');
    expect(out).toHaveProperty('fallback');
    expect(out).toHaveProperty('reasonCode');
    expect(out).toHaveProperty('language');
    expect(out).toHaveProperty('generatedAt');
  });

  it('localizedText carries title / reason / completionPrompt', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
    });
    expect(typeof out.localizedText.title).toBe('string');
    expect(typeof out.localizedText.reason).toBe('string');
    expect(typeof out.localizedText.completionPrompt).toBe('string');
  });

  it('every output is a non-empty string for the spec fields', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'vegetative',
    });
    expect(out.todayTaskTitle.length).toBeGreaterThan(0);
    expect(out.taskReason.length).toBeGreaterThan(0);
    expect(out.completionPrompt.length).toBeGreaterThan(0);
    expect(out.nextRecommendedTask.length).toBeGreaterThan(0);
  });

  it('urgency is one of low / medium / high', () => {
    for (const stage of ['planning', 'planting', 'germination', 'vegetative', 'flowering', 'maturity', 'harvest', 'post_harvest']) {
      const out = generateTodayTask({ userType: 'farmer', crop: 'maize', stage });
      expect(['low', 'medium', 'high']).toContain(out.urgency);
    }
  });
});

// ─── Engine — localisation ───────────────────────────────
describe('generateTodayTask — localisation', () => {
  it('returns French wording when language=fr', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      language: 'fr',
    });
    // French stage_flowering title contains "engrais"
    expect(out.todayTaskTitle.toLowerCase()).toMatch(/engrais|floraison/);
    expect(out.language).toBe('fr');
  });

  it('returns Swahili wording when language=sw', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      language: 'sw',
    });
    expect(out.language).toBe('sw');
    expect(out.todayTaskTitle.length).toBeGreaterThan(0);
  });

  it('falls back to English when language is unsupported', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      language: 'xx',
    });
    expect(out.language).toBe('en');
  });

  it('completionPrompt is in the requested language', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'flowering',
      language: 'fr',
    });
    expect(out.completionPrompt.toLowerCase()).toMatch(/bon travail/);
  });
});

// ─── Engine — backyard vs farmer wording ─────────────────
describe('generateTodayTask — userType separation', () => {
  it('backyard never mentions yield / income / sell', () => {
    for (const stage of Object.keys(TASK_TEMPLATES)) {
      const tmpl = TASK_TEMPLATES[stage].backyard;
      if (!tmpl) continue;
      for (const field of ['title', 'reason', 'nextRecommended']) {
        const en = (tmpl[field] && tmpl[field].en) || '';
        expect(en.toLowerCase()).not.toMatch(/\byield\b|\bincome\b|\bsell\b|\brevenue\b|\bharvest team\b/);
      }
    }
  });

  it('farmer wording carries production-grade language', () => {
    const out = generateTodayTask({
      userType: 'farmer', crop: 'maize', stage: 'maturity',
    });
    // The maturity rule explicitly mentions "sale price"
    expect(out.taskReason.toLowerCase()).toMatch(/sale|yield|harvest|grade|price/);
  });

  it('backyard variant exists for every templated rule', () => {
    for (const ruleId of Object.keys(TASK_TEMPLATES)) {
      expect(TASK_TEMPLATES[ruleId]).toHaveProperty('backyard');
      expect(TASK_TEMPLATES[ruleId].backyard).toBeDefined();
    }
  });
});

// ─── Engine — internal helpers ───────────────────────────
describe('engine internals', () => {
  it('exports threshold constants', () => {
    expect(_internal.HEAVY_RAIN_THRESHOLD_MM).toBe(25);
    expect(_internal.HEAT_STRESS_THRESHOLD_C).toBe(35);
    expect(_internal.COLD_STRESS_THRESHOLD_C).toBe(8);
  });

  it('_normalize handles bad input without throwing', () => {
    expect(() => _internal._normalize(null)).not.toThrow();
    expect(() => _internal._normalize(undefined)).not.toThrow();
    expect(() => _internal._normalize('garbage')).not.toThrow();
    expect(() => _internal._normalize({})).not.toThrow();
  });

  it('_normalize defaults userType to farmer when invalid', () => {
    const r = _internal._normalize({ userType: 'mystery' });
    expect(r.userType).toBe('farmer');
  });
});

// ─── Schemas ──────────────────────────────────────────────
describe('todayTaskRequestSchema', () => {
  it('accepts a minimal farmer request', () => {
    const r = todayTaskRequestSchema.safeParse({ userType: 'farmer' });
    expect(r.success).toBe(true);
    expect(r.data.language).toBe('en'); // default applied
  });

  it('accepts a full request with all fields', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'backyard',
      crop: 'tomato',
      stage: 'flowering',
      country: 'GH',
      region: 'Greater Accra',
      coordinates: { lat: 5.6, lng: -0.2 },
      weather: 'humid',
      rainfallForecast: 12.5,
      temperature: 28.3,
      lastCompletedTask: 'water-2026-05-01',
      plantingDate: '2026-04-01',
      language: 'fr',
    });
    expect(r.success).toBe(true);
    expect(r.data.language).toBe('fr');
    expect(r.data.coordinates.lat).toBe(5.6);
  });

  it('rejects an unknown userType', () => {
    const r = todayTaskRequestSchema.safeParse({ userType: 'investor' });
    expect(r.success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer',
      coordinates: { lat: 91, lng: 0 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects rainfall over 200 mm', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer',
      rainfallForecast: 250,
    });
    expect(r.success).toBe(false);
  });

  it('rejects temperature outside the realistic range', () => {
    const a = todayTaskRequestSchema.safeParse({ userType: 'farmer', temperature: 80 });
    const b = todayTaskRequestSchema.safeParse({ userType: 'farmer', temperature: -50 });
    expect(a.success).toBe(false);
    expect(b.success).toBe(false);
  });

  it('rejects an unknown weather summary', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer', weather: 'apocalyptic',
    });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown language', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer', language: 'klingon',
    });
    expect(r.success).toBe(false);
  });

  it('coerces numeric strings on numeric fields', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer',
      rainfallForecast: '12.5',
      temperature: '28',
      coordinates: { lat: '5.6', lng: '-0.2' },
    });
    expect(r.success).toBe(true);
    expect(r.data.rainfallForecast).toBe(12.5);
  });

  it('caps crop name length', () => {
    const r = todayTaskRequestSchema.safeParse({
      userType: 'farmer',
      crop: 'x'.repeat(100),
    });
    expect(r.success).toBe(false);
  });

  it('exports the canonical USER_TYPES list', () => {
    expect(USER_TYPES).toEqual(['farmer', 'backyard']);
  });

  it('exports the 6 launch languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);
  });
});

describe('cross-module — task_generated event allow-list', () => {
  it('task_generated is in KNOWN_EVENT_NAMES', () => {
    expect(KNOWN_EVENT_NAMES).toContain('task_generated');
  });
});
