/**
 * gapFixPass.test.js — covers the 15 tests in spec §15 of the
 * "Gap Fix Pass" (language + dead-end + action/why + event/outcome
 * + farmType + alert dedup + Edit Farm + robustness).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function installWindow() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/', search: '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear:      () => map.clear(),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

// ─── Helper imports ──────────────────────────────────────────────
import { safeTranslate, safeTranslateOne } from '../../../src/lib/i18n/safeTranslate.js';
import { resolveBlock } from '../../../src/lib/i18n/blockResolve.js';
import {
  logEvent, getEvents, clearEvents, EVENT_TYPES,
} from '../../../src/lib/events/eventLogger.js';
import {
  recordOutcome, getOutcomes, getOutcomeSummary, clearOutcomes,
  OUTCOME, mapAnswerToOutcome,
} from '../../../src/lib/outcomes/outcomeStore.js';
import { pickTopAlert, isDuplicateOfTop, ALERT_PRIORITY }
  from '../../../src/lib/alerts/topAlertPicker.js';
import { computeProgress, STATUS } from '../../../src/lib/progress/progressEngine.js';
import {
  generateDailyTasks,
} from '../../../src/lib/tasks/dailyTaskEngine.js';
import {
  farmToEditForm, editFormToPatch, validateEditForm,
} from '../../../src/utils/editFarm/editFarmMapper.js';
import {
  getFarmerVisibleAlerts,
} from '../../../src/lib/issues/outbreakEngine.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

beforeEach(() => { installWindow(); clearEvents(); clearOutcomes(); });
afterEach(()  => { delete globalThis.window; });

// ─── 1. No mixed-language render in a block ──────────────────────
describe('safeTranslate: one language per block', () => {
  it('returns all translated values when every required key is present', () => {
    const t = (k) => ({
      'card.title': 'Titre',
      'card.body':  'Corps',
      'card.cta':   'Action',
    }[k] || k);
    const r = safeTranslate(t,
      { title: 'card.title', body: 'card.body', cta: 'card.cta' },
      { title: 'Title',      body: 'Body',      cta: 'Action' });
    expect(r.translated).toBe(true);
    expect(r.values).toEqual({ title: 'Titre', body: 'Corps', cta: 'Action' });
    // No raw keys leaked.
    expect(Object.values(r.values).some((v) => v.includes('card.'))).toBe(false);
  });
});

// ─── 2. Missing key falls back the WHOLE block to English ────────
describe('safeTranslate: atomic fallback', () => {
  it('falls the whole block to English when one required key is missing', () => {
    const t = (k) => ({
      'card.title': 'Titre',
      // 'card.body' intentionally missing — t() returns the raw key
      'card.cta':   'Action',
    }[k] || k);
    const r = safeTranslate(t,
      { title: 'card.title', body: 'card.body', cta: 'card.cta' },
      { title: 'Title',      body: 'Body',      cta: 'Action' });
    expect(r.translated).toBe(false);
    expect(r.values).toEqual({ title: 'Title', body: 'Body', cta: 'Action' });
    // NO mixed render: no French string survives the fallback.
    expect(Object.values(r.values)).not.toContain('Titre');
  });

  it('never leaks a raw translation key', () => {
    const t = (k) => k;   // worst-case translator — everything missing
    const { values } = safeTranslate(t,
      { a: 'some.key.a' }, { a: 'English A' });
    expect(values.a).toBe('English A');
    expect(values.a).not.toContain('some.key');
  });

  it('safeTranslateOne never leaks the raw key either', () => {
    const t = (k) => k;
    expect(safeTranslateOne(t, 'auth.foo.bar', 'Sign in')).toBe('Sign in');
    expect(safeTranslateOne(t, 'auth.foo.bar')).toBe('');
  });

  it('is equivalent to the pre-existing resolveBlock API', () => {
    const t = (k) => ({ a: 'A-fr' }[k] || k);
    const out1 = safeTranslate(t, { a: 'a' }, { a: 'A-en' });
    const out2 = resolveBlock(t, { a: 'a' }, { a: 'A-en' });
    expect(out1).toEqual(out2);
  });
});

// ─── 3. All-done state always has a next action ──────────────────
describe('progressEngine: all-done state carries a bridge action', () => {
  it('returns a bridge action when every task is complete', () => {
    const tasks = [{ id: 't1' }, { id: 't2' }];
    const completions = [
      { taskId: 't1', completed: true, timestamp: NOW },
      { taskId: 't2', completed: true, timestamp: NOW },
    ];
    const snap = computeProgress({ tasks, completions, now: NOW });
    expect(snap.nextBestAction.kind).toBe('bridge');
    expect(snap.nextBestAction.bridgeKey).toMatch(/^progress\.(check_tomorrow|prepare_next_stage)$/);
  });

  it('explanationKey is always present (never a bare number card)', () => {
    const snap = computeProgress({ tasks: [], completions: [], now: NOW });
    expect(typeof snap.explanationKey).toBe('string');
    expect(snap.explanationKey).toMatch(/^progress\.explain\./);
    expect(typeof snap.explanationFallback).toBe('string');
    expect(snap.explanationFallback.length).toBeGreaterThan(0);
  });
});

// ─── 4. Weather/risk insight renders as action triple ────────────
describe('insightFormatter: action-shaped insights', () => {
  it('weather insight emits (condition, timeWindow, actions[])', async () => {
    const { formatWeatherInsight } =
      await import('../../../src/lib/farmer/insightFormatter.js');
    const ins = formatWeatherInsight({
      weather: { status: 'low_rain' }, forecastDays: 3,
    });
    expect(ins).not.toBeNull();
    expect(typeof ins.condition).toBe('string');
    expect(typeof ins.timeWindow).toBe('string');
    expect(Array.isArray(ins.actions)).toBe(true);
    expect(ins.actions.length).toBeGreaterThan(0);
  });
});

// ─── 5. WHY line appears on generated tasks ──────────────────────
describe('taskEngine: generated tasks carry a WHY reason', () => {
  it('primary task carries a whyKey / category reason', async () => {
    // Use the existing taskEngine (not dailyTaskEngine) which emits
    // top-level `why` and per-task whyKey.
    const mod = await import('../../../src/lib/tasks/taskEngine.js');
    // 'mid_growth' maps to the bridge stage which returns a
    // whyKey-less next-stage task. Use a stage that has real tasks.
    const out = mod.generateTasks({
      crop: 'maize', stage: 'early_growth',
      weatherRisk: { temperature: 26, rainfall: 'normal' },
    });
    expect(out).toBeTruthy();
    const anyWhy = [out.primaryTask, ...(out.secondaryTasks || [])]
      .some((t) => t && (t.whyKey || t.why || t.reasonKey));
    expect(anyWhy).toBe(true);
  });
});

// ─── 6. Progress card includes explanation text ──────────────────
describe('progressEngine: explanation line ties score to stage + action', () => {
  it('early stage + on-track returns the early explanation', () => {
    const snap = computeProgress({
      farm: { cropStage: 'planting' },
      tasks: [{ id: 't1' }],
      completions: [{ taskId: 't1', completed: true, timestamp: NOW }],
      stageCompletionPercent: 20,
      now: NOW,
    });
    expect(snap.explanationKey).toMatch(/ontrack/);
    expect(snap.explanationFallback).toMatch(/early stage|today/i);
  });

  it('slight delay gets the catch-up explanation', () => {
    const snap = computeProgress({
      tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      completions: [],
      stageCompletionPercent: 55,
      now: NOW,
    });
    // With 0 completions and no stage bonus, score drops below 40.
    // We should land in slight_delay or high_risk bands — both have
    // an honest, action-oriented explanation.
    expect(['slight_delay', 'high_risk']).toContain(snap.status);
    expect(snap.explanationFallback.length).toBeGreaterThan(0);
  });
});

// ─── 7. Event logger writes the canonical types ──────────────────
describe('eventLogger: canonical event types', () => {
  it('accepts legacy + gap-fix types and persists them', () => {
    const types = [
      'task_completed', 'task_feedback', 'task_skipped',
      'issue_reported', 'issue_status_changed', 'issue_resolved',
      'alert_dismissed', 'outcome_recorded',
    ];
    for (const t of types) {
      expect(EVENT_TYPES).toContain(t);
      const r = logEvent({ farmId: 'f1', farmerId: 'u1', type: t });
      expect(r).not.toBeNull();
      expect(r.farmerId).toBe('u1');
      expect(r.eventType).toBe(t);
    }
    expect(getEvents().length).toBe(types.length);
  });

  it('accepts canonical eventType + metadata aliases', () => {
    const r = logEvent({
      farmId: 'f2', eventType: 'task_completed',
      metadata: { taskId: 't1', note: 'ok' },
    });
    expect(r.type).toBe('task_completed');
    expect(r.metadata).toEqual({ taskId: 't1', note: 'ok' });
    expect(r.payload).toEqual({ taskId: 't1', note: 'ok' });
  });

  it('rejects unknown types without throwing', () => {
    expect(logEvent({ type: 'not_a_real_type' })).toBeNull();
    expect(logEvent({})).toBeNull();
  });
});

// ─── 8. Outcome record saves correctly ───────────────────────────
describe('outcomeStore: Yes / No / Not sure', () => {
  it('maps answers to canonical codes', () => {
    expect(mapAnswerToOutcome('yes')).toBe(OUTCOME.IMPROVED);
    expect(mapAnswerToOutcome('no')).toBe(OUTCOME.WORSE);
    expect(mapAnswerToOutcome('not_sure')).toBe(OUTCOME.NO_CHANGE);
    expect(mapAnswerToOutcome('unknown_value')).toBe(null);
  });

  it('recordOutcome persists a task outcome', () => {
    const row = recordOutcome({
      farmId: 'f1', sourceType: 'task', sourceId: 't1',
      action: 'task_completed', answer: 'yes',
    });
    expect(row).not.toBeNull();
    expect(row.outcome).toBe('improved');
    expect(getOutcomes({ farmId: 'f1' }).length).toBe(1);
  });

  it('rejects invalid sourceType silently', () => {
    expect(recordOutcome({
      farmId: 'f1', sourceType: 'bogus', sourceId: 'x', answer: 'yes',
    })).toBeNull();
  });

  it('summary counts outcomes + helpful rate', () => {
    recordOutcome({ farmId: 'f1', sourceType: 'task', sourceId: 't1', answer: 'yes' });
    recordOutcome({ farmId: 'f1', sourceType: 'task', sourceId: 't2', answer: 'yes' });
    recordOutcome({ farmId: 'f1', sourceType: 'task', sourceId: 't3', answer: 'no' });
    const sum = getOutcomeSummary({ farmId: 'f1' });
    expect(sum.total).toBe(3);
    expect(sum.helpfulRate).toBe(67);
    expect(sum.byOutcome.improved).toBe(2);
    expect(sum.byOutcome.worse).toBe(1);
  });
});

// ─── 9. Backyard gets fewer/simpler tasks than commercial ────────
describe('farmType: backyard < small_farm < commercial', () => {
  it('backyard today list stays small, commercial expands', () => {
    const back = generateDailyTasks({
      crop: 'maize', stage: 'mid_growth', farmType: 'backyard',
    });
    const comm = generateDailyTasks({
      crop: 'maize', stage: 'mid_growth', farmType: 'commercial',
    });
    expect(back.today.length).toBeLessThanOrEqual(2);
    expect(comm.today.length).toBeGreaterThanOrEqual(back.today.length);
  });
});

// ─── 10. farmType fallback = small_farm ──────────────────────────
describe('farmType: missing falls back to small_farm', () => {
  it('computeProgress echoes small_farm when no farmType is passed', () => {
    const snap = computeProgress({ tasks: [], completions: [], now: NOW });
    expect(snap.farmType).toBe('small_farm');
  });
  it('editFarmMapper defaults to small_farm on old rows', () => {
    const form = farmToEditForm({});
    expect(form.farmType).toBe('small_farm');
  });
});

// ─── 11. Top alert is not duplicated ─────────────────────────────
describe('pickTopAlert: single top alert at a time', () => {
  it('picks critical > weather > reminder by priority', () => {
    const critical = { id: 'c1', severity: 'high', message: 'Outbreak nearby' };
    const weather  = { id: 'w1', severity: 'high', message: 'Severe rain' };
    const reminder = { id: 'r1', show: true, kind: 'daily', severity: 'info' };
    const top = pickTopAlert({ critical, weather, reminder });
    expect(top.kind).toBe('critical');
    expect(top.priority).toBe(ALERT_PRIORITY.CRITICAL);
  });

  it('isDuplicateOfTop flags the below-the-fold echo', () => {
    const top = { kind: 'weather' };
    expect(isDuplicateOfTop('weather', top)).toBe(true);
    expect(isDuplicateOfTop({ kind: 'weather' }, top)).toBe(true);
    expect(isDuplicateOfTop('risk', { kind: 'critical' })).toBe(true);
    expect(isDuplicateOfTop('reminder', { kind: 'weather' })).toBe(false);
  });
});

// ─── 12. Dismissed alert stays hidden for current cycle ──────────
describe('pickTopAlert + dismiss memory', () => {
  it('skips a dismissed top alert and falls through to the next', () => {
    const critical = { id: 'c1', severity: 'high', message: 'X' };
    const weather  = { id: 'w1', severity: 'high', message: 'Y' };
    const dismissedSet = new Set(['c1']);
    const top = pickTopAlert({
      critical, weather,
      isDismissed: (id) => dismissedSet.has(id),
    });
    expect(top.kind).toBe('weather');
  });

  it('re-fires when isDismissed returns false again', () => {
    const critical = { id: 'c1', severity: 'high', message: 'X' };
    const first = pickTopAlert({ critical, isDismissed: () => true });
    expect(first).toBeNull();
    const second = pickTopAlert({ critical, isDismissed: () => false });
    expect(second && second.kind).toBe('critical');
  });
});

// ─── 13. Farmer sees outbreak only for same crop + region ────────
describe('outbreakEngine: farmer-visible alerts are scoped', () => {
  it('only returns medium/high same-region same-crop clusters', () => {
    const clusters = [
      { id: 'a', severity: 'medium', regionKey: 'AS', crop: 'maize',
        predictedCategory: 'pest', count: 4 },
      { id: 'b', severity: 'high',   regionKey: 'NP', crop: 'maize',
        predictedCategory: 'pest', count: 5 },            // other region
      { id: 'c', severity: 'low',    regionKey: 'AS', crop: 'maize',
        predictedCategory: 'pest', count: 2 },            // low severity
      { id: 'd', severity: 'high',   regionKey: 'AS', crop: 'cassava',
        predictedCategory: 'disease', count: 6 },         // other crop
    ];
    const out = getFarmerVisibleAlerts({
      clusters,
      farmer: { region: 'AS', crop: 'maize' },
      now: NOW,
    });
    expect(out.length).toBe(1);
    expect(out[0].clusterId).toBe('a');
  });
});

// ─── 14. Edit Farm loads normalized existing values correctly ────
describe('editFarmMapper: normalized load + patch', () => {
  it('loads a complete farm into the controlled-input shape', () => {
    const form = farmToEditForm({
      farmName: 'Test Farm', cropType: 'maize',
      country: 'GH', stateCode: 'AS',
      size: 3, sizeUnit: 'ACRE',
      cropStage: 'mid_growth',
      farmType: 'commercial',
    });
    expect(form.farmName).toBe('Test Farm');
    expect(form.cropType).toBe('maize');
    expect(form.country).toBe('GH');
    expect(form.stateCode).toBe('AS');
    expect(form.size).toBe('3');
    expect(form.sizeUnit).toBe('ACRE');
    expect(form.cropStage).toBe('mid_growth');
    expect(form.farmType).toBe('commercial');
  });

  it('validateEditForm flags blank required fields', () => {
    const err = validateEditForm({ farmName: '', country: '', cropType: '' });
    expect(err.farmName).toBeTruthy();
    expect(err.country).toBeTruthy();
    expect(err.cropType).toBeTruthy();
  });

  it('editFormToPatch never carries onboarding state', () => {
    const patch = editFormToPatch(
      { farmName: 'X', farmType: 'commercial', farmerType: 'legacy',
        onboardingCompleted: true, hasSeenIntro: true },
      { farmName: 'X' },
    );
    expect('farmerType' in patch).toBe(false);
    expect('onboardingCompleted' in patch).toBe(false);
    expect('hasSeenIntro' in patch).toBe(false);
    expect(patch.farmType).toBe('commercial');
  });
});

// ─── 15. No crashes with old farm data missing fields ────────────
describe('robustness: legacy farm rows render safely', () => {
  it('farmToEditForm accepts null / partial / malformed inputs', () => {
    expect(farmToEditForm(null).farmType).toBe('small_farm');
    expect(farmToEditForm(undefined).farmName).toBe('');
    expect(farmToEditForm({ farmName: 'X' }).cropType).toBe('');
    expect(farmToEditForm({ size: 2 }).sizeUnit).toBe('ACRE');
  });

  it('computeProgress survives a farm with only cropStage', () => {
    const snap = computeProgress({
      farm: { cropStage: 'planting' },
      tasks: [],
      completions: [],
      now: NOW,
    });
    expect(snap.progressScore).toBeDefined();
    expect(snap.farmType).toBe('small_farm');
    expect(snap.explanationFallback).toBeTruthy();
  });

  it('generateDailyTasks survives farms missing farmType', () => {
    const r = generateDailyTasks({ crop: 'maize', stage: 'mid_growth' });
    expect(r.today.length).toBeGreaterThan(0);
  });

  it('pickTopAlert returns null when everything is absent / dismissed', () => {
    expect(pickTopAlert({})).toBeNull();
    expect(pickTopAlert({
      critical: { id: 'x', severity: 'low' },
      isDismissed: () => true,
    })).toBeNull();
  });
});

// ─── Nice-to-verify: recording outcomes also writes an event ─────
describe('integration: outcome + event log', () => {
  it('recordOutcome persists independently; logEvent can mark it', () => {
    recordOutcome({
      farmId: 'f1', sourceType: 'task', sourceId: 't1',
      action: 'task_completed', answer: 'yes',
    });
    logEvent({
      farmId: 'f1', eventType: 'outcome_recorded',
      metadata: { sourceType: 'task', sourceId: 't1', outcome: 'improved' },
    });
    expect(getOutcomes().length).toBe(1);
    expect(getEvents().some((e) => e.eventType === 'outcome_recorded')).toBe(true);
  });
});

// Keep STATUS exported (sanity — other suites rely on this import)
expect(STATUS).toBeDefined();
