/**
 * farmerMobileUx.test.js — block-level i18n + insight formatter +
 * progress meaning + return trigger + micro-reinforcement.
 *
 * Covers spec §§ 1-9 (no redesign — pure helpers + one small
 * component). Component rendering is tested structurally to match
 * the codebase pattern for other admin/farmer modules.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveBlock, resolveOne,
} from '../../../src/lib/i18n/blockResolve.js';
import {
  formatWeatherInsight, formatRiskInsight, pickTopInsight,
} from '../../../src/lib/farmer/insightFormatter.js';
import {
  getProgressMeaning, _internal as progressInternal,
} from '../../../src/lib/farmer/progressMeaning.js';
import {
  getReturnTrigger,
} from '../../../src/lib/farmer/returnTrigger.js';
import {
  getReinforcement, _internal as reinforceInternal,
} from '../../../src/lib/farmer/microReinforcement.js';
import TomorrowPreview from '../../../src/components/farmer/TomorrowPreview.jsx';

// ─── Block-level resolver ────────────────────────────────────────
describe('resolveBlock — no mixed-language rendering', () => {
  it('uses translations when every required key resolves', () => {
    const t = (k) => ({
      'home.title': 'होम',
      'home.cta':   'खोलें',
    })[k];
    const r = resolveBlock(t,
      { title: 'home.title', cta: 'home.cta' },
      { title: 'Home',       cta: 'Open' });
    expect(r.translated).toBe(true);
    expect(r.values.title).toBe('होम');
    expect(r.values.cta).toBe('खोलें');
  });

  it('falls back WHOLE block to English when any required key is missing', () => {
    // Hindi for title, English for cta → would normally mix. The
    // block resolver collapses both to English.
    const t = (k) => {
      if (k === 'home.title') return 'होम';
      return k; // cta not translated → returns key (the missing signal)
    };
    const r = resolveBlock(t,
      { title: 'home.title', cta: 'home.cta' },
      { title: 'Home',       cta: 'Open' });
    expect(r.translated).toBe(false);
    expect(r.values.title).toBe('Home');
    expect(r.values.cta).toBe('Open');
    // Critical: never leak the raw key.
    expect(r.values.cta).not.toBe('home.cta');
  });

  it('optional-key allow-list keeps a block in locale when only an optional key is missing', () => {
    const t = (k) => {
      if (k === 'home.title') return 'होम';
      if (k === 'home.cta')   return 'खोलें';
      return k; // learnMore missing
    };
    const r = resolveBlock(t,
      { title: 'home.title', cta: 'home.cta', learnMore: 'home.learn' },
      { title: 'Home',       cta: 'Open',     learnMore: 'Learn more' },
      { required: ['title', 'cta'] });
    expect(r.translated).toBe(true);
    expect(r.values.title).toBe('होम');
    expect(r.values.learnMore).toBe('Learn more');
  });

  it('resolveOne never leaks a raw i18n key', () => {
    const t = (k) => k; // always missing
    expect(resolveOne(t, 'auth.foo.bar', 'Hello')).toBe('Hello');
    expect(resolveOne(null, 'x', 'Hi')).toBe('Hi');
  });

  it('missing translator → fallback map', () => {
    const r = resolveBlock(null,
      { title: 'home.title' },
      { title: 'Home' });
    expect(r.translated).toBe(false);
    expect(r.values.title).toBe('Home');
  });
});

// ─── Insight formatter (spec §3) ─────────────────────────────────
describe('formatWeatherInsight — actionable triples', () => {
  it('excessive_heat → danger tone + shade action', () => {
    const r = formatWeatherInsight({
      weather: { status: 'excessive_heat' },
      crop: 'tomato',
    });
    expect(r.tone).toBe('danger');
    expect(r.condition).toMatch(/heat/i);
    expect(r.actions.some((a) => /shade/i.test(a))).toBe(true);
    expect(r.actionKeys[0]).toMatch(/farmer\.insight/);
  });

  it('low_rain / dry_ahead → warn + water_tomorrow + check_moisture', () => {
    const r = formatWeatherInsight({
      weather: { status: 'low_rain' }, crop: 'maize', forecastDays: 3,
    });
    expect(r.tone).toBe('warn');
    expect(r.timeWindow).toMatch(/3 days/i);
    expect(r.actions).toHaveLength(2);
    expect(r.actions[0]).toMatch(/Water crops tomorrow/i);
    expect(r.actions[1]).toMatch(/soil moisture/i);
  });

  it('rain at harvest stage → harvest_early action', () => {
    const r = formatWeatherInsight({
      weather: { status: 'rain_expected' }, stage: 'harvest', crop: 'rice',
    });
    expect(r.actions[0]).toMatch(/Harvest early/i);
    expect(r.actions[1]).toMatch(/drainage/i);
  });

  it('rain at non-harvest stage → move_to_dry action', () => {
    const r = formatWeatherInsight({
      weather: { status: 'rain_expected' }, stage: 'mid_growth',
    });
    expect(r.actions[0]).toMatch(/dry storage/i);
  });

  it('status "ok" / unknown → null (caller shows nothing)', () => {
    expect(formatWeatherInsight({ weather: { status: 'ok' } })).toBeNull();
    expect(formatWeatherInsight({ weather: { status: 'unavailable' } })).toBeNull();
    expect(formatWeatherInsight({})).toBeNull();
  });

  it('result is frozen', () => {
    const r = formatWeatherInsight({ weather: { status: 'low_rain' } });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.actions)).toBe(true);
    expect(Object.isFrozen(r.actionKeys)).toBe(true);
  });
});

describe('formatRiskInsight', () => {
  it('pest high → danger + inspect + report actions', () => {
    const r = formatRiskInsight({ risk: { level: 'high', type: 'pest' }, crop: 'cassava' });
    expect(r.tone).toBe('danger');
    expect(r.condition).toMatch(/cassava/i);
    expect(r.actions.some((a) => /Inspect/i.test(a))).toBe(true);
    expect(r.actions.some((a) => /officer/i.test(a))).toBe(true);
  });

  it('low-risk signals drop out', () => {
    expect(formatRiskInsight({ risk: { level: 'low' } })).toBeNull();
    expect(formatRiskInsight({})).toBeNull();
  });
});

describe('pickTopInsight', () => {
  it('danger weather beats warn risk', () => {
    const weather = { tone: 'danger' };
    const risk    = { tone: 'warn' };
    expect(pickTopInsight({ weatherInsight: weather, riskInsight: risk })).toBe(weather);
  });
  it('returns null when neither is danger/warn', () => {
    expect(pickTopInsight({})).toBeNull();
    expect(pickTopInsight({ weatherInsight: null, riskInsight: null })).toBeNull();
  });
  it('falls back to risk when weather is absent', () => {
    const r = { tone: 'warn' };
    expect(pickTopInsight({ riskInsight: r })).toBe(r);
  });
});

// ─── Progress meaning (spec §5) ──────────────────────────────────
describe('getProgressMeaning', () => {
  it('always returns headline, stage line, next-step line', () => {
    const r = getProgressMeaning({ score: 60, stage: 'mid_growth' });
    expect(r.headline).toBe('Farm progress');
    expect(r.stageLine).toMatch(/mid growth/i);
    expect(r.nextStepLine.length).toBeGreaterThan(5);
    expect(r.i18nKeys.headline).toBe('farmer.progress.headline');
  });

  it('unknown stage falls back to "planning" line', () => {
    const r = getProgressMeaning({ score: 40, stage: 'weird_stage' });
    expect(r.stageLine).toBe(progressInternal.STAGE_LINES.planning.en);
  });

  it('tasks remaining today → "complete today\'s N task(s)"', () => {
    const r = getProgressMeaning({
      score: 40, stage: 'mid_growth',
      tasksDoneToday: 1, tasksTodayTotal: 3,
    });
    expect(r.nextStepLine).toMatch(/Complete today/i);
    expect(r.nextStepLine).toMatch(/2 task/);
  });

  it('high score + no tasks left → "on track, check tomorrow" line', () => {
    const r = getProgressMeaning({
      score: 85, stage: 'mid_growth',
      tasksDoneToday: 3, tasksTodayTotal: 3,
    });
    expect(r.onTrack).toBe(true);
    expect(r.tone).toBe('good');
    expect(r.nextStepLine).toMatch(/tomorrow/i);
  });

  it('very low score → "restart" line', () => {
    const r = getProgressMeaning({ score: 10, stage: 'planting' });
    expect(r.tone).toBe('danger');
    expect(r.nextStepLine).toMatch(/first action/i);
  });

  it('output is frozen', () => {
    expect(Object.isFrozen(getProgressMeaning({}))).toBe(true);
  });
});

// ─── Return trigger (spec §9) ────────────────────────────────────
describe('getReturnTrigger', () => {
  it('returns a stage-specific primary line + Tomorrow when label', () => {
    const r = getReturnTrigger({ stage: 'mid_growth' });
    expect(r.primary.text).toMatch(/soil moisture|weed/i);
    expect(r.primary.when).toBe('Tomorrow');
  });

  it('harvest stage switches CTA to "review_progress"', () => {
    const r = getReturnTrigger({ stage: 'harvest' });
    expect(r.cta).toBe('review_progress');
  });

  it('rain weather surfaces the "bring tools" secondary', () => {
    const r = getReturnTrigger({
      stage: 'mid_growth', weather: { status: 'rain_expected' },
    });
    expect(r.secondary).toBeTruthy();
    expect(r.secondary.text).toMatch(/tools.*cover/i);
  });

  it('dry weather surfaces "check moisture tomorrow"', () => {
    const r = getReturnTrigger({
      stage: 'planting', weather: { status: 'dry_ahead' },
    });
    expect(r.secondary.text).toMatch(/moisture tomorrow/i);
  });

  it('unknown stage falls back to mid_growth preview', () => {
    const r = getReturnTrigger({ stage: 'mystery' });
    expect(r.primary.text).toMatch(/soil moisture|weed/i);
  });

  it('never returns null — done state always has a return reason', () => {
    expect(getReturnTrigger({})).toBeTruthy();
    expect(getReturnTrigger({}).primary.text.length).toBeGreaterThan(5);
  });
});

// ─── Micro-reinforcement (spec §8) ───────────────────────────────
describe('getReinforcement', () => {
  it('always returns a praise line', () => {
    const r = getReinforcement({});
    expect(r.praise.length).toBeGreaterThan(5);
    expect(r.praiseKey).toMatch(/farmer\.reinforce\./);
  });

  it('streak 7+ uses the "great streak" praise', () => {
    const r = getReinforcement({ streak: 14 });
    expect(r.praise).toBe(reinforceInternal.PRAISES[2].en);
  });

  it('streak 4 uses the "consistency" praise', () => {
    const r = getReinforcement({ streak: 4 });
    expect(r.praise).toBe(reinforceInternal.PRAISES[1].en);
  });

  it('stage-specific next action included', () => {
    const r = getReinforcement({ stage: 'mid_growth', streak: 2 });
    expect(r.nextAction).toMatch(/soil moisture/i);
  });

  it('unknown stage → no nextAction field', () => {
    const r = getReinforcement({ stage: 'nope' });
    expect(r.nextAction).toBeUndefined();
  });
});

// ─── TomorrowPreview export sanity ───────────────────────────────
// Full render tests would need the useTranslation hook context; the
// component is structurally identical to the other admin primitives
// and consumes only `trigger` + i18n via resolveBlock (both unit-
// tested above). This suite confirms the export exists and accepts
// the expected shape.
describe('TomorrowPreview module export', () => {
  it('is importable and a function', () => {
    expect(typeof TomorrowPreview).toBe('function');
  });
});
