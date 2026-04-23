/**
 * channelRouting.test.js — locks the 10-point WhatsApp + voice alert
 * spec: channel selection, literacy mode, preference gating, dedup,
 * fallback safety, language-aware voice message shaping.
 */

import { describe, it, expect } from 'vitest';

import {
  buildNotifications, SMS_DAILY_CAP, WA_DAILY_CAP, VOICE_DAILY_CAP,
  _internal,
} from '../../../src/lib/notifications/insightNotificationAdapter.js';
import {
  sendWhatsApp, isWhatsAppConfigured, _internal as waInt,
} from '../../services/whatsAppService.js';
import {
  sendVoiceAlert, buildVoiceMessage, buildTwiml,
  isVoiceConfigured, _internal as voiceInt,
} from '../../services/voiceAlertService.js';

const FARM = Object.freeze({
  id: 'farm-1', farmType: 'small_farm',
  country: 'GH', cropType: 'cassava',
  phone: '+233555123456',
});

function insightDry() {
  return {
    id: 'insight.water.stress',
    type: 'warning', priority: 'high',
    messageKey: 'insight.water.stress.msg',
    fallbackMessage: 'Water stress risk',
    recommendedAction: 'Plan irrigation today',
  };
}
function insightStage() {
  return {
    id: 'insight.stage.vegetative',
    type: 'action', priority: 'medium',
    messageKey: 'insight.stage.vegetative.msg',
    fallbackMessage: 'Vegetative stage',
  };
}

// ─── Routing by preference ─────────────────────────────────────
describe('channel routing by preference', () => {
  it('voice-mode user gets voice for high-priority alert', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: {
        receiveSMS: true, receiveWhatsApp: false,
        receiveVoiceAlerts: true, literacyMode: 'voice',
      },
    });
    const voice = out.find((n) => n.type === 'voice');
    expect(voice).toBeTruthy();
    expect(voice.priority).toBe('high');
    expect(voice.id.startsWith('voice:')).toBe(true);
  });

  it('mixed-mode user with whatsapp gets whatsapp for daily reminder (medium)', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightStage()],          // medium priority
      userPreferences: {
        receiveWhatsApp: true, literacyMode: 'mixed',
      },
    });
    const wa = out.find((n) => n.type === 'whatsapp');
    expect(wa).toBeTruthy();
    expect(wa.priority).toBe('medium');
  });

  it('whatsapp respects receiveWhatsApp=false', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightStage()],
      userPreferences: { receiveWhatsApp: false },
    });
    expect(out.some((n) => n.type === 'whatsapp')).toBe(false);
  });

  it('voice respects receiveVoiceAlerts=false even when literacyMode=voice', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: {
        receiveVoiceAlerts: false, literacyMode: 'voice',
        receiveSMS: true,
      },
    });
    expect(out.some((n) => n.type === 'voice')).toBe(false);
    // Should fall back to SMS for the high-priority alert.
    expect(out.some((n) => n.type === 'sms')).toBe(true);
  });

  it('low-priority alerts stay in_app only', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [{
        id: 'insight.generic.infoLow',
        priority: 'low', type: 'info',
        messageKey: 'insight.generic.info',
        fallbackMessage: 'Check your crop today',
      }],
      userPreferences: { receiveWhatsApp: true, receiveSMS: true },
    });
    expect(out.every((n) => n.type === 'in_app'
                          || n.source !== 'insight')).toBe(true);
  });
});

// ─── Fallback + dedup ──────────────────────────────────────────
describe('fallback + dedup', () => {
  it('fallback from whatsapp to sms works when whatsapp disabled', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: {
        receiveWhatsApp: false, receiveSMS: true,
      },
    });
    expect(out.some((n) => n.type === 'sms')).toBe(true);
    expect(out.some((n) => n.type === 'whatsapp')).toBe(false);
  });

  it('no duplicate SMS when WhatsApp already covers the same alert', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: {
        receiveWhatsApp: true, receiveSMS: true,
      },
    });
    // WA should fire; SMS suppressed for the same insight id.
    expect(out.some((n) => n.type === 'whatsapp')).toBe(true);
    expect(out.some((n) => n.type === 'sms')).toBe(false);
  });

  it('no crash without phone number (in_app only)', () => {
    const noPhone = { ...FARM, phone: null };
    const out = buildNotifications({
      userId: 'u1', farms: [noPhone],
      insights: [insightDry()],
      userPreferences: { receiveSMS: true, receiveWhatsApp: true },
    });
    expect(out.every((n) => n.type === 'in_app')).toBe(true);
  });

  it('dedup via recentlySent — skips already-delivered ids', () => {
    const recent = new Set([
      `whatsapp:insight:${FARM.id}:insight.water.stress:${new Date().toISOString().slice(0,10)}`,
    ]);
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: { receiveWhatsApp: true },
      recentlySent: recent,
    });
    expect(out.some((n) => n.type === 'whatsapp')).toBe(false);
  });

  it('daily caps bound each channel independently', () => {
    const insights = [];
    for (let i = 0; i < 10; i += 1) {
      insights.push({
        ...insightDry(),
        id: `insight.dry.${i}`,
      });
    }
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights,
      userPreferences: { receiveWhatsApp: true },
    });
    expect(out.filter((n) => n.type === 'whatsapp').length)
      .toBeLessThanOrEqual(WA_DAILY_CAP);
    expect(out.filter((n) => n.type === 'voice').length)
      .toBeLessThanOrEqual(VOICE_DAILY_CAP);
  });

  it('log shape includes channel + priority + timestamp', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: { receiveWhatsApp: true },
    });
    for (const n of out) {
      expect(['in_app', 'sms', 'whatsapp', 'voice']).toContain(n.type);
      expect(['high', 'medium', 'low']).toContain(n.priority);
      expect(() => new Date(n.timestamp).toISOString()).not.toThrow();
    }
  });
});

// ─── Voice message shaping ─────────────────────────────────────
describe('buildVoiceMessage', () => {
  it('joins message + action into one spoken line', () => {
    const out = buildVoiceMessage({
      fallbackMessage: 'Water stress risk',
      recommendedAction: 'Water your crops today',
    });
    expect(out.toLowerCase()).toContain('water stress');
    expect(out.toLowerCase()).toContain('water your crops today');
  });

  it('expands common abbreviations for TTS', () => {
    const out = buildVoiceMessage('Use 50 kg per ha');
    expect(out).toContain('kilograms');
    expect(out).toContain('hectares');
  });

  it('strips emoji + arrows', () => {
    const out = buildVoiceMessage({
      fallbackMessage: '\u26A0\uFE0F Water stress risk',
      recommendedAction: '\u2192 Water today',
    });
    expect(out).not.toMatch(/[\u26A0\u2192]/);
  });

  it('accepts a plain string', () => {
    expect(buildVoiceMessage('Check your cassava today'))
      .toMatch(/cassava/i);
  });

  it('returns empty string for null / undefined', () => {
    expect(buildVoiceMessage(null)).toBe('');
    expect(buildVoiceMessage(undefined)).toBe('');
  });

  it('prefers translatedMessage when available', () => {
    const out = buildVoiceMessage({
      fallbackMessage: 'Water stress risk',
      translatedMessage: 'Risque de stress hydrique',
    });
    expect(out).toContain('Risque');
  });

  it('truncates very long copy with a safe boundary', () => {
    const long = 'a'.repeat(300) + '. done.';
    const out = buildVoiceMessage(long);
    expect(out.length).toBeLessThanOrEqual(240);
  });
});

// ─── TwiML generation ──────────────────────────────────────────
describe('buildTwiml', () => {
  it('emits well-formed TwiML with language', () => {
    const xml = buildTwiml('Hello farmer', 'fr');
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<Response>');
    expect(xml).toContain('<Say language="fr-FR">');
    expect(xml).toContain('Hello farmer');
  });

  it('escapes XML special characters', () => {
    const xml = buildTwiml('a & b < c > "d"', 'en');
    expect(xml).toContain('a &amp; b &lt; c &gt; &quot;d&quot;');
  });

  it('falls back to en-US for unsupported languages', () => {
    const xml = buildTwiml('Hello', 'zz');
    expect(xml).toContain('language="en-US"');
  });

  it('maps hi → en-IN (closest TTS voice)', () => {
    const xml = buildTwiml('namaste', 'hi');
    expect(xml).toContain('language="en-IN"');
  });
});

// ─── Service wrappers — missing config safety ─────────────────
describe('sendWhatsApp / sendVoiceAlert — safety', () => {
  it('sendWhatsApp returns missing_to_or_body without phone', async () => {
    const r = await sendWhatsApp(null, 'hi');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_to_or_body');
  });

  it('sendWhatsApp returns not_configured without Twilio WA env', async () => {
    const saved = { a: process.env.TWILIO_ACCOUNT_SID,
                     b: process.env.TWILIO_AUTH_TOKEN,
                     c: process.env.TWILIO_WHATSAPP_FROM,
                     d: process.env.TWILIO_WHATSAPP };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    delete process.env.TWILIO_WHATSAPP;
    try {
      const r = await sendWhatsApp('+1555', 'hi');
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_configured');
    } finally {
      process.env.TWILIO_ACCOUNT_SID   = saved.a;
      process.env.TWILIO_AUTH_TOKEN    = saved.b;
      process.env.TWILIO_WHATSAPP_FROM = saved.c;
      if (saved.d) process.env.TWILIO_WHATSAPP = saved.d;
    }
  });

  it('sendVoiceAlert returns missing_to_or_body without phone', async () => {
    const r = await sendVoiceAlert(null, 'hi', 'en');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_to_or_body');
  });

  it('sendVoiceAlert returns not_configured without Twilio Voice env', async () => {
    const saved = { a: process.env.TWILIO_ACCOUNT_SID,
                     b: process.env.TWILIO_AUTH_TOKEN,
                     c: process.env.TWILIO_VOICE_FROM,
                     d: process.env.TWILIO_PHONE_NUMBER,
                     e: process.env.TWILIO_PHONE };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VOICE_FROM;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_PHONE;
    try {
      const r = await sendVoiceAlert('+1555', 'hi', 'en');
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_configured');
    } finally {
      process.env.TWILIO_ACCOUNT_SID  = saved.a;
      process.env.TWILIO_AUTH_TOKEN   = saved.b;
      process.env.TWILIO_VOICE_FROM   = saved.c;
      process.env.TWILIO_PHONE_NUMBER = saved.d;
      if (saved.e) process.env.TWILIO_PHONE = saved.e;
    }
  });
});

// ─── WhatsApp env canonicalisation ────────────────────────────
describe('env canonicalization', () => {
  it('WhatsApp maps TWILIO_SID/TOKEN/WHATSAPP → long form', () => {
    const saved = { a: process.env.TWILIO_ACCOUNT_SID,
                     b: process.env.TWILIO_AUTH_TOKEN,
                     c: process.env.TWILIO_WHATSAPP_FROM };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    process.env.TWILIO_SID = 'AC_wa';
    process.env.TWILIO_TOKEN = 'tok_wa';
    process.env.TWILIO_WHATSAPP = 'whatsapp:+14155238886';
    try {
      waInt.canonicalizeWhatsAppEnv();
      expect(process.env.TWILIO_ACCOUNT_SID).toBe('AC_wa');
      expect(process.env.TWILIO_WHATSAPP_FROM).toBe('whatsapp:+14155238886');
    } finally {
      process.env.TWILIO_ACCOUNT_SID   = saved.a;
      process.env.TWILIO_AUTH_TOKEN    = saved.b;
      process.env.TWILIO_WHATSAPP_FROM = saved.c;
      delete process.env.TWILIO_SID;
      delete process.env.TWILIO_TOKEN;
      delete process.env.TWILIO_WHATSAPP;
    }
  });

  it('WhatsApp ensureWhatsAppPrefix adds the prefix when missing', () => {
    expect(waInt.ensureWhatsAppPrefix('+1555')).toBe('whatsapp:+1555');
    expect(waInt.ensureWhatsAppPrefix('whatsapp:+1555')).toBe('whatsapp:+1555');
  });
});

// ─── Pick-channels unit tests ────────────────────────────────
describe('pickChannels rules', () => {
  const fullCaps = { sms: 5, whatsapp: 5, voice: 5 };

  it('voice-first for high-priority voice-mode user', () => {
    const picks = _internal.pickChannels({
      priority: 'high',
      prefs: {
        receiveSMS: true, receiveWhatsApp: true,
        receiveVoiceAlerts: true, literacyMode: 'voice',
      },
      caps: { ...fullCaps },
    });
    expect(picks[0]).toBe('voice');
  });

  it('whatsapp preferred over sms for high-priority mixed-mode', () => {
    const picks = _internal.pickChannels({
      priority: 'high',
      prefs: {
        receiveSMS: true, receiveWhatsApp: true,
        receiveVoiceAlerts: false, literacyMode: 'mixed',
      },
      caps: { ...fullCaps },
    });
    expect(picks).toContain('whatsapp');
    expect(picks).not.toContain('sms');   // spec §8: no duplicate
  });

  it('sms when only SMS is enabled', () => {
    const picks = _internal.pickChannels({
      priority: 'high',
      prefs: {
        receiveSMS: true, receiveWhatsApp: false,
        receiveVoiceAlerts: false, literacyMode: 'text',
      },
      caps: { ...fullCaps },
    });
    expect(picks).toEqual(['sms']);
  });

  it('medium priority → whatsapp if enabled, never sms', () => {
    const picks = _internal.pickChannels({
      priority: 'medium',
      prefs: {
        receiveSMS: true, receiveWhatsApp: true,
        receiveVoiceAlerts: true, literacyMode: 'voice',
      },
      caps: { ...fullCaps },
    });
    expect(picks).toEqual(['whatsapp']);
  });

  it('low priority → no external channels', () => {
    const picks = _internal.pickChannels({
      priority: 'low',
      prefs: {
        receiveSMS: true, receiveWhatsApp: true,
        receiveVoiceAlerts: true, literacyMode: 'voice',
      },
      caps: { ...fullCaps },
    });
    expect(picks).toEqual([]);
  });
});

// ─── Preferences defaults ─────────────────────────────────────
describe('preference defaults', () => {
  it('external channels default OFF', () => {
    const p = _internal.normalisePrefs({});
    expect(p.receiveWhatsApp).toBe(false);
    expect(p.receiveVoiceAlerts).toBe(false);
    expect(p.literacyMode).toBe('text');
    expect(p.preferredLanguage).toBe('en');
  });

  it('literacyMode clamped to valid values', () => {
    expect(_internal.normalisePrefs({ literacyMode: 'foo' }).literacyMode).toBe('text');
    expect(_internal.normalisePrefs({ literacyMode: 'voice' }).literacyMode).toBe('voice');
    expect(_internal.normalisePrefs({ literacyMode: 'mixed' }).literacyMode).toBe('mixed');
  });

  it('preferredReminderTime falls back to legacy preferredTime', () => {
    expect(_internal.normalisePrefs({ preferredTime: '06:30' })
      .preferredReminderTime).toBe('06:30');
    expect(_internal.normalisePrefs({ preferredReminderTime: '07:15' })
      .preferredReminderTime).toBe('07:15');
  });
});
