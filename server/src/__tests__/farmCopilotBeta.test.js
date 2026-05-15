/**
 * farmCopilotBeta.test.js — Conversational Farm Copilot Beta.
 *
 * The copilot is a flag-gated Beta. These tests prove:
 *   - it is OFF by default (the app is unchanged for every farmer)
 *   - the engine answers from Farroway context, never throws
 *   - the safety layer scrubs the four banned claim classes
 *   - the launcher is hard-gated on the feature flag
 *   - it is mounted in the farmer shell but renders nothing dark
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. Feature flag — OFF by default ──────────────────────

describe('FEATURE_FARM_COPILOT_BETA — disabled by default', () => {
  it('the flag default is false in featureFlags.js', async () => {
    const src = read('src/utils/featureFlags.js');
    expect(src).toMatch(/FEATURE_FARM_COPILOT_BETA:\s*false/);
  });

  it('isFeatureEnabled returns false with no override', async () => {
    const mod = await import('../../../src/utils/featureFlags.js');
    expect(mod.isFeatureEnabled('FEATURE_FARM_COPILOT_BETA')).toBe(false);
  });
});

// ─── 2. copilotSafety — the four banned claim classes ──────

describe('copilotSafety — output safety layer', () => {
  it('flags guaranteed-yield / financial-promise claims', async () => {
    const { containsUnsafeClaim } = await import('../../../src/copilot/copilotSafety.js');
    expect(containsUnsafeClaim('We guarantee a bigger harvest')).toBe(true);
    expect(containsUnsafeClaim('you will earn more money')).toBe(true);
    expect(containsUnsafeClaim('Check your pepper leaves today')).toBe(false);
  });

  it('redacts absolute / medical certainty', async () => {
    const { redactUnsafeClaims } = await import('../../../src/copilot/copilotSafety.js');
    expect(redactUnsafeClaims('This is definitely blight')).not.toMatch(/definitely/i);
    expect(redactUnsafeClaims('I am 100% sure')).not.toMatch(/100%/);
  });

  it('softens unsafe chemical certainty', async () => {
    const { redactUnsafeClaims } = await import('../../../src/copilot/copilotSafety.js');
    const out = redactUnsafeClaims('Just spray it and it will cure the disease');
    expect(out).not.toMatch(/just spray/i);
  });

  it('makeSafe appends the low-confidence note only when limited', async () => {
    const { makeSafe, LOW_CONFIDENCE_NOTE } = await import('../../../src/copilot/copilotSafety.js');
    expect(makeSafe('Check your crop', { confidence: 'limited' })).toContain(LOW_CONFIDENCE_NOTE);
    expect(makeSafe('Check your crop', { confidence: 'likely' })).not.toContain(LOW_CONFIDENCE_NOTE);
  });

  it('makeSafe never returns an empty answer', async () => {
    const { makeSafe, LOW_CONFIDENCE_NOTE } = await import('../../../src/copilot/copilotSafety.js');
    expect(makeSafe('', {})).toBe(LOW_CONFIDENCE_NOTE);
    expect(makeSafe(null, {})).toBe(LOW_CONFIDENCE_NOTE);
  });

  it('assessConfidence maps the engine confidenceTone', async () => {
    const { assessConfidence } = await import('../../../src/copilot/copilotSafety.js');
    expect(assessConfidence({ confidenceTone: 'likely' })).toBe('likely');
    expect(assessConfidence({ confidenceTone: 'limited-data' })).toBe('limited');
    expect(assessConfidence(null)).toBe('limited');
  });
});

// ─── 3. copilotEngine — answers from context, never throws ──

describe('copilotEngine — askCopilot', () => {
  it('exposes 6 suggested prompts', async () => {
    const { SUGGESTED_PROMPTS } = await import('../../../src/copilot/copilotEngine.js');
    expect(Array.isArray(SUGGESTED_PROMPTS)).toBe(true);
    expect(SUGGESTED_PROMPTS.length).toBe(6);
    SUGGESTED_PROMPTS.forEach((p) => expect(typeof p).toBe('string'));
  });

  it('returns the documented frozen reply shape', async () => {
    const { askCopilot } = await import('../../../src/copilot/copilotEngine.js');
    const r = askCopilot('What should I do today?');
    expect(Object.isFrozen(r)).toBe(true);
    expect(typeof r.answer).toBe('string');
    expect(r.answer.length).toBeGreaterThan(0);
    expect(typeof r.intent).toBe('string');
    expect(['likely', 'limited']).toContain(r.confidence);
    expect(typeof r.requiresConfirmation).toBe('boolean');
    expect(['online', 'offline']).toContain(r.connectivity);
  });

  it('handles an empty question without an engine call', async () => {
    const { askCopilot } = await import('../../../src/copilot/copilotEngine.js');
    expect(askCopilot('').intent).toBe('empty');
    expect(askCopilot('   ').intent).toBe('empty');
  });

  it('never throws on garbage input', async () => {
    const { askCopilot } = await import('../../../src/copilot/copilotEngine.js');
    expect(() => askCopilot(42)).not.toThrow();
    expect(() => askCopilot(null)).not.toThrow();
    expect(() => askCopilot({})).not.toThrow();
  });

  it('buildCopilotContext returns a usable context (offline-safe)', async () => {
    const { buildCopilotContext } = await import('../../../src/copilot/copilotEngine.js');
    const ctx = buildCopilotContext();
    expect(ctx).toBeTruthy();
    expect(ctx.farmContext).toBeTruthy();
    expect(Array.isArray(ctx.tasks)).toBe(true);
    expect(typeof ctx.language).toBe('string');
  });
});

// ─── 4. unifiedIntelligence exposes scanTasks for the copilot ─

describe('unifiedIntelligence — scanTasks surfaced for the copilot', () => {
  it('the intelligence block carries a scanTasks array', async () => {
    const { getUnifiedIntelligence } = await import('../../../src/core/intelligence/unifiedIntelligence.js');
    expect(Array.isArray(getUnifiedIntelligence().intelligence.scanTasks)).toBe(true);
  });
});

// ─── 5. Launcher + shell wiring ────────────────────────────

describe('FarmCopilotLauncher — hard flag gate', () => {
  const src = read('src/components/copilot/FarmCopilotLauncher.jsx');

  it('returns null unless FEATURE_FARM_COPILOT_BETA is enabled', () => {
    expect(src).toMatch(/isFeatureEnabled\('FEATURE_FARM_COPILOT_BETA'\)/);
    expect(src).toMatch(/return null/);
  });

  it('lazy-loads the sheet so Beta code is not parsed when off', () => {
    expect(src).toMatch(/React\.lazy\(\(\)\s*=>\s*import\('\.\/FarmCopilotSheet\.jsx'\)\)/);
  });
});

describe('ProtectedLayout — mounts the copilot launcher (dark by default)', () => {
  const src = read('src/layouts/ProtectedLayout.jsx');

  it('imports + renders FarmCopilotLauncher', () => {
    expect(src).toMatch(/import FarmCopilotLauncher from '\.\.\/components\/copilot\/FarmCopilotLauncher\.jsx'/);
    expect(src).toMatch(/<FarmCopilotLauncher \/>/);
  });

  it('gates the mount to farmer surfaces, off onboarding', () => {
    const idx = src.indexOf('<FarmCopilotLauncher />');
    const block = src.slice(Math.max(0, idx - 240), idx);
    expect(block).toMatch(/!onboarding/);
    expect(block).toMatch(/isFarmer|'farmer'/);
  });
});

// ─── 6. copilotMemory — cross-session persisted memory ─────

describe('copilotMemory — persisted, capped, never throws', () => {
  const hadLS = 'localStorage' in globalThis;
  const savedLS = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });
  afterEach(() => {
    if (hadLS) globalThis.localStorage = savedLS;
    else delete globalThis.localStorage;
  });

  it('readCopilotMemory returns the { turns, recs } shape', async () => {
    const { readCopilotMemory } = await import('../../../src/copilot/copilotMemory.js');
    const m = readCopilotMemory();
    expect(Array.isArray(m.turns)).toBe(true);
    expect(Array.isArray(m.recs)).toBe(true);
  });

  it('recordTurn persists turns and caps at MAX_TURNS', async () => {
    const { recordTurn, readCopilotMemory, COPILOT_MEMORY_LIMITS } =
      await import('../../../src/copilot/copilotMemory.js');
    for (let i = 0; i < COPILOT_MEMORY_LIMITS.MAX_TURNS + 8; i += 1) {
      recordTurn({ question: 'q' + i, answer: 'a' + i, intent: 'should_water_today' });
    }
    const turns = readCopilotMemory().turns;
    expect(turns.length).toBe(COPILOT_MEMORY_LIMITS.MAX_TURNS);
    // The oldest turns were dropped — newest survive.
    expect(turns[turns.length - 1].question).toBe('q' + (COPILOT_MEMORY_LIMITS.MAX_TURNS + 7));
  });

  it('recordRecommendation tracks accepted vs ignored', async () => {
    const { recordRecommendation, summariseMemory } =
      await import('../../../src/copilot/copilotMemory.js');
    recordRecommendation({ intent: 'add_to_tasks', accepted: true });
    recordRecommendation({ intent: 'add_to_tasks', accepted: false });
    recordRecommendation({ intent: 'add_to_tasks', accepted: true });
    const s = summariseMemory();
    expect(s.acceptedCount).toBe(2);
    expect(s.ignoredCount).toBe(1);
  });

  it('summariseMemory surfaces repeated intents', async () => {
    const { recordTurn, summariseMemory } =
      await import('../../../src/copilot/copilotMemory.js');
    recordTurn({ question: 'a', answer: 'x', intent: 'should_water_today' });
    recordTurn({ question: 'b', answer: 'y', intent: 'should_water_today' });
    recordTurn({ question: 'c', answer: 'z', intent: 'read_my_task' });
    expect(summariseMemory().repeatedIntents).toContain('should_water_today');
  });

  it('clearCopilotMemory wipes everything', async () => {
    const { recordTurn, clearCopilotMemory, readCopilotMemory } =
      await import('../../../src/copilot/copilotMemory.js');
    recordTurn({ question: 'q', answer: 'a', intent: 'x' });
    clearCopilotMemory();
    expect(readCopilotMemory().turns).toEqual([]);
  });

  it('never throws when localStorage is unavailable', async () => {
    const { recordTurn, readCopilotMemory, summariseMemory } =
      await import('../../../src/copilot/copilotMemory.js');
    delete globalThis.localStorage;
    expect(() => recordTurn({ question: 'q', answer: 'a' })).not.toThrow();
    expect(() => readCopilotMemory()).not.toThrow();
    expect(() => summariseMemory()).not.toThrow();
  });
});

// ─── 7. Sheet — memory restore + real navigation wiring ────

describe('FarmCopilotSheet — memory + safe navigation', () => {
  const src = read('src/components/copilot/FarmCopilotSheet.jsx');

  it('restores the prior conversation from copilotMemory on open', () => {
    expect(src).toMatch(/import \{[\s\S]*readCopilotMemory[\s\S]*\} from '\.\.\/\.\.\/copilot\/copilotMemory\.js'/);
    expect(src).toMatch(/readCopilotMemory\(\)/);
  });

  it('persists each turn via recordTurn', () => {
    expect(src).toMatch(/recordTurn\(\{\s*question/);
  });

  it('records accept/ignore via recordRecommendation', () => {
    expect(src).toMatch(/recordRecommendation\(\{ intent, accepted \}\)/);
  });

  it('wires a real in-app navigation for NAVIGATE actions', () => {
    expect(src).toMatch(/import \{ useNavigate \} from 'react-router-dom'/);
    expect(src).toMatch(/navigate\(path\)/);
    // navigation is non-destructive — offered as an "Open" button,
    // not gated behind the Yes/No confirmation.
    expect(src).toMatch(/data-testid="farm-copilot-open"/);
  });

  it('offers a Clear control to wipe persisted memory', () => {
    expect(src).toMatch(/clearCopilotMemory\(\)/);
  });
});
