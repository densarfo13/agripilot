/**
 * voiceGuideV1.test.js — Voice Guide V1 Implementation:
 *   1. voicePreferences — on/off, language pref, auto-read-scan
 *   2. resolveVoiceLanguage — auto vs explicit pref vs uiLang fallback
 *   3. voiceTelemetry — 4 spec-mandated events fire through
 *      safeTrackEvent without ever throwing
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
  globalThis.localStorage = makeStorage();
});

// ─── 1. voicePreferences ─────────────────────────────────────

describe('voicePreferences — on/off master toggle', () => {
  it('defaults to ON when nothing is set', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.getVoiceEnabled()).toBe(true);
  });

  it('setVoiceEnabled(false) persists across reads', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    mod.setVoiceEnabled(false);
    expect(mod.getVoiceEnabled()).toBe(false);
    mod.setVoiceEnabled(true);
    expect(mod.getVoiceEnabled()).toBe(true);
  });

  it('legacy "off"/"false"/"0" values also resolve to false', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    globalThis.localStorage.setItem('farroway_voice_enabled_v1', 'off');
    expect(mod.getVoiceEnabled()).toBe(false);
    globalThis.localStorage.setItem('farroway_voice_enabled_v1', 'false');
    expect(mod.getVoiceEnabled()).toBe(false);
  });
});

describe('voicePreferences — language', () => {
  it('defaults to "auto" when nothing set', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.getPreferredVoiceLanguage()).toBe('auto');
  });

  it('persists a valid language', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    mod.setPreferredVoiceLanguage('tw');
    expect(mod.getPreferredVoiceLanguage()).toBe('tw');
  });

  it('rejects unknown codes and clamps to "auto"', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    mod.setPreferredVoiceLanguage('klingon');
    expect(mod.getPreferredVoiceLanguage()).toBe('auto');
  });

  it('supports all 8 spec-mandated codes (auto + 7 languages)', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    const codes = mod.SUPPORTED_VOICE_LANGUAGES.map((e) => e.code);
    expect(codes).toContain('auto');
    expect(codes).toContain('en');
    expect(codes).toContain('en-GH');
    expect(codes).toContain('tw');
    expect(codes).toContain('ha');
    expect(codes).toContain('fr');
    expect(codes).toContain('sw');
    expect(codes).toContain('hi');
  });
});

describe('voicePreferences — autoReadScanResult', () => {
  it('defaults to OFF (must be explicit opt-in per spec §8)', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.getAutoReadScanResult()).toBe(false);
  });

  it('setAutoReadScanResult(true) persists', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    mod.setAutoReadScanResult(true);
    expect(mod.getAutoReadScanResult()).toBe(true);
    mod.setAutoReadScanResult(false);
    expect(mod.getAutoReadScanResult()).toBe(false);
  });
});

describe('voicePreferences — resolveVoiceLanguage', () => {
  it('explicit pref wins over uiLang', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    mod.setPreferredVoiceLanguage('tw');
    expect(mod.resolveVoiceLanguage({ uiLang: 'fr' })).toBe('tw-GH');
  });

  it('"auto" falls back to uiLang when uiLang is in the registry', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.resolveVoiceLanguage({ uiLang: 'fr' })).toBe('fr-FR');
    expect(mod.resolveVoiceLanguage({ uiLang: 'sw' })).toBe('sw-KE');
    expect(mod.resolveVoiceLanguage({ uiLang: 'hi' })).toBe('hi-IN');
  });

  it('"auto" + unknown uiLang returns en-US fallback', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.resolveVoiceLanguage({ uiLang: 'klingon' })).toBe('en-US');
    expect(mod.resolveVoiceLanguage(null)).toBe('en-US');
    expect(mod.resolveVoiceLanguage({})).toBe('en-US');
  });

  it('accepts raw BCP-47 tags ("fr-FR") and passes them through', async () => {
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(mod.resolveVoiceLanguage({ uiLang: 'fr-FR' })).toBe('fr-FR');
  });

  it('SSR-safe — never throws when localStorage is absent', async () => {
    delete globalThis.localStorage;
    const mod = await import('../../../src/lib/voice/voicePreferences.js');
    expect(() => mod.getVoiceEnabled()).not.toThrow();
    expect(() => mod.resolveVoiceLanguage({ uiLang: 'en' })).not.toThrow();
    expect(mod.resolveVoiceLanguage({ uiLang: 'en' })).toBe('en-US');
  });
});

// ─── 2. voiceTelemetry ──────────────────────────────────────

describe('voiceTelemetry — event firing', () => {
  let captured = [];
  beforeEach(() => {
    captured = [];
    vi.doMock('../../../src/lib/analytics.js', () => ({
      safeTrackEvent: (event, payload) => {
        captured.push({ event, payload });
      },
    }));
  });

  it('exposes the 4 spec-mandated event names', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    expect(mod.VOICE_EVENTS.PLAYED).toBe('voice_played');
    expect(mod.VOICE_EVENTS.STOPPED).toBe('voice_stopped');
    expect(mod.VOICE_EVENTS.UNAVAILABLE).toBe('voice_unavailable');
    expect(mod.VOICE_EVENTS.LANGUAGE_SELECTED).toBe('voice_language_selected');
  });

  it('trackVoicePlayed fires with normalised source + lang', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    mod.trackVoicePlayed({ source: 'scan_result', lang: 'en-US', charCount: 42 });
    expect(captured.length).toBe(1);
    expect(captured[0].event).toBe('voice_played');
    expect(captured[0].payload.source).toBe('scan_result');
    expect(captured[0].payload.lang).toBe('en-us');
    expect(captured[0].payload.charCount).toBe(42);
  });

  it('trackVoicePlayed collapses unknown source to "unknown"', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    mod.trackVoicePlayed({ source: 'pyramid_scheme_panel', lang: 'en' });
    expect(captured[0].payload.source).toBe('unknown');
  });

  it('trackVoicePlayed collapses malformed lang to "unknown"', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    mod.trackVoicePlayed({ source: 'scan_result', lang: 'not a tag at all' });
    expect(captured[0].payload.lang).toBe('unknown');
  });

  it('trackVoiceStopped + trackVoiceUnavailable + trackVoiceLanguageSelected all fire', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    mod.trackVoiceStopped({ source: 'home_recommendation' });
    mod.trackVoiceUnavailable({ reason: 'no_speech_synthesis' });
    mod.trackVoiceLanguageSelected({ from: 'en', to: 'tw' });
    expect(captured.map((c) => c.event)).toEqual([
      'voice_stopped',
      'voice_unavailable',
      'voice_language_selected',
    ]);
    expect(captured[2].payload.from).toBe('en');
    expect(captured[2].payload.to).toBe('tw');
  });

  it('analytics failure NEVER bubbles into UI', async () => {
    vi.resetModules();
    vi.doMock('../../../src/lib/analytics.js', () => ({
      safeTrackEvent: () => { throw new Error('analytics is on fire'); },
    }));
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    expect(() => mod.trackVoicePlayed({ source: 'scan_result', lang: 'en' })).not.toThrow();
    expect(() => mod.trackVoiceStopped({ source: 'home_recommendation' })).not.toThrow();
    expect(() => mod.trackVoiceUnavailable({ reason: 'x' })).not.toThrow();
    expect(() => mod.trackVoiceLanguageSelected({ from: 'en', to: 'tw' })).not.toThrow();
  });

  it('never leaks PII — only allow-listed source tags reach the wire', async () => {
    const mod = await import('../../../src/lib/voice/voiceTelemetry.js');
    mod.trackVoicePlayed({
      source: 'jane@example.com', // PII attempt
      lang:   'en',
    });
    expect(captured[0].payload.source).toBe('unknown');
  });
});
