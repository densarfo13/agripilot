/**
 * experienceCore.test.js — contract for the integration-gap
 * helpers under src/core/experience:
 *   buildCompletionBridge  (§6)
 *   persistStructuredOnly  (§3)
 *   buildFeedbackEvent     (§8)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  buildCompletionBridge, hasCompletionBridgeNext,
} from '../../../src/core/experience/completionBridge.js';
import {
  persistStructuredOnly, readStructured, shouldRehydrateOnLocaleChange,
} from '../../../src/core/experience/localeSafeCache.js';
import {
  buildFeedbackEvent, isValidReason,
} from '../../../src/core/experience/feedbackEvent.js';
import { isLocalizedPayload } from '../../../src/core/i18n/localizedPayload.js';

// ─── buildCompletionBridge ───────────────────────────────────
describe('buildCompletionBridge', () => {
  it('always emits title + encouragement + next as LocalizedPayload', () => {
    const b = buildCompletionBridge({});
    expect(isLocalizedPayload(b.title)).toBe(true);
    expect(isLocalizedPayload(b.encouragement)).toBe(true);
    expect(isLocalizedPayload(b.next)).toBe(true);
    expect(b.severity).toBe('positive');
  });

  it('title is always the same "all done" key', () => {
    expect(buildCompletionBridge({}).title.key)
      .toBe('completion.title.all_done_for_now');
  });

  it('uses "back_on_track" encouragement after 3+ missed days', () => {
    const b = buildCompletionBridge({ missedDays: 5 });
    expect(b.encouragement.key).toBe('completion.encouragement.back_on_track');
  });

  it('uses "harvest_done" encouragement when reason is harvest_complete', () => {
    const b = buildCompletionBridge({ allDoneReason: 'harvest_complete' });
    expect(b.encouragement.key).toBe('completion.encouragement.harvest_done');
  });

  it('defaults encouragement to "great_work"', () => {
    const b = buildCompletionBridge({ missedDays: 0 });
    expect(b.encouragement.key).toBe('completion.encouragement.great_work');
  });

  it('seasonal transition → prepare_next_cycle', () => {
    const b = buildCompletionBridge({ seasonalTransition: true });
    expect(b.next.key).toBe('completion.next.prepare_next_cycle');
  });

  it('stage-specific next key when cropStage given', () => {
    const b = buildCompletionBridge({ cropStage: 'flowering' });
    expect(b.next.key).toBe('completion.next.ensure_pollination');
  });

  it('falls back to check_tomorrow when stage is unknown', () => {
    const b = buildCompletionBridge({ cropStage: 'alien_stage' });
    expect(b.next.key).toBe('completion.next.check_tomorrow');
  });

  it('result is frozen (no mutation by consumers)', () => {
    const b = buildCompletionBridge({});
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('hasCompletionBridgeNext reflects presence of next.key', () => {
    expect(hasCompletionBridgeNext(buildCompletionBridge({}))).toBe(true);
    expect(hasCompletionBridgeNext(null)).toBe(false);
    expect(hasCompletionBridgeNext({ next: null })).toBe(false);
    expect(hasCompletionBridgeNext({ next: { key: '' } })).toBe(false);
  });
});

// ─── persistStructuredOnly ───────────────────────────────────
describe('persistStructuredOnly', () => {
  function makeMemBackend() {
    const store = new Map();
    return {
      setItem: (k, v) => store.set(k, String(v)),
      getItem: (k) => store.has(k) ? store.get(k) : null,
      _dump:   () => Object.fromEntries(store),
    };
  }

  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('persists an all-structured payload', () => {
    const b = makeMemBackend();
    const value = {
      insight: { key: 'insight.good_week' },
      title:   { key: 'home.welcome' },
    };
    expect(persistStructuredOnly(b, 'home.snapshot', value)).toBe(true);
    expect(b._dump()['home.snapshot']).toContain('insight.good_week');
  });

  it('refuses to persist rendered English at top level', () => {
    const b = makeMemBackend();
    const value = { insight: 'Good weather this week for planting' };
    expect(persistStructuredOnly(b, 'k', value)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(b._dump()).toEqual({});
  });

  it('allows a bare key as a top-level string (looks like key)', () => {
    const b = makeMemBackend();
    const value = { insight: 'insight.good_week' };
    expect(persistStructuredOnly(b, 'k', value)).toBe(true);
  });

  it('detects rendered strings one level deep', () => {
    const b = makeMemBackend();
    const value = { insight: { subtitle: 'Rain tomorrow, prepare drainage' } };
    expect(persistStructuredOnly(b, 'k', value)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns false for missing backend / bad key', () => {
    expect(persistStructuredOnly(null, 'k', {})).toBe(false);
    expect(persistStructuredOnly({ setItem: () => {} }, '', {})).toBe(false);
  });

  it('survives backend throw and returns false', () => {
    const throwing = { setItem: () => { throw new Error('quota'); } };
    expect(persistStructuredOnly(throwing, 'k', { x: 1 })).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('readStructured', () => {
  it('parses JSON safely', () => {
    const backend = { getItem: () => JSON.stringify({ a: 1 }) };
    expect(readStructured(backend, 'k')).toEqual({ a: 1 });
  });
  it('returns null on malformed JSON', () => {
    const backend = { getItem: () => '{ broken' };
    expect(readStructured(backend, 'k')).toBeNull();
  });
  it('returns null when backend missing or key empty', () => {
    expect(readStructured(null, 'k')).toBeNull();
    expect(readStructured({ getItem: () => null }, '')).toBeNull();
  });
});

describe('shouldRehydrateOnLocaleChange', () => {
  it('true when locales differ', () => {
    expect(shouldRehydrateOnLocaleChange('en', 'hi')).toBe(true);
  });
  it('false when same', () => {
    expect(shouldRehydrateOnLocaleChange('en', 'en')).toBe(false);
  });
  it('false with null / non-string', () => {
    expect(shouldRehydrateOnLocaleChange(null, 'hi')).toBe(false);
    expect(shouldRehydrateOnLocaleChange('en', null)).toBe(false);
    expect(shouldRehydrateOnLocaleChange(1, 2)).toBe(false);
  });
});

// ─── buildFeedbackEvent ──────────────────────────────────────
describe('buildFeedbackEvent', () => {
  it('builds task_feedback helpful event', () => {
    const evt = buildFeedbackEvent({
      verdict: 'helpful',
      taskId: 't1',
      countryCode: 'gh',
      cropId: 'MAIZE',
      stage: 'land_prep',
      locale: 'en',
      nowMs: 1700000000000,
    });
    expect(evt.name).toBe('task_feedback');
    expect(evt.payload.verdict).toBe('helpful');
    expect(evt.payload.taskId).toBe('t1');
    expect(evt.payload.countryCode).toBe('GH');
    expect(evt.payload.cropId).toBe('MAIZE');
    expect(evt.payload.at).toBe(1700000000000);
    // 'helpful' should not carry a reason even if passed.
    expect('reason' in evt.payload).toBe(false);
  });

  it('builds state_feedback when taskId absent', () => {
    const evt = buildFeedbackEvent({
      verdict: 'not_right',
      reason: 'doesnt_match_field',
      stateType: 'harvest_complete',
    });
    expect(evt.name).toBe('state_feedback');
    expect(evt.payload.reason).toBe('doesnt_match_field');
  });

  it('drops invalid reason even if verdict is not_right', () => {
    const evt = buildFeedbackEvent({
      verdict: 'not_right', reason: 'bogus', taskId: 't1',
    });
    expect('reason' in evt.payload).toBe(false);
  });

  it('returns null when verdict is not in the allowed set', () => {
    expect(buildFeedbackEvent({ verdict: 'maybe', taskId: 't1' })).toBeNull();
  });

  it('returns null when neither taskId nor stateType given', () => {
    expect(buildFeedbackEvent({ verdict: 'helpful' })).toBeNull();
  });

  it('auto-timestamps with nowMs fallback to Date.now', () => {
    const before = Date.now();
    const evt = buildFeedbackEvent({ verdict: 'helpful', taskId: 't' });
    const after = Date.now();
    expect(evt.payload.at).toBeGreaterThanOrEqual(before);
    expect(evt.payload.at).toBeLessThanOrEqual(after);
  });

  it('drops falsy optional fields from payload', () => {
    const evt = buildFeedbackEvent({
      verdict: 'helpful', taskId: 't1',
      countryCode: '', cropId: null, stage: undefined,
    });
    expect('countryCode' in evt.payload).toBe(false);
    expect('cropId'      in evt.payload).toBe(false);
    expect('stage'       in evt.payload).toBe(false);
  });

  it('normalizes 2-letter country codes to upper-case', () => {
    const evt = buildFeedbackEvent({ verdict: 'helpful', taskId: 't', countryCode: 'gh' });
    expect(evt.payload.countryCode).toBe('GH');
  });

  it('passes through longer country strings unchanged (trimmed)', () => {
    const evt = buildFeedbackEvent({ verdict: 'helpful', taskId: 't', countryCode: '  GHA  ' });
    expect(evt.payload.countryCode).toBe('GHA');
  });

  it('returns null for non-object input', () => {
    expect(buildFeedbackEvent(null)).toBeNull();
    expect(buildFeedbackEvent('verdict=helpful')).toBeNull();
    expect(buildFeedbackEvent(42)).toBeNull();
  });
});

describe('isValidReason', () => {
  it('accepts only the three whitelisted reasons', () => {
    expect(isValidReason('doesnt_match_field')).toBe(true);
    expect(isValidReason('already_did')).toBe(true);
    expect(isValidReason('not_clear')).toBe(true);
    expect(isValidReason('other')).toBe(false);
    expect(isValidReason('')).toBe(false);
    expect(isValidReason(null)).toBe(false);
  });
});
