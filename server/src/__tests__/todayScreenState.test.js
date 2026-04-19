/**
 * todayScreenState.test.js — lock in the 2-state Today system:
 *
 *   - getTodayScreenState returns 'active' when any required task
 *     remains, 'done' otherwise
 *   - optional checks only surface in 'done'; they never masquerade
 *     as unfinished required work
 *   - override synthetic tasks (heat / pest / catchup) count as
 *     required
 *   - next-hint fallback strings are driven by i18n keys, not
 *     hardcoded English
 *   - every new Today-state key resolves in every shipped locale
 *     with no English leak
 */
import { describe, it, expect } from 'vitest';
import {
  getTodayScreenState,
  OPTIONAL_CHECKS,
  _internal as stateInternal,
} from '../../../src/utils/getTodayScreenState.js';
import { t } from '../../../src/i18n/index.js';

const mkTask = (o = {}) => ({
  id: 't' + Math.random().toString(36).slice(2, 6),
  title: 'Water rows',
  priority: 'medium',
  ...o,
});

// ─── state switching ──────────────────────────────────────
describe('getTodayScreenState', () => {
  it('ACTIVE when a primary task exists', () => {
    const out = getTodayScreenState({ primaryTask: mkTask(), secondaryTasks: [] });
    expect(out.state).toBe('active');
    expect(out.primaryTask).toBeTruthy();
    expect(out.optionalChecks).toEqual([]);
  });

  it('ACTIVE when a secondary task exists even without a primary', () => {
    const out = getTodayScreenState({ primaryTask: null, secondaryTasks: [mkTask()] });
    expect(out.state).toBe('active');
  });

  it('DONE when no required tasks exist', () => {
    const out = getTodayScreenState({ primaryTask: null, secondaryTasks: [] });
    expect(out.state).toBe('done');
    expect(out.primaryTask).toBeNull();
    expect(out.secondaryTasks).toEqual([]);
    expect(out.optionalChecks.length).toBeGreaterThan(0);
  });

  it('override:* tasks still count as required', () => {
    const out = getTodayScreenState({
      primaryTask: mkTask({ source: 'override:heat' }),
      secondaryTasks: [],
    });
    expect(out.state).toBe('active');
  });

  it('ACTIVE caps secondaries at 2', () => {
    const out = getTodayScreenState({
      primaryTask: mkTask(),
      secondaryTasks: [mkTask(), mkTask(), mkTask(), mkTask()],
    });
    expect(out.secondaryTasks.length).toBe(2);
  });

  it('filters tasks marked optional out of the required count', () => {
    const out = getTodayScreenState({
      primaryTask: mkTask({ optional: true }),
      secondaryTasks: [mkTask({ optional: true })],
    });
    expect(out.state).toBe('done');
    expect(out.primaryTask).toBeNull();
  });

  it('optional checks come from the helper, not the server', () => {
    expect(OPTIONAL_CHECKS.map((x) => x.code))
      .toEqual(expect.arrayContaining(['scan_crop', 'inspect_field', 'review_status']));
  });

  it('progress shape is always {percent, done, total, overdueCount, riskLevel}', () => {
    const out = getTodayScreenState({
      primaryTask: null, secondaryTasks: [],
      tasksDone: 6, totalTasks: 6, overdueCount: 0, riskLevel: 'low',
    });
    expect(out.progress.percent).toBe(100);
    expect(out.progress.done).toBe(6);
    expect(out.progress.total).toBe(6);
    expect(out.progress.overdueCount).toBe(0);
    expect(out.progress.riskLevel).toBe('low');
  });
});

describe('next-hint selection', () => {
  it('ACTIVE falls back to a localized keepGoing key when no secondary title', () => {
    const out = getTodayScreenState({ primaryTask: mkTask(), secondaryTasks: [] });
    expect(out.nextHint.textKey).toBe('today.nextHint.keepGoing');
  });

  it('ACTIVE surfaces the first secondary task title', () => {
    const out = getTodayScreenState({
      primaryTask: mkTask(),
      secondaryTasks: [mkTask({ title: 'Scout for pests' })],
    });
    expect(out.nextHint.text).toBe('Scout for pests');
  });

  it('DONE defaults to noMoreToday', () => {
    const out = getTodayScreenState({ primaryTask: null, secondaryTasks: [] });
    expect(out.nextHint.textKey).toBe('today.nextHint.noMoreToday');
  });

  it('DONE respects a concrete server-provided hint', () => {
    const out = getTodayScreenState({
      primaryTask: null, secondaryTasks: [],
      serverHint: 'Fertilize in 2 days',
    });
    expect(out.nextHint.text).toBe('Fertilize in 2 days');
  });
});

// ─── i18n wire-up: no English leaks on localized screens ──
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const NEW_KEYS = [
  'today.done.title', 'today.done.body', 'today.done.donePill',
  'today.optional.title', 'today.optional.badge',
  'today.optional.scanCrop', 'today.optional.scanCrop.why',
  'today.optional.inspectField', 'today.optional.inspectField.why',
  'today.optional.reviewStatus', 'today.optional.reviewStatus.why',
  'today.nextHint.noMoreToday', 'today.nextHint.keepGoing',
];

describe('Today 2-state keys resolve in every shipped locale', () => {
  it.each(NEW_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });

  it.each(
    NON_EN_LOCALES.flatMap((lang) => NEW_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});

describe('wording corrections', () => {
  it('"Scan crop issue" is replaced with "Scan crop for issues"', () => {
    expect(t('today.optional.scanCrop', 'en')).toBe('Scan crop for issues');
    expect(t('today.optional.scanCrop', 'en')).not.toBe('Scan crop issue');
  });

  it('"Check your land" is replaced with "Check field condition"', () => {
    expect(t('today.optional.inspectField', 'en')).toBe('Check field condition');
  });
});

describe('internals guard', () => {
  it('isRequiredTask treats override tasks as required', () => {
    expect(stateInternal.isRequiredTask({ source: 'override:heat' })).toBe(true);
  });
  it('isRequiredTask honors explicit optional:true flag', () => {
    expect(stateInternal.isRequiredTask({ optional: true })).toBe(false);
  });
});
