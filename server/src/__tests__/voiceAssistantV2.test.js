/**
 * voiceAssistantV2.test.js — Context-Aware Voice Assistant V2.
 *
 * Coverage:
 *   1. responseEngine.answerCommand — every intent in the
 *      10-command spec routes correctly + emits a frozen envelope
 *   2. Action safety — destructive actions require confirmation
 *   3. Watering logic — hedges by weather + farm type, never claims
 *      exact moisture
 *   4. Forbidden / unsupported commands fall through to a calm reply
 *   5. service.createVoiceAssistant — state machine + speakAnswer
 *      no-op when speechSynthesis is missing + cancel idempotent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  answerCommand,
  VOICE_COMMANDS,
  VOICE_ACTIONS,
} from '../../../src/services/voiceAssistantResponseEngine.js';
import {
  createVoiceAssistant,
  ASSISTANT_PHASES,
} from '../../../src/services/voiceAssistantV2.js';

const BASE_CTX = Object.freeze({
  farmContext: {
    farm:        { id: 'f1', name: 'Maryland Farm' },
    crop:        'tomato',
    farmType:    'small_farm',
    backyardType: null,
  },
  weather:     { condition: 'cloudy', temp: 22, rainChance: 30 },
  tasks:       [
    { id: 't1', title: 'Water tomato beds', status: 'pending', why: 'Soil is dry.' },
    { id: 't2', title: 'Check for aphids',  status: 'pending' },
  ],
  lastScan:    {
    scanId:       'scan_1',
    possibleIssue: 'Possible leaf yellowing',
    confidence:    'medium',
    category:      'yellowing',
    recommendedActions: ['Inspect lower leaves in good light.'],
  },
  recommendation: {
    title:   'Recheck your last scan',
    reason:  'Yellowing was flagged yesterday — see if it spread.',
    urgency: 'high',
    cta:     'Open scan',
  },
  language: 'en',
});

// ─── Envelope shape ─────────────────────────────────────────

describe('answerCommand — envelope shape + safety', () => {
  it('returns a frozen envelope with all required fields', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'what should i do today' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(out).toHaveProperty('intent');
    expect(out).toHaveProperty('spokenText');
    expect(out).toHaveProperty('displayText');
    expect(out).toHaveProperty('actionType');
    expect(out).toHaveProperty('actionPayload');
    expect(out).toHaveProperty('requiresConfirmation');
    expect(out).toHaveProperty('confidenceTone');
  });

  it('never throws on null / malformed input', () => {
    expect(() => answerCommand(null)).not.toThrow();
    expect(() => answerCommand({})).not.toThrow();
    expect(() => answerCommand({ command: 42 })).not.toThrow();
    expect(answerCommand(null).intent).toBe(VOICE_COMMANDS.UNSUPPORTED);
  });

  it('confidence tone is limited-data on unsupported, likely otherwise', () => {
    expect(answerCommand({ command: 'unknown bla' }).confidenceTone).toBe('limited-data');
    expect(answerCommand({ ...BASE_CTX, command: 'what should i do today' }).confidenceTone).toBe('likely');
  });
});

// ─── Intent routing ─────────────────────────────────────────

describe('answerCommand — 10 spec commands route correctly', () => {
  it.each([
    ['what should i do today',     VOICE_COMMANDS.WHAT_TO_DO_TODAY],
    ['read my task',               VOICE_COMMANDS.READ_MY_TASK],
    ['what is my next task',       VOICE_COMMANDS.NEXT_TASK],
    ['what needs attention',       VOICE_COMMANDS.NEEDS_ATTENTION],
    ['should i water today',       VOICE_COMMANDS.SHOULD_WATER],
    ['read my scan result',        VOICE_COMMANDS.READ_SCAN_RESULT],
    ['what did my last scan say',  VOICE_COMMANDS.LAST_SCAN_SAID],
    ['weather advice',             VOICE_COMMANDS.WEATHER_ADVICE],
    ['save this scan',             VOICE_COMMANDS.SAVE_THIS_SCAN],
    ['add this to tasks',          VOICE_COMMANDS.ADD_TO_TASKS],
  ])('"%s" → %s', (command, expectedIntent) => {
    const out = answerCommand({ ...BASE_CTX, command });
    expect(out.intent).toBe(expectedIntent);
  });

  it('disambiguates "next task" from "today" via longest-match', () => {
    const next = answerCommand({ ...BASE_CTX, command: 'what is my next task' });
    expect(next.intent).toBe(VOICE_COMMANDS.NEXT_TASK);
    const today = answerCommand({ ...BASE_CTX, command: 'what should i do today' });
    expect(today.intent).toBe(VOICE_COMMANDS.WHAT_TO_DO_TODAY);
  });

  it('unsupported command emits the calm fallback copy', () => {
    const out = answerCommand({ command: 'how do i build a rocket' });
    expect(out.intent).toBe(VOICE_COMMANDS.UNSUPPORTED);
    expect(out.spokenText.toLowerCase()).toContain('i can help with');
    expect(out.spokenText.toLowerCase()).toContain('farm');
  });
});

// ─── Action safety ──────────────────────────────────────────

describe('answerCommand — action safety', () => {
  it('READ-only intents never require confirmation', () => {
    const reads = [
      'what should i do today',
      'read my task',
      'read my scan result',
      'weather advice',
      'should i water today',
    ];
    for (const c of reads) {
      const out = answerCommand({ ...BASE_CTX, command: c });
      expect(out.requiresConfirmation).toBe(false);
    }
  });

  it('"save this scan" requires confirmation + emits SAVE_CURRENT_SCAN', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'save this scan' });
    expect(out.actionType).toBe(VOICE_ACTIONS.SAVE_CURRENT_SCAN);
    expect(out.requiresConfirmation).toBe(true);
    expect(out.spokenText.toLowerCase()).toContain('do you want');
    expect(out.actionPayload.scanId).toBe('scan_1');
  });

  it('"add this to tasks" requires confirmation + emits CREATE_TASK_FROM_SCAN', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'add this to tasks' });
    expect(out.actionType).toBe(VOICE_ACTIONS.CREATE_TASK_FROM_SCAN);
    expect(out.requiresConfirmation).toBe(true);
  });

  it('no command maps to delete / sell / submit / send / chemical / prescribe', () => {
    const forbidden = [
      'delete my farm',
      'sell my produce',
      'apply chemicals',
      'submit funding',
      'send a message to the buyer',
      'change my settings',
    ];
    for (const c of forbidden) {
      const out = answerCommand({ ...BASE_CTX, command: c });
      expect(out.intent).toBe(VOICE_COMMANDS.UNSUPPORTED);
      expect(out.actionType).toBeNull();
    }
  });

  it('save_this_scan with NO lastScan navigates to /scan instead of acting', () => {
    const out = answerCommand({ ...BASE_CTX, lastScan: null, command: 'save this scan' });
    expect(out.actionType).toBe(VOICE_ACTIONS.NAVIGATE);
    expect(out.actionPayload.path).toBe('/scan');
    expect(out.requiresConfirmation).toBe(false);
  });
});

// ─── Watering logic ─────────────────────────────────────────

describe('answerCommand — watering logic (spec §9)', () => {
  it('hedges with "feels dry" — never claims exact soil moisture', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'should i water today' });
    expect(out.spokenText.toLowerCase()).toContain('feels dry');
    // Never invents a specific number.
    expect(out.spokenText).not.toMatch(/\d{2}%/);
  });

  it('high rain chance → "hold off watering"', () => {
    const out = answerCommand({
      ...BASE_CTX,
      weather: { condition: 'rain', temp: 18, rainChance: 80 },
      command: 'should i water today',
    });
    expect(out.spokenText.toLowerCase()).toContain('hold off');
  });

  it('hot day (≥32°C) → "water early or late, not midday"', () => {
    const out = answerCommand({
      ...BASE_CTX,
      weather: { condition: 'sunny', temp: 34, rainChance: 5 },
      command: 'should i water today',
    });
    expect(out.spokenText.toLowerCase()).toMatch(/early|late/);
  });

  it('backyard / pots farm type → "soil dries faster" copy', () => {
    const out = answerCommand({
      ...BASE_CTX,
      farmContext: { ...BASE_CTX.farmContext, farmType: 'backyard', backyardType: 'pots' },
      weather: { condition: 'mild', temp: 22, rainChance: 10 },
      command: 'should i water today',
    });
    expect(out.spokenText.toLowerCase()).toContain('dries faster');
  });

  it('default path mentions the crop name + "soil first"', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'should i water today' });
    expect(out.spokenText.toLowerCase()).toContain('tomato');
    expect(out.spokenText.toLowerCase()).toContain('soil first');
  });
});

// ─── Context-missing fallbacks ──────────────────────────────

describe('answerCommand — graceful missing-context fallbacks', () => {
  it('no farm → "add your farm first" navigation prompt', () => {
    const out = answerCommand({
      command: 'what should i do today',
      // no farmContext at all
    });
    expect(out.actionType).toBe(VOICE_ACTIONS.NAVIGATE);
    expect(out.actionPayload.path).toBe('/my-farm');
    expect(out.spokenText.toLowerCase()).toContain('add your farm');
  });

  it('no tasks → "no open tasks" calm reply', () => {
    const out = answerCommand({
      ...BASE_CTX,
      tasks: [],
      command: 'read my task',
    });
    expect(out.spokenText.toLowerCase()).toContain('no open tasks');
    expect(out.actionType).toBe(VOICE_ACTIONS.READ);
  });

  it('no last scan → "tap Scan to take a photo" + nav payload', () => {
    const out = answerCommand({
      ...BASE_CTX,
      lastScan: null,
      command: 'read my scan result',
    });
    expect(out.spokenText.toLowerCase()).toContain('no scan yet');
    expect(out.actionType).toBe(VOICE_ACTIONS.NAVIGATE);
    expect(out.actionPayload.path).toBe('/scan');
  });

  it('no weather → calm "do not have weather yet" copy', () => {
    const out = answerCommand({
      ...BASE_CTX,
      weather: null,
      command: 'weather advice',
    });
    expect(out.spokenText.toLowerCase()).toContain('do not have weather yet');
  });
});

// ─── Per-intent composition spot-checks ─────────────────────

describe('answerCommand — per-intent composition', () => {
  it('NEEDS_ATTENTION surfaces high-urgency recommendation', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'what needs attention' });
    expect(out.spokenText.toLowerCase()).toContain('recheck your last scan');
  });

  it('NEXT_TASK surfaces the SECOND pending task', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'what is my next task' });
    expect(out.spokenText.toLowerCase()).toContain('check for aphids');
  });

  it('READ_SCAN_RESULT includes the recommended action line', () => {
    const out = answerCommand({ ...BASE_CTX, command: 'read my scan result' });
    expect(out.spokenText.toLowerCase()).toContain('inspect lower leaves');
  });
});

// ─── Service orchestrator ───────────────────────────────────

describe('createVoiceAssistant — state machine', () => {
  beforeEach(() => {
    // Strip any window so isSupported / speakAnswer take the
    // unsupported branch by default — individual tests stub
    // back what they need.
    delete globalThis.window;
  });

  it('isSupported returns false when SpeechRecognition is absent', () => {
    const a = createVoiceAssistant();
    expect(a.isSupported()).toBe(false);
  });

  it('isSupported returns true when window.SpeechRecognition exists', () => {
    globalThis.window = {
      SpeechRecognition: function () {},
      speechSynthesis:   { speak: () => {}, cancel: () => {} },
      SpeechSynthesisUtterance: function () {},
    };
    const a = createVoiceAssistant();
    expect(a.isSupported()).toBe(true);
  });

  it('startListening rejects when recognition is unsupported', async () => {
    const a = createVoiceAssistant();
    await expect(a.startListening()).rejects.toThrow('unsupported');
    expect(a.getState().phase).toBe(ASSISTANT_PHASES.ERROR);
  });

  it('answerCommand pure-passes through the response engine', () => {
    const a = createVoiceAssistant();
    const out = a.answerCommand({ ...BASE_CTX, command: 'read my task' });
    expect(out.intent).toBe(VOICE_COMMANDS.READ_MY_TASK);
  });

  it('speakAnswer is no-op when speechSynthesis is missing', () => {
    const a = createVoiceAssistant();
    expect(a.speakAnswer('hello')).toBe(false);
  });

  it('speakAnswer flips state to SPEAKING when synth is available', () => {
    let speakCalled = false;
    globalThis.window = {
      speechSynthesis: {
        speak:  () => { speakCalled = true; },
        cancel: () => {},
      },
      SpeechSynthesisUtterance: function (t) { this.text = t; },
    };
    const a = createVoiceAssistant();
    const ok = a.speakAnswer('hello world');
    expect(ok).toBe(true);
    expect(speakCalled).toBe(true);
    expect(a.getState().phase).toBe(ASSISTANT_PHASES.SPEAKING);
  });

  it('cancel idempotent + leaves state in IDLE', () => {
    const a = createVoiceAssistant();
    expect(() => a.cancel()).not.toThrow();
    expect(() => a.cancel()).not.toThrow();
    expect(a.getState().phase).toBe(ASSISTANT_PHASES.IDLE);
  });

  it('setLanguage accepts a BCP-47 tag', () => {
    const a = createVoiceAssistant({ language: 'en-US' });
    expect(() => a.setLanguage('tw-GH')).not.toThrow();
  });

  it('onStateChange callback fires on state transitions', () => {
    const seen = [];
    const a = createVoiceAssistant({ onStateChange: (s) => seen.push(s.phase) });
    a.cancel(); // stays IDLE — no transition
    globalThis.window = {
      speechSynthesis:        { speak: () => {}, cancel: () => {} },
      SpeechSynthesisUtterance: function () {},
    };
    a.speakAnswer('hi');
    expect(seen).toContain(ASSISTANT_PHASES.SPEAKING);
  });
});
