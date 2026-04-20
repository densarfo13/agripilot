/**
 * localizationCore.test.js — contract for the shared
 * localization infrastructure under src/core/i18n.
 *
 * Covers:
 *   • LocalizedPayload validation + factory
 *   • renderLocalizedMessage resolution order
 *   • renderLocalizedList
 *   • speakLocalizedMessage with injected synth + graceful fallback
 *   • localeToVoiceTag BCP-47 mapping
 *   • assistiveMode (resolveAssistivePayload, simplifyText, layout)
 *   • §12 dev assertions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  isLocalizedPayload, validateLocalizedPayload,
  makeLocalizedPayload, isRenderedString,
} from '../../../src/core/i18n/localizedPayload.js';
import {
  renderLocalizedMessage, renderLocalizedList, looksLikeRawKey,
} from '../../../src/core/i18n/renderLocalizedMessage.js';
import {
  speakLocalizedMessage, cancelSpeak, localeToVoiceTag,
} from '../../../src/core/i18n/speakLocalizedMessage.js';
import {
  NORMAL, ASSISTIVE, isAssistiveMode,
  resolveAssistivePayload, simplifyText, assistiveLayout,
} from '../../../src/core/i18n/assistiveMode.js';
import {
  assertNotRawKey, assertEngineEmitsPayload,
  assertPayloadHasKey, assertNoEnglishLeakInLocale,
  assertCachedPayloadIsStructured,
} from '../../../src/core/i18n/localeDevAssertions.js';

// ─── LocalizedPayload shape ──────────────────────────────────
describe('isLocalizedPayload + validateLocalizedPayload', () => {
  it('accepts minimal { key }', () => {
    expect(isLocalizedPayload({ key: 'home.today_task' })).toBe(true);
  });
  it('accepts full payload', () => {
    const p = { key: 'x.y', params: { a: 1 }, severity: 'positive',
                confidence: 'high', mode: 'normal' };
    expect(isLocalizedPayload(p)).toBe(true);
    expect(validateLocalizedPayload(p).ok).toBe(true);
  });
  it('rejects missing key', () => {
    const v = validateLocalizedPayload({ params: {} });
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('missing_key');
  });
  it('rejects non-object params', () => {
    expect(isLocalizedPayload({ key: 'x', params: 'bad' })).toBe(false);
  });
  it('rejects invalid severity / confidence / mode', () => {
    expect(isLocalizedPayload({ key: 'x', severity: 'awesome' })).toBe(false);
    expect(isLocalizedPayload({ key: 'x', confidence: 'ultra' })).toBe(false);
    expect(isLocalizedPayload({ key: 'x', mode: 'weird' })).toBe(false);
  });
  it('rejects null / non-objects', () => {
    expect(isLocalizedPayload(null)).toBe(false);
    expect(isLocalizedPayload('string')).toBe(false);
    expect(isLocalizedPayload(42)).toBe(false);
  });
});

describe('makeLocalizedPayload', () => {
  it('produces a frozen payload', () => {
    const p = makeLocalizedPayload('x.y', { a: 1 }, { severity: 'positive' });
    expect(Object.isFrozen(p)).toBe(true);
    expect(p.key).toBe('x.y');
    expect(p.params.a).toBe(1);
    expect(p.severity).toBe('positive');
  });
  it('throws without key', () => {
    expect(() => makeLocalizedPayload('')).toThrow();
    expect(() => makeLocalizedPayload(null)).toThrow();
  });
});

describe('isRenderedString heuristic', () => {
  it('false for i18n keys', () => {
    expect(isRenderedString('home.today_task')).toBe(false);
    expect(isRenderedString('insight.good_week')).toBe(false);
  });
  it('true for actual English sentences', () => {
    expect(isRenderedString('Welcome to Farroway')).toBe(true);
    expect(isRenderedString('Good weather this week for planting')).toBe(true);
  });
  it('false for empty / non-string', () => {
    expect(isRenderedString('')).toBe(false);
    expect(isRenderedString(null)).toBe(false);
    expect(isRenderedString(123)).toBe(false);
  });
});

// ─── renderLocalizedMessage ──────────────────────────────────
describe('renderLocalizedMessage', () => {
  const dict = { 'home.welcome': 'Welcome, {{name}}' };
  const t = (key, params) => {
    const v = dict[key];
    if (typeof v !== 'string') return key;
    return v.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) => String(params?.[k] ?? ''));
  };

  it('resolves key via t() with params', () => {
    const out = renderLocalizedMessage({ key: 'home.welcome', params: { name: 'Ama' } }, t);
    expect(out).toBe('Welcome, Ama');
  });
  it('falls through to fallback when t() returns the key', () => {
    const out = renderLocalizedMessage(
      { key: 'unknown.key', fallback: 'Hi {{name}}', params: { name: 'X' } }, t);
    expect(out).toBe('Hi X');
  });
  it('returns the key when nothing resolves (ensures UI not blank)', () => {
    const out = renderLocalizedMessage({ key: 'unknown.key' }, t);
    expect(out).toBe('unknown.key');
  });
  it('returns an already-rendered string as-is (escape hatch)', () => {
    expect(renderLocalizedMessage('Already done', t)).toBe('Already done');
  });
  it('returns empty string on bogus payload without fallback', () => {
    expect(renderLocalizedMessage(null, t)).toBe('');
  });
  it('works without a t() function', () => {
    const out = renderLocalizedMessage(
      { key: 'x.y', fallback: 'Plain fallback' }, null);
    expect(out).toBe('Plain fallback');
  });
});

describe('renderLocalizedList', () => {
  it('renders each payload in order', () => {
    const t = (key) => key === 'a' ? 'Alpha' : key === 'b' ? 'Beta' : key;
    const out = renderLocalizedList([{ key: 'a' }, { key: 'b' }], t);
    expect(out).toEqual(['Alpha', 'Beta']);
  });
  it('empty for non-array input', () => {
    expect(renderLocalizedList(null, () => '')).toEqual([]);
  });
});

describe('looksLikeRawKey', () => {
  it('true for dotted identifier output', () => {
    expect(looksLikeRawKey('home.today_task')).toBe(true);
    expect(looksLikeRawKey('insight.good_week')).toBe(true);
  });
  it('false for real sentences', () => {
    expect(looksLikeRawKey('Welcome')).toBe(false);
    expect(looksLikeRawKey('Good weather this week for planting')).toBe(false);
  });
});

// ─── speakLocalizedMessage ───────────────────────────────────
describe('speakLocalizedMessage', () => {
  const t = (key, params) => {
    if (key === 'task.prepare_land') return 'Prepare your land';
    return key;
  };

  class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ''; }
  }
  let spoken;
  let cancelled;
  const fakeSynth = {
    cancel: () => { cancelled = (cancelled || 0) + 1; },
    speak:  (u) => { spoken = u; },
  };

  beforeEach(() => { spoken = null; cancelled = 0; });

  it('resolves payload, cancels prior utterance, speaks localized text', () => {
    const out = speakLocalizedMessage(
      { key: 'task.prepare_land' }, 'hi', t,
      { synth: fakeSynth, UtteranceCtor: FakeUtterance },
    );
    expect(out.ok).toBe(true);
    expect(out.spoken).toBe('Prepare your land');
    expect(out.tag).toBe('hi-IN');
    expect(cancelled).toBe(1);
    expect(spoken.text).toBe('Prepare your land');
  });

  it('returns ok:false reason:empty when payload renders to ""', () => {
    const out = speakLocalizedMessage(
      { key: 'x.y' }, 'en', () => '',
      { synth: fakeSynth, UtteranceCtor: FakeUtterance },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('empty');
  });

  it('returns ok:false reason:unsupported when no synth present', () => {
    const out = speakLocalizedMessage(
      { key: 'task.prepare_land' }, 'en', t, { synth: null },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported');
  });

  it('returns ok:false reason:error when speak throws', () => {
    const throwing = { cancel: () => {}, speak: () => { throw new Error('boom'); } };
    const out = speakLocalizedMessage(
      { key: 'task.prepare_land' }, 'en', t,
      { synth: throwing, UtteranceCtor: FakeUtterance },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('error');
  });
});

describe('localeToVoiceTag', () => {
  it('maps known locales', () => {
    expect(localeToVoiceTag('hi')).toBe('hi-IN');
    expect(localeToVoiceTag('fr')).toBe('fr-FR');
    expect(localeToVoiceTag('ar')).toBe('ar-SA');
    expect(localeToVoiceTag('sw')).toBe('sw-KE');
  });
  it('falls back to en-US for unknown', () => {
    expect(localeToVoiceTag('xx')).toBe('en-US');
    expect(localeToVoiceTag(null)).toBe('en-US');
    expect(localeToVoiceTag(undefined)).toBe('en-US');
  });
});

describe('cancelSpeak', () => {
  it('no-op when synth unavailable', () => {
    expect(cancelSpeak({ synth: null })).toBe(false);
  });
  it('returns true on success', () => {
    expect(cancelSpeak({ synth: { cancel: () => {} } })).toBe(true);
  });
});

// ─── assistiveMode ───────────────────────────────────────────
describe('assistiveMode', () => {
  it('isAssistiveMode identifies "assistive"', () => {
    expect(isAssistiveMode(ASSISTIVE)).toBe(true);
    expect(isAssistiveMode(NORMAL)).toBe(false);
    expect(isAssistiveMode(undefined)).toBe(false);
  });

  it('resolveAssistivePayload returns payload unchanged in normal mode', () => {
    const p = { key: 'a.b', assistiveKey: 'a.b.short', params: { x: 1 } };
    expect(resolveAssistivePayload(p, NORMAL)).toBe(p);
  });

  it('resolveAssistivePayload swaps to assistiveKey when set', () => {
    const p = { key: 'a.b', assistiveKey: 'a.b.short', params: { x: 1 } };
    const out = resolveAssistivePayload(p, ASSISTIVE);
    expect(out.key).toBe('a.b.short');
    expect(out.mode).toBe(ASSISTIVE);
    expect(out.params).toEqual({ x: 1 });
  });

  it('resolveAssistivePayload falls back to original key when no assistiveKey', () => {
    const p = { key: 'a.b', params: { x: 1 } };
    const out = resolveAssistivePayload(p, ASSISTIVE);
    expect(out.key).toBe('a.b');
    expect(out.mode).toBe(ASSISTIVE);
  });

  it('simplifyText respects sentence boundaries', () => {
    const out = simplifyText('Rain is expected tonight. Prepare drainage rows now.');
    expect(out).toBe('Rain is expected tonight.');
  });

  it('simplifyText truncates long text with ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = simplifyText(long, { maxChars: 30 });
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out.endsWith('\u2026')).toBe(true);
  });

  it('assistiveLayout returns hints by mode', () => {
    const normal = assistiveLayout(NORMAL);
    const assist = assistiveLayout(ASSISTIVE);
    expect(normal.minTapTargetPx).toBe(44);
    expect(assist.minTapTargetPx).toBe(56);
    expect(assist.showSecondaryInfo).toBe(false);
    expect(assist.showVoiceButton).toBe('prominent');
  });
});

// ─── §12 dev assertions ──────────────────────────────────────
describe('§12 dev assertions', () => {
  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('assertNotRawKey silent on real sentences', () => {
    assertNotRawKey('Welcome, Ama');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertNotRawKey warns on dotted key output', () => {
    assertNotRawKey('insight.good_week');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertEngineEmitsPayload silent on structured payload', () => {
    assertEngineEmitsPayload({ key: 'a.b' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertEngineEmitsPayload warns on rendered string', () => {
    assertEngineEmitsPayload('Good weather this week');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertEngineEmitsPayload silent on null/undefined', () => {
    assertEngineEmitsPayload(null);
    assertEngineEmitsPayload(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertPayloadHasKey warns on missing key', () => {
    assertPayloadHasKey({ params: {} });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertPayloadHasKey silent on valid payload', () => {
    assertPayloadHasKey({ key: 'x.y' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  describe('assertNoEnglishLeakInLocale', () => {
    it('silent for English locale', () => {
      assertNoEnglishLeakInLocale('en', 'Welcome to Farroway');
      expect(warnSpy).not.toHaveBeenCalled();
    });
    it('silent for Hindi with Devanagari', () => {
      assertNoEnglishLeakInLocale('hi', 'फ़ार्रोवे में स्वागत है');
      expect(warnSpy).not.toHaveBeenCalled();
    });
    it('warns for Hindi with ASCII-only text', () => {
      assertNoEnglishLeakInLocale('hi', 'Welcome to Farroway');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
    it('warns for Arabic with no Arabic script', () => {
      assertNoEnglishLeakInLocale('ar', 'Welcome to Farroway');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
    it('warns for French containing English function words', () => {
      assertNoEnglishLeakInLocale('fr', 'Please update your farm details');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
    it('silent for French with French diacritics', () => {
      assertNoEnglishLeakInLocale('fr', 'Mettez à jour votre ferme');
      expect(warnSpy).not.toHaveBeenCalled();
    });
    it('silent for short strings', () => {
      assertNoEnglishLeakInLocale('hi', 'OK');
      assertNoEnglishLeakInLocale('hi', 'Yes');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('assertCachedPayloadIsStructured', () => {
    it('silent on fully-structured cache', () => {
      assertCachedPayloadIsStructured({
        insight: { key: 'x.y' },
        title:   { key: 'a.b' },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });
    it('warns when a field is a rendered string', () => {
      assertCachedPayloadIsStructured({
        insight: 'Good weather this week',
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
    it('silent when field is a bare key', () => {
      assertCachedPayloadIsStructured({
        insight: 'home.insight_key',
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
