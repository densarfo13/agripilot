/**
 * jarvisMvp.test.js — Jarvis MVP honest-kernel tests (feature/farroway-jarvis-mvp).
 *
 * Covers the 12 spec cases: routing, context answer, consent gate, clarification,
 * offline text-fallback, no fake approvals/prices, no internal terms, history delete,
 * telemetry emission. Pure-module tests (node env) — the UI is exercised separately
 * by the SSR render harness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');

// Literal dynamic imports (Vite cannot resolve computed specifiers).
const MODULES = {
  'domains/jarvis/intentClassifier.js': () => import('../../../src/domains/jarvis/intentClassifier.js'),
  'domains/jarvis/commandRouter.js': () => import('../../../src/domains/jarvis/commandRouter.js'),
  'domains/jarvis/farmBrainResponder.js': () => import('../../../src/domains/jarvis/farmBrainResponder.js'),
  'domains/jarvis/intents.js': () => import('../../../src/domains/jarvis/intents.js'),
  'domains/jarvis/commandHistory.js': () => import('../../../src/domains/jarvis/commandHistory.js'),
  'domains/jarvis/jarvisTelemetry.js': () => import('../../../src/domains/jarvis/jarvisTelemetry.js'),
  'domains/jarvis/jarvisFlags.js': () => import('../../../src/domains/jarvis/jarvisFlags.js'),
  'domains/voice/voiceInput.js': () => import('../../../src/domains/voice/voiceInput.js'),
};
const load = (p) => MODULES[p]();

describe('Jarvis MVP — honest kernel', () => {
  beforeEach(() => { vi.resetModules(); });

  it('"Scan my plant" routes to Scan', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { route } = await load('domains/jarvis/commandRouter.js');
    const c = classify('Scan my plant');
    expect(c.intent).toBe('SCAN_PLANT');
    const r = route(c.intent);
    expect(r.type).toBe('navigate');
    expect(r.path).toBe('/scan?mode=camera');
  });

  it('"What should I do today?" returns the plan + the real first task when the kernel knows it', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const c = classify('What should I do today?');
    expect(c.intent).toBe('TODAY_TASKS');
    const res = respond(c.intent, { todayTaskTitle: 'Water the maize' });
    expect(res.action.path).toBe('/tasks');
    expect(res.contextLine && res.contextLine.value).toBe('Water the maize');
    // Without kernel context: no invented task line.
    const bare = respond(c.intent, {});
    expect(bare.contextLine).toBeNull();
  });

  it('weather command returns weather advice routing', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const c = classify('When should I water?');
    expect(c.intent).toBe('WEATHER_ADVICE');
    const res = respond(c.intent, {});
    expect(res.answerKey).toBe('jarvis.answer.weather');
    expect(res.action.path).toBe('/home');
  });

  it('funding command opens Funding without a consent wall', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const c = classify('Find funding');
    expect(c.intent).toBe('FUNDING_SEARCH');
    const res = respond(c.intent, {});
    expect(res.needsConsent).toBe(false);
    expect(res.action.path).toBe('/funding');
  });

  it('insurance command requires consent', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const c = classify('I want crop insurance');
    expect(c.intent).toBe('INSURANCE_SEARCH');
    const res = respond(c.intent, {});
    expect(res.needsConsent).toBe(true);
    expect(res.answerKey).toBe('jarvis.answer.consentNeeded');
  });

  it('unknown input asks a clarifying question instead of guessing', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const c = classify('xyzzy blorp');
    expect(c.intent).toBe('UNKNOWN');
    const res = respond(c.intent, {});
    expect(res.clarify).toBe(true);
    expect(res.action).toBeNull();
  });

  it('offline / unsupported voice falls back to text (voiceAvailable=false, adapter safe)', async () => {
    const { voiceAvailable, startListening } = await load('domains/voice/voiceInput.js');
    // node env: no window.SpeechRecognition → text is the path.
    expect(voiceAvailable()).toBe(false);
    const errors = [];
    const stop = startListening({ onError: (e) => errors.push(e) });
    expect(stop).toBeNull();
    expect(errors).toEqual(['unsupported']);
  });

  it('no fake approvals and no fake prices in any answer', async () => {
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const { INTENTS } = await load('domains/jarvis/intents.js');
    for (const intent of INTENTS) {
      const res = respond(intent, {});
      const text = String(res.answerFallback);
      expect(text).not.toMatch(/you are approved|approved!|guaranteed/i);
      expect(text).not.toMatch(/\d+\s*(ghs|usd|kes|ngn|₵|\$|₦)/i);   // never a price
      expect(text).not.toMatch(/per\s*(kg|bag|crate)/i);
    }
  });

  it('no internal/AI/provider terms visible in any farmer-facing Jarvis string', async () => {
    const banned = /\b(api|provider|backend|llm|gpt|token|endpoint|classifier)\b/i;
    // Responder + router fallbacks:
    const { respond } = await load('domains/jarvis/farmBrainResponder.js');
    const { INTENTS } = await load('domains/jarvis/intents.js');
    for (const intent of INTENTS) {
      const res = respond(intent, {});
      expect(String(res.answerFallback)).not.toMatch(banned);
      if (res.action) expect(String(res.action.labelFallback)).not.toMatch(banned);
    }
    // Registered English column values:
    const ten = readFileSync(join(ROOT, 'src/i18n/columns/T-en.js'), 'utf8');
    const jarvisLines = ten.split('\n').filter((l) => l.includes('"jarvis.'));
    expect(jarvisLines.length).toBeGreaterThan(40);
    for (const line of jarvisLines) {
      const value = line.split(':').slice(1).join(':');
      expect(value).not.toMatch(banned);
    }
  });

  it('command history: add, list (newest first), delete works without localStorage', async () => {
    const { addCommand, listCommands, clearCommands } = await load('domains/jarvis/commandHistory.js');
    clearCommands();
    addCommand('scan my plant', 'SCAN_PLANT');
    addCommand('find funding', 'FUNDING_SEARCH');
    const list = listCommands();
    expect(list.length).toBe(2);
    expect(list[0].text).toBe('find funding'); // newest first
    clearCommands();
    expect(listCommands()).toEqual([]);
  });

  it('telemetry: canonical events emit via the shared sink; transcripts never ship', async () => {
    vi.doMock('../../../src/lib/analytics.js', () => ({ safeTrackEvent: vi.fn() }));
    const { trackJarvis } = await load('domains/jarvis/jarvisTelemetry.js');
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    trackJarvis('command_classified', { intent: 'SCAN_PLANT', text: 'SECRET UTTERANCE' });
    expect(safeTrackEvent).toHaveBeenCalledTimes(1);
    const [event, meta] = safeTrackEvent.mock.calls[0];
    expect(event).toBe('command_classified');
    expect(meta.intent).toBe('SCAN_PLANT');
    expect(meta.text).toBeUndefined();               // transcript stripped
    trackJarvis('not_a_real_event', {});             // unknown names dropped
    expect(safeTrackEvent).toHaveBeenCalledTimes(1);
    vi.doUnmock('../../../src/lib/analytics.js');
  });

  it('flag defaults OFF (Jarvis renders nothing in production until enabled per device)', async () => {
    const { isJarvisEnabled } = await load('domains/jarvis/jarvisFlags.js');
    expect(isJarvisEnabled()).toBe(false); // node env / fresh device
  });

  it('multilingual commands classify (sw/ha/tw/hi/fr samples)', async () => {
    const { classify } = await load('domains/jarvis/intentClassifier.js');
    expect(classify('nifanye nini leo').intent).toBe('TODAY_TASKS');      // sw
    expect(classify('me zan yi yau').intent).toBe('TODAY_TASKS');         // ha
    expect(classify('ɛnnɛ menyɛ deɛn').intent).toBe('TODAY_TASKS');       // tw
    expect(classify('मौसम कैसा है').intent).toBe('WEATHER_ADVICE');        // hi
    expect(classify('je veux vendre').intent).toBe('MARKETPLACE_SELL');   // fr
  });
});
