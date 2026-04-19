/**
 * dynamicGreeting.test.js — behavioral contract for the dynamic
 * greeting system. Covers:
 *
 *   • state resolver priority (post-harvest > inactive > first-use > ...)
 *   • per-state title + subtitle output
 *   • time-of-day title substitution on active/done states
 *   • crop name interpolation using the {crop} token
 *   • localization in every supported locale (no English leak)
 *   • stability: unknown / missing inputs never throw
 *   • greeting copy never reduces to empty branding
 */

import { describe, it, expect } from 'vitest';

import {
  getGreetingState,
  getTimeOfDay,
  GREETING_STATES,
  GREETING_PRIORITY,
} from '../../../src/utils/getGreetingState.js';
import { getDynamicGreeting } from '../../../src/utils/getDynamicGreeting.js';
import {
  GREETING_TRANSLATIONS,
  applyGreetingOverlay,
} from '../../../src/i18n/greetingTranslations.js';

// A helper to simulate the app's t() function: look up the key in
// a locale table and fall back to the raw key if missing. This
// matches the convention getDynamicGreeting already understands.
function makeT(locale) {
  const dict = GREETING_TRANSLATIONS[locale] || {};
  return (key) => dict[key] || key;
}

// ─── State resolver ───────────────────────────────────────
describe('getGreetingState — priority order', () => {
  it('post_harvest beats everything', () => {
    const s = getGreetingState({
      hasJustCompletedHarvest: true,
      hasCatchUpState: true,
      missedDays: 30,
      hasCompletedOnboarding: false,
      todayState: 'active',
    });
    expect(s).toBe(GREETING_STATES.POST_HARVEST);
  });

  it('inactive_return beats first_use, active_day, done_for_today', () => {
    const s = getGreetingState({
      missedDays: 5,
      hasCompletedOnboarding: false,
      hasActiveCropCycle: false,
      todayState: 'active',
    });
    expect(s).toBe(GREETING_STATES.INACTIVE_RETURN);
  });

  it('catch-up flag forces inactive_return even with 0 missed days', () => {
    const s = getGreetingState({
      hasCatchUpState: true,
      missedDays: 0,
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
    });
    expect(s).toBe(GREETING_STATES.INACTIVE_RETURN);
  });

  it('first_use when onboarding not done', () => {
    const s = getGreetingState({ hasCompletedOnboarding: false });
    expect(s).toBe(GREETING_STATES.FIRST_USE);
  });

  it('first_use when onboarding done but no cycle', () => {
    const s = getGreetingState({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: false,
    });
    expect(s).toBe(GREETING_STATES.FIRST_USE);
  });

  it('active_day requires both onboarding and an active cycle', () => {
    const s = getGreetingState({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
    });
    expect(s).toBe(GREETING_STATES.ACTIVE_DAY);
  });

  it('done_for_today when all tasks are done', () => {
    const s = getGreetingState({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'done',
    });
    expect(s).toBe(GREETING_STATES.DONE_FOR_TODAY);
  });

  it('generic when nothing specific', () => {
    const s = getGreetingState({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      // todayState omitted — no task info
    });
    expect(s).toBe(GREETING_STATES.GENERIC);
  });

  it('threshold is tunable via inactiveThresholdDays', () => {
    const s = getGreetingState({
      missedDays: 2,
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
      inactiveThresholdDays: 2,
    });
    expect(s).toBe(GREETING_STATES.INACTIVE_RETURN);
  });

  it('priority constant mirrors the documented order', () => {
    expect(GREETING_PRIORITY[0]).toBe(GREETING_STATES.POST_HARVEST);
    expect(GREETING_PRIORITY[GREETING_PRIORITY.length - 1]).toBe(GREETING_STATES.GENERIC);
  });
});

// ─── Time of day ─────────────────────────────────────────
describe('getTimeOfDay', () => {
  it('< 12 is morning', () => {
    expect(getTimeOfDay(new Date('2026-04-19T09:00:00'))).toBe('morning');
  });
  it('12–16 is afternoon', () => {
    expect(getTimeOfDay(new Date('2026-04-19T13:00:00'))).toBe('afternoon');
  });
  it('17+ is evening', () => {
    expect(getTimeOfDay(new Date('2026-04-19T19:00:00'))).toBe('evening');
  });
});

// ─── getDynamicGreeting — per-state output ────────────────
describe('getDynamicGreeting — states', () => {
  const en = makeT('en');

  it('first_use → Welcome + "Here\'s what to do first"', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: false,
    }, en);
    expect(g.state).toBe('first_use');
    expect(g.title).toBe('Welcome 👋');
    expect(g.subtitle).toBe('Here\u2019s what to do first');
  });

  it('active_day with crop → time-of-day title + crop-interpolated subtitle', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
      cropLabel: 'tomatoes',
      now: new Date('2026-04-19T09:00:00'),
    }, en);
    expect(g.state).toBe('active_day');
    expect(g.title).toBe('Good morning 👋');
    expect(g.subtitle).toBe('Let\u2019s take care of your tomatoes today');
    expect(g.subtitleKey).toBe('greeting.active_day.subtitle_with_crop');
  });

  it('active_day without crop → generic today subtitle', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
      now: new Date('2026-04-19T13:00:00'),
    }, en);
    expect(g.state).toBe('active_day');
    expect(g.title).toBe('Good afternoon 👋');
    expect(g.subtitle).toBe('Let\u2019s get today\u2019s farm work done');
  });

  it('done_for_today → Nice work + You\'re done', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'done',
    }, en);
    expect(g.state).toBe('done_for_today');
    expect(g.title).toBe('Nice work 👍');
    expect(g.subtitle).toBe('You\u2019re done for today');
  });

  it('inactive_return with few missed days → standard welcome-back', () => {
    const g = getDynamicGreeting({
      missedDays: 3,
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
    }, en);
    expect(g.state).toBe('inactive_return');
    expect(g.title).toBe('Welcome back 👋');
    expect(g.subtitle).toBe('Let\u2019s get you back on track');
  });

  it('inactive_return with many missed days → stronger copy', () => {
    const g = getDynamicGreeting({
      missedDays: 7,
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
    }, en);
    expect(g.state).toBe('inactive_return');
    expect(g.subtitle).toBe('You missed a few days — start with this');
  });

  it('post_harvest → Harvest complete + next-cycle cue', () => {
    const g = getDynamicGreeting({
      hasJustCompletedHarvest: true,
    }, en);
    expect(g.state).toBe('post_harvest');
    expect(g.title).toBe('Harvest complete 👏');
    expect(g.subtitle).toBe('Let\u2019s plan your next crop');
  });

  it('generic fallback renders time-of-day title and no subtitle', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      now: new Date('2026-04-19T19:00:00'),
    }, en);
    expect(g.state).toBe('generic');
    expect(g.title).toBe('Good evening 👋');
    expect(g.subtitle).toBeNull();
  });
});

// ─── Rules enforcement ───────────────────────────────────
describe('getDynamicGreeting — rules', () => {
  it('never returns a raw key as the title', () => {
    // No t() passed → must fall back to English fallback
    const g = getDynamicGreeting({ hasCompletedOnboarding: false });
    expect(g.title).not.toMatch(/^greeting\./);
  });

  it('never includes the word "Farroway" in any produced copy', () => {
    const g = getDynamicGreeting({ hasJustCompletedHarvest: true }, makeT('en'));
    expect(g.title.toLowerCase()).not.toContain('farroway');
    expect((g.subtitle || '').toLowerCase()).not.toContain('farroway');
  });

  it('does not emit a subtitle that is just "Welcome" / branding', () => {
    // Active day with no crop + missing copy → fallback generic
    // sub. The guard kicks in even for a mocked t() that returns
    // "Welcome".
    const brandingT = (k) => (k === 'greeting.active_day.subtitle_generic' ? 'Welcome' : null);
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
      cropLabel: '',
    }, brandingT);
    expect(g.subtitle).toBeNull();
  });

  it('handles unknown / missing input without throwing', () => {
    expect(() => getDynamicGreeting(undefined)).not.toThrow();
    expect(() => getDynamicGreeting(null)).not.toThrow();
    expect(() => getDynamicGreeting({})).not.toThrow();
  });
});

// ─── Localization ────────────────────────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const REQUIRED_KEYS = [
  'greeting.time.morning',
  'greeting.time.afternoon',
  'greeting.time.evening',
  'greeting.first_use.title',
  'greeting.first_use.subtitle',
  'greeting.active_day.subtitle_with_crop',
  'greeting.active_day.subtitle_generic',
  'greeting.done.title',
  'greeting.done.subtitle',
  'greeting.inactive_return.title',
  'greeting.inactive_return.subtitle',
  'greeting.inactive_return.subtitle_many',
  'greeting.post_harvest.title',
  'greeting.post_harvest.subtitle',
];

describe('greetingTranslations overlay', () => {
  it('covers every supported locale', () => {
    for (const l of ['en', ...NON_EN_LOCALES]) {
      expect(GREETING_TRANSLATIONS[l]).toBeDefined();
    }
  });

  it('every locale has every required key', () => {
    for (const l of ['en', ...NON_EN_LOCALES]) {
      for (const k of REQUIRED_KEYS) {
        expect(GREETING_TRANSLATIONS[l][k]).toBeTruthy();
      }
    }
  });

  it('non-English locales do not leak the English string', () => {
    for (const l of NON_EN_LOCALES) {
      for (const k of REQUIRED_KEYS) {
        const en = GREETING_TRANSLATIONS.en[k];
        expect(GREETING_TRANSLATIONS[l][k]).not.toBe(en);
      }
    }
  });

  it('applyGreetingOverlay merges into an existing dictionary', () => {
    const existing = { en: { 'some.key': 'v' }, hi: { 'some.key': 'वेल' } };
    const ref = applyGreetingOverlay(existing);
    expect(ref).toBe(existing);
    expect(existing.en['some.key']).toBe('v');
    expect(existing.en['greeting.time.morning']).toBe('Good morning 👋');
    expect(existing.hi['greeting.post_harvest.title']).toBe('फ़सल पूरी हुई 👏');
  });
});

describe('getDynamicGreeting — localization round-trip', () => {
  it.each(NON_EN_LOCALES)('locale %s renders without English leak', (locale) => {
    const t = makeT(locale);
    const g = getDynamicGreeting({
      hasJustCompletedHarvest: true,
    }, t);
    expect(g.title).toBe(GREETING_TRANSLATIONS[locale]['greeting.post_harvest.title']);
    expect(g.subtitle).toBe(GREETING_TRANSLATIONS[locale]['greeting.post_harvest.subtitle']);
    expect(g.title).not.toBe(GREETING_TRANSLATIONS.en['greeting.post_harvest.title']);
  });

  it('crop token is interpolated in each locale', () => {
    for (const l of ['en', 'hi', 'tw', 'es', 'fr', 'sw']) {
      const t = makeT(l);
      const g = getDynamicGreeting({
        hasCompletedOnboarding: true,
        hasActiveCropCycle: true,
        todayState: 'active',
        cropLabel: 'tomatoes',
        now: new Date('2026-04-19T09:00:00'),
      }, t);
      expect(g.subtitle).toContain('tomatoes');
      expect(g.subtitle).not.toContain('{crop}');
    }
  });
});

// ─── Hindi spec verbatim check ───────────────────────────
describe('Hindi copy matches spec', () => {
  it.each([
    ['greeting.time.morning', 'सुप्रभात 👋'],
    ['greeting.first_use.title', 'स्वागत है 👋'],
    ['greeting.post_harvest.title', 'फ़सल पूरी हुई 👏'],
    ['greeting.done.title', 'बहुत बढ़िया 👍'],
  ])('%s → %s', (key, expected) => {
    expect(GREETING_TRANSLATIONS.hi[key]).toBe(expected);
  });
});

// ─── Stability / edge cases ──────────────────────────────
describe('stability', () => {
  it('missedDays as string is coerced safely', () => {
    const s = getGreetingState({
      missedDays: 'not-a-number',
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
    });
    expect(s).toBe(GREETING_STATES.ACTIVE_DAY);
  });

  it('timeOfDay override beats the Date-based inference', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'active',
      timeOfDay: 'evening',
      now: new Date('2026-04-19T09:00:00'),
    }, makeT('en'));
    expect(g.title).toBe('Good evening 👋');
  });

  it('no t() — still produces English fallback, never a raw key', () => {
    const g = getDynamicGreeting({
      hasCompletedOnboarding: true,
      hasActiveCropCycle: true,
      todayState: 'done',
    });
    expect(g.title).toBe('Nice work 👍');
    expect(g.subtitle).toBe('You\u2019re done for today');
  });
});
