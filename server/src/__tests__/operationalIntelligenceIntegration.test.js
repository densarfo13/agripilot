/**
 * operationalIntelligenceIntegration.test.js — end-to-end proof
 * that Farroway behaves as "one living farm operating system":
 * each domain event flows through the bus, lands in continuity
 * memory, and changes what Home recommends next.
 *
 * This is NOT a unit test. It deliberately wires:
 *   - farmContextEngine         (one source of truth)
 *   - continuityEngine          (memory + recommendation
 *                                orchestrator)
 *   - farmEventBus              (typed pub/sub)
 *   - multiExperience.addFarm   (canonical write path)
 *   - getFarmHealthState        (Stable / Watch / Needs attention)
 * and asserts the SPEC-MANDATED loops hold:
 *
 *   1. addFarm  -> Home reads same farm
 *   2. scan.completed -> follow-up created -> recommendation
 *      surfaces scan_followup as the highest-priority rung
 *   3. task.completed -> follow-up cleared
 *   4. weather.updated 'severe storm' -> recommendation flips
 *      to the weather rung
 *   5. farm health tone shifts when overdue follow-ups stack up
 *
 * If this suite fails, the "living system" contract is broken.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
}

beforeEach(() => {
  vi.resetModules();
  const ls = makeStorage();
  globalThis.localStorage = ls;
  globalThis.window = {
    localStorage:        ls,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
});

// ─── Loop 1: addFarm flows to Home ──────────────────────────

describe('Loop 1 — addFarm flows to Home via canonical context', () => {
  it('multiExperience.addFarm makes farmContextEngine resolve the same farm', async () => {
    const me = await import('../../../src/store/multiExperience.js');
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const row = me.addFarm({
      name: 'Loop Test Farm', crop: 'tomato', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    expect(row).toBeTruthy();
    expect(fc.getFarmContext().farm.id).toBe(row.id);
    expect(fc.getFarmContext().hasFarm).toBe(true);
  });

  it('addFarm publishes FARM_CREATED on the typed bus', async () => {
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    const heard = [];
    bus.subscribe(bus.FarmEvents.FARM_CREATED, (p) => heard.push(p));
    const me = await import('../../../src/store/multiExperience.js');
    me.addFarm({
      name: 'A', crop: 'tomato', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    expect(heard.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Loop 2: scan.completed → follow-up → recommendation ────

describe('Loop 2 — scan.completed creates follow-up + flips recommendation', () => {
  it('non-healthy scan auto-creates a follow-up entry', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('scan.completed', {
      scanId:    'scan_1',
      category:  'pest_damage',
      confidence: 'likely',
    });
    const memory = ce.getRecentMemory();
    expect(memory.lastScan.scanId).toBe('scan_1');
    expect(memory.followUps.length).toBe(1);
    expect(memory.followUps[0].source).toBe('scan');
  });

  it('healthy scan does NOT create a follow-up', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('scan.completed', {
      scanId: 'scan_h', category: 'healthy',
    });
    expect(ce.getRecentMemory().followUps.length).toBe(0);
  });

  it('a DUE scan follow-up wins the recommendation ladder (rung 1)', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('scan.completed', {
      scanId:     'scan_due',
      category:   'yellowing',
      confidence: 'likely',
      followUpAt: Date.now() - 1000, // already due
    });
    const action = ce.getNextBestAction();
    expect(action.source).toBe('scan_followup');
    expect(action.urgency).toBe('high');
    expect(action.cta).toBe('Open scan');
  });
});

// ─── Loop 3: task.completed → follow-up cleared ─────────────

describe('Loop 3 — task.completed clears the matching follow-up', () => {
  it('completing a task by id removes the follow-up referencing it', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    // Stamp a task follow-up via the overdue event.
    ce.recordEvent('task.overdue', {
      taskId: 't_clear', title: 'Inspect leaves', dueAt: Date.now() - 1000,
    });
    expect(ce.getRecentMemory().followUps.length).toBeGreaterThan(0);
    ce.recordEvent('task.completed', {
      taskId: 't_clear', title: 'Inspect leaves',
    });
    const after = ce.getRecentMemory();
    expect(after.lastTask.taskId).toBe('t_clear');
    expect(after.followUps.find((f) => f.taskId === 't_clear')).toBeUndefined();
  });
});

// ─── Loop 4: weather.updated → recommendation flips ─────────

describe('Loop 4 — severe weather wins the recommendation rung', () => {
  it('weather "severe storm" surfaces as rung 2 (weather risk)', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('weather.updated', {
      condition: 'severe storm', temp: 22,
    });
    const action = ce.getNextBestAction();
    expect(action.source).toBe('weather');
    expect(action.urgency).toBe('high');
  });

  it('mild weather + no scan -> recommendation falls to fallback/routine', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('weather.updated', {
      condition: 'cloudy', temp: 22,
    });
    const action = ce.getNextBestAction();
    expect(['fallback', 'routine', 'crop_stage']).toContain(action.source);
  });
});

// ─── Loop 5: farm health tone shifts with overdue stack ─────

describe('Loop 5 — farm health tone (Stable / Watch / Needs attention)', () => {
  it('clean memory → STABLE', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    expect(ce.getFarmHealthState().tone).toBe('STABLE');
  });

  it('two overdue follow-ups → NEEDS_ATTENTION', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('task.overdue', { taskId: 'a', dueAt: Date.now() - 1000 });
    ce.recordEvent('task.overdue', { taskId: 'b', dueAt: Date.now() - 2000 });
    expect(ce.getFarmHealthState().tone).toBe('NEEDS_ATTENTION');
  });

  it('one non-healthy scan with future follow-up → WATCH', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('scan.completed', {
      scanId:     'sw',
      category:   'yellowing',
      followUpAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    expect(ce.getFarmHealthState().tone).toBe('WATCH');
  });
});

// ─── Loop 6: no duplicate event loops ───────────────────────

describe('Loop 6 — bus is re-entrancy safe (no infinite loops)', () => {
  it('a publish from inside a handler does not loop forever', async () => {
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    let firings = 0;
    bus.subscribe(bus.FarmEvents.WEATHER_UPDATED, (p, meta) => {
      firings += 1;
      // Republish inside the handler — bus must cap re-entrancy.
      if (firings < 100) {
        bus.publish(bus.FarmEvents.WEATHER_UPDATED, p);
      }
    });
    bus.publish(bus.FarmEvents.WEATHER_UPDATED, { condition: 'rain' });
    // Re-entrancy cap (16) means we should NOT see 100 firings.
    expect(firings).toBeLessThanOrEqual(16);
  });

  it('typed bus event names are de-duplicated for aliases', async () => {
    const bus = await import('../../../src/lib/farmEventBus.js');
    expect(bus.FarmEvents.WEATHER_CHANGED).toBe(bus.FarmEvents.WEATHER_UPDATED);
    expect(bus.FarmEvents.TASK_MISSED).toBe(bus.FarmEvents.TASK_OVERDUE);
  });
});

// ─── Loop 7: end-to-end "living system" sequence ────────────

describe('Loop 7 — end-to-end: farm + scan + task → Home recommendation updates', () => {
  it('the recommendation reflects the LATEST state at each step', async () => {
    const me = await import('../../../src/store/multiExperience.js');
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();

    // 1) Create a farm — Home should show fallback before any scan.
    me.addFarm({
      name: 'E2E Farm', crop: 'tomato', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    const beforeScan = ce.getNextBestAction();
    expect(['fallback', 'routine', 'crop_stage']).toContain(beforeScan.source);

    // 2) Scan flags a problem — now Home flips to scan_followup.
    ce.recordEvent('scan.completed', {
      scanId:     'e2e_scan',
      category:   'pest_damage',
      confidence: 'likely',
      followUpAt: Date.now() - 1000,
    });
    const afterScan = ce.getNextBestAction();
    expect(afterScan.source).toBe('scan_followup');

    // 3) Severe weather arrives — by spec the scan_followup still
    //    wins (rung 1 > rung 2). The weather event is recorded.
    ce.recordEvent('weather.updated', { condition: 'severe storm', temp: 22 });
    const afterWeather = ce.getNextBestAction();
    expect(afterWeather.source).toBe('scan_followup');

    // 4) The scan follow-up rolls off (simulate: clear the
    //    lastScan + follow-ups). Now severe weather wins rung 2.
    ce._resetContinuityMemory();
    ce.recordEvent('weather.updated', { condition: 'severe storm', temp: 22 });
    const weatherWins = ce.getNextBestAction();
    expect(weatherWins.source).toBe('weather');

    // 5) Task completion is journaled.
    ce.recordEvent('task.completed', {
      taskId: 'e2e_task', title: 'Cover crops before storm',
    });
    const memory = ce.getRecentMemory();
    expect(memory.lastTask.taskId).toBe('e2e_task');
    expect(memory.recentEvents.some((e) => e.type === 'task.completed')).toBe(true);
  });
});

// ─── Loop 8: low-literacy output ────────────────────────────

describe('Loop 8 — every recommendation envelope is low-literacy + frozen', () => {
  it('every action surfaced has the spec envelope shape', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    const action = ce.getNextBestAction();
    expect(action).toHaveProperty('title');
    expect(action).toHaveProperty('reason');
    expect(action).toHaveProperty('urgency');
    expect(action).toHaveProperty('bestTime');
    expect(action).toHaveProperty('confidenceTone');
    expect(action).toHaveProperty('cta');
    expect(action).toHaveProperty('source');
    expect(Object.isFrozen(action)).toBe(true);
  });

  it('no raw scores / certainty leaks into the action copy', async () => {
    const ce = await import('../../../src/core/continuityEngine/index.js');
    ce._resetContinuityMemory();
    ce.recordEvent('scan.completed', {
      scanId: 'leak_test',
      category: 'pest_damage',
      confidence: 'likely',
      followUpAt: Date.now() - 1000,
      score: 0.94,
      rawProb: 0.87,
    });
    const blob = JSON.stringify(ce.getNextBestAction());
    expect(blob).not.toMatch(/0\.9\d/);
    expect(blob).not.toMatch(/score|rawProb/);
    expect(blob.toLowerCase()).not.toMatch(/certified|guaranteed|definite/);
  });
});
