/**
 * voiceAssistant.js — minimum-viable voice assistant for the
 * Proactive Farm Intelligence Layer §6.
 *
 *   const intent = routeIntent("what should I do today");
 *   const answer = answerForIntent(intent, context);
 *   speak(answer.text, answer.lang);
 *
 * What it is (and what it isn't)
 * ───────────────────────────────
 *   We don't claim to ship a conversational AI. What ships is:
 *
 *     • routeIntent(question)  — keyword matcher against ~6
 *                                canonical farmer questions.
 *                                Returns an intent code or 'unknown'.
 *
 *     • answerForIntent(intent, ctx)
 *                              — composes a calm one-paragraph
 *                                answer from data we already have
 *                                (daily briefing lines, top risk,
 *                                recent scan, top action). Never
 *                                invents facts.
 *
 *     • speak(text, lang)      — wraps window.speechSynthesis
 *                                so the answer is voiced in the
 *                                user's chosen language. SSR-safe;
 *                                returns false when the platform
 *                                lacks speech support so the caller
 *                                can fall back to text-only.
 *
 *     • isVoiceSupported()     — boolean the UI can read before
 *                                showing the mic button.
 *
 *   The full spec §6 ("Farmer can ask: ... When should I spray?")
 *   would benefit from a real STT/NLU/LLM round-trip; we ship the
 *   *first useful slice* — voice OUT (universally available via
 *   browser TTS) plus deterministic keyword routing for the
 *   handful of questions every farmer actually asks.
 *
 * Strict-rule audit
 *   • Pure functions for routeIntent + answerForIntent — never throw.
 *   • speak() is fire-and-forget; storage / quota / permission
 *     errors are swallowed.
 *   • Locale → BCP-47 mapping is conservative: when the active
 *     language isn't on the supported list, the helper falls
 *     through to English so the answer at least plays.
 */

// ─── Intent vocabulary ───────────────────────────────────────

export const INTENT_KEYWORDS = Object.freeze({
  today:          ['what should i do today', "today's plan", 'plan today', 'today plan', 'what now', 'what to do today'],
  why_leaves:     ['why are my leaves', 'why leaves yellow', "what's wrong", 'whats wrong', 'why is my plant', 'why are my plants'],
  when_spray:     ['when should i spray', 'when to spray', 'spray timing'],
  when_water:     ['when should i water', 'when to water', 'when do i water', 'when water', 'irrigation'],
  weather_risk:   ['weather risk', 'is there risk', 'any risk', 'what about the weather', 'weather today'],
  farm_health:    ['how is my farm', "how's my farm", 'farm health', 'health score', 'how am i doing'],
});

const _INTENT_LIST = Object.freeze(Object.keys(INTENT_KEYWORDS));

// ─── Locale → BCP-47 mapping for speechSynthesis ─────────────

const _LANG_BCP47 = Object.freeze({
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',      // Swahili — voices vary by platform
  ha: 'ha-NG',      // Hausa — limited voice coverage
  tw: 'en-GH',      // Twi — fall through to English (Ghana accent) since
                    //  most platforms lack a Twi voice. Honest fallback.
  hi: 'hi-IN',
});

// ─── Helpers ─────────────────────────────────────────────────

function _safeStr(v) {
  return String(v == null ? '' : v).toLowerCase().trim();
}

function _normQuestion(q) {
  return _safeStr(q)
    .replace(/[?!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Match a user-typed or transcribed question to an intent code.
 * Falls through to 'unknown' so the caller can render a calm
 * "Try asking: ..." fallback.
 *
 * @param {string} question
 * @returns {string}  intent code (see INTENT_KEYWORDS keys) or 'unknown'
 */
export function routeIntent(question) {
  const q = _normQuestion(question);
  if (!q) return 'unknown';
  for (const intent of _INTENT_LIST) {
    const phrases = INTENT_KEYWORDS[intent] || [];
    for (const p of phrases) {
      if (q.includes(p)) return intent;
    }
  }
  return 'unknown';
}

/**
 * Compose a calm one-paragraph answer for the matched intent. The
 * caller supplies the context bundle so we never have to read from
 * storage (keeps the module pure + easy to test).
 *
 * @param {string} intent  — routeIntent's return value
 * @param {object} context
 * @param {object} [context.briefing]      — composeDailyBriefing output
 * @param {Array}  [context.risks]         — computePredictiveRisks output
 * @param {object} [context.topAction]     — topAction return shape
 * @param {object} [context.healthScore]   — computeFarmHealthScore output
 * @param {object} [context.latestScan]    — scanHistoryStore entry
 * @param {string} [context.lang]          — language code (en/fr/sw/ha/tw/hi)
 * @returns {{ text: string, lang: string, intent: string }}
 */
export function answerForIntent(intent, context) {
  const ctx = (context && typeof context === 'object') ? context : {};
  const lang = _LANG_BCP47[String(ctx.lang || 'en').toLowerCase()] || _LANG_BCP47.en;

  const _str = (v) => {
    const s = String(v == null ? '' : v).trim();
    return s || null;
  };

  let text = null;

  switch (intent) {
    case 'today': {
      const briefing = ctx.briefing && typeof ctx.briefing === 'object' ? ctx.briefing : null;
      if (briefing && Array.isArray(briefing.lines) && briefing.lines.length > 0) {
        text = briefing.lines.join(' ');
      } else {
        text = 'Nothing urgent today. A good moment to walk the field and notice anything new.';
      }
      const topTitle = _str(ctx.topAction && ctx.topAction.task && ctx.topAction.task.title);
      if (topTitle) text += ` Best action right now: ${topTitle}.`;
      break;
    }
    case 'why_leaves': {
      const scan = ctx.latestScan && typeof ctx.latestScan === 'object' ? ctx.latestScan : null;
      if (scan) {
        const noticed = _str(scan.noticed) || 'something worth a closer look';
        const sev     = _str(scan.severity);
        const reco    = Array.isArray(scan.recommendations) && scan.recommendations.length > 0
          ? scan.recommendations[0]
          : null;
        text = `Your most recent scan noticed ${noticed}${sev ? ` at ${sev} severity` : ''}.`;
        if (reco) text += ` ${reco}`;
      } else {
        text = "I haven't seen a scan from you yet. Take a photo of the affected leaves and I'll take a closer look.";
      }
      break;
    }
    case 'when_spray':
    case 'when_water': {
      const risks = Array.isArray(ctx.risks) ? ctx.risks : [];
      const fungal  = risks.find((r) => r && r.kind === 'fungal');
      const drought = risks.find((r) => r && r.kind === 'drought');
      const heat    = risks.find((r) => r && r.kind === 'heat');
      if (intent === 'when_spray' && fungal) {
        text = `${fungal.headline} ${fungal.action}`;
      } else if (intent === 'when_water' && (drought || heat)) {
        const r = drought || heat;
        text = `${r.headline} ${r.action}`;
      } else if (intent === 'when_spray') {
        text = 'No fungal pressure signal today. Spraying without a clear signal can waste effort — check leaves first.';
      } else {
        text = 'No drought or heat-stress signal today. Stick to your usual watering window.';
      }
      break;
    }
    case 'weather_risk': {
      const risks = Array.isArray(ctx.risks) ? ctx.risks : [];
      const top = risks.find((r) => r && (r.level === 'high' || r.level === 'medium'));
      if (top) {
        text = `${top.headline} ${top.action}`;
      } else {
        text = 'No significant weather risk in your data right now.';
      }
      break;
    }
    case 'farm_health': {
      const hs = ctx.healthScore && typeof ctx.healthScore === 'object' ? ctx.healthScore : null;
      if (hs && typeof hs.score === 'number') {
        const bandSentence = (() => {
          switch (hs.band) {
            case 'excellent':  return 'Everything looks on track.';
            case 'good':       return 'Mostly healthy — a couple of things to watch.';
            case 'needs_care': return 'Some open issues need attention.';
            case 'urgent':     return 'Several signs need immediate care.';
            default:            return '';
          }
        })();
        text = `Your farm health score is ${hs.score} out of 100. ${bandSentence}`.trim();
      } else {
        text = 'Not enough history yet to give a health score. Try scanning your crop once or twice this week.';
      }
      break;
    }
    case 'unknown':
    default: {
      text = "I can answer: 'What should I do today?', 'Why are my leaves yellow?', 'When should I spray?', 'When should I water?', 'Is there a weather risk?', or 'How is my farm doing?'.";
      break;
    }
  }

  return { text: String(text || '').trim(), lang, intent };
}

// ─── Speech synthesis ─────────────────────────────────────────

/**
 * @returns {boolean}  whether window.speechSynthesis is available.
 */
export function isVoiceSupported() {
  try {
    return typeof window !== 'undefined'
        && typeof window.speechSynthesis !== 'undefined'
        && typeof window.SpeechSynthesisUtterance !== 'undefined';
  } catch { return false; }
}

/**
 * Speak the supplied text using browser TTS. Fire-and-forget;
 * returns false when the platform can't speak.
 *
 * @param {string} text
 * @param {string} [lang]  — BCP-47 tag (e.g. 'en-US'). Defaults to en-US.
 * @returns {boolean}      — whether the utterance was queued.
 */
export function speak(text, lang) {
  try {
    if (!isVoiceSupported()) return false;
    const trimmed = String(text || '').trim();
    if (!trimmed) return false;
    // Cancel any in-flight utterance so the latest answer plays
    // immediately (the user just asked something new).
    try { window.speechSynthesis.cancel(); } catch { /* swallow */ }
    const utterance = new window.SpeechSynthesisUtterance(trimmed);
    utterance.lang   = String(lang || 'en-US');
    utterance.rate   = 1.0;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch { return false; }
}

/** Stop any in-flight voice playback. */
export function stopVoice() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch { /* swallow */ }
}

export default {
  routeIntent,
  answerForIntent,
  speak,
  stopVoice,
  isVoiceSupported,
  INTENT_KEYWORDS,
};
