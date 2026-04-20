/**
 * completionBridgeIntegration.test.js — proves the completion
 * bridge + shared renderer work end-to-end and that every key
 * the bridge can emit is translated in every supported locale.
 */

import { describe, it, expect } from 'vitest';

import { buildCompletionBridge } from '../../../src/core/experience/completionBridge.js';
import { renderLocalizedMessage } from '../../../src/core/i18n/renderLocalizedMessage.js';
import { COMPLETION_TRANSLATIONS } from '../../../src/i18n/completionTranslations.js';
import { mergeManyOverlays } from '../../../src/i18n/mergeOverlays.js';

// Build a minimal t() function backed by a merged dictionary.
function buildTranslator(lang) {
  const T = {};
  mergeManyOverlays(T, [COMPLETION_TRANSLATIONS]);
  return (key, params) => {
    const entry = T[key];
    if (!entry) return key;
    const value = entry[lang] || entry.en || key;
    if (!params) return value;
    return String(value).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
      params[k] == null ? '' : String(params[k]));
  };
}

describe('completion bridge + renderer + translations end to end', () => {
  it('renders English title/encouragement/next for default bridge', () => {
    const t = buildTranslator('en');
    const b = buildCompletionBridge({});
    expect(renderLocalizedMessage(b.title, t)).toBe('All done for now');
    expect(renderLocalizedMessage(b.encouragement, t)).toBe('Great work!');
    expect(renderLocalizedMessage(b.next, t)).toBe('Next: check tomorrow\u2019s task');
  });

  it('renders Hindi (Devanagari) for the same bridge', () => {
    const t = buildTranslator('hi');
    const b = buildCompletionBridge({});
    expect(renderLocalizedMessage(b.title, t)).toMatch(/[\u0900-\u097F]/);
    expect(renderLocalizedMessage(b.encouragement, t)).toMatch(/[\u0900-\u097F]/);
    expect(renderLocalizedMessage(b.next, t)).toMatch(/[\u0900-\u097F]/);
  });

  it('renders French with appropriate punctuation', () => {
    const t = buildTranslator('fr');
    const b = buildCompletionBridge({});
    expect(renderLocalizedMessage(b.title, t)).toMatch(/Tout|l\u2019instant/);
    expect(renderLocalizedMessage(b.next, t)).toMatch(/Ensuite/);
  });

  it('seasonal-transition bridge renders prepare_next_cycle line', () => {
    const t = buildTranslator('en');
    const b = buildCompletionBridge({ seasonalTransition: true });
    expect(renderLocalizedMessage(b.next, t)).toBe('Next: prepare for the next cycle');
  });

  it('stage=flowering emits ensure_pollination line', () => {
    const t = buildTranslator('en');
    const b = buildCompletionBridge({ cropStage: 'flowering' });
    expect(renderLocalizedMessage(b.next, t)).toBe('Next: help pollination along');
  });

  it('missedDays=5 routes encouragement to back_on_track', () => {
    const t = buildTranslator('en');
    const b = buildCompletionBridge({ missedDays: 5 });
    const line = renderLocalizedMessage(b.encouragement, t);
    expect(line).toBe('Welcome back — let\u2019s get rolling');
  });

  it('harvest_complete reason swaps encouragement', () => {
    const t = buildTranslator('en');
    const b = buildCompletionBridge({ allDoneReason: 'harvest_complete' });
    expect(renderLocalizedMessage(b.encouragement, t))
      .toBe('Harvest complete — a big milestone');
  });

  it('unknown locale falls back to English via renderer', () => {
    const t = buildTranslator('xx');  // unknown — falls back to entry.en
    const b = buildCompletionBridge({});
    expect(renderLocalizedMessage(b.title, t)).toBe('All done for now');
  });
});

describe('COMPLETION_TRANSLATIONS coverage', () => {
  const allNextKeys = [
    'completion.next.check_tomorrow',
    'completion.next.prepare_next_cycle',
    'completion.next.post_harvest_steps',
    'completion.next.monitor_germination',
    'completion.next.watch_pests',
    'completion.next.ensure_pollination',
    'completion.next.plan_harvest',
    'completion.next.thin_seedlings',
    'completion.next.start_planting_soon',
    'completion.next.complete_plan',
  ];

  it('English has every next-key the bridge can emit', () => {
    for (const k of allNextKeys) {
      expect(COMPLETION_TRANSLATIONS.en[k]).toBeTruthy();
    }
  });

  it('Hindi has every next-key (Devanagari)', () => {
    for (const k of allNextKeys) {
      const v = COMPLETION_TRANSLATIONS.hi[k];
      expect(v).toBeTruthy();
      expect(v).toMatch(/[\u0900-\u097F]/);
    }
  });

  it('French has every next-key', () => {
    for (const k of allNextKeys) {
      expect(COMPLETION_TRANSLATIONS.fr[k]).toBeTruthy();
    }
  });

  it('title + encouragement variants all have en/hi/fr', () => {
    const keys = [
      'completion.title.all_done_for_now',
      'completion.encouragement.great_work',
      'completion.encouragement.back_on_track',
      'completion.encouragement.harvest_done',
    ];
    for (const k of keys) {
      expect(COMPLETION_TRANSLATIONS.en[k]).toBeTruthy();
      expect(COMPLETION_TRANSLATIONS.hi[k]).toBeTruthy();
      expect(COMPLETION_TRANSLATIONS.fr[k]).toBeTruthy();
    }
  });
});
