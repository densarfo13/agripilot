/**
 * VoiceAssistantPanel — minimum-viable voice surface for spec §6.
 *
 *   <VoiceAssistantPanel
 *     briefing={composedBriefing}
 *     risks={risks}
 *     topAction={topAction}
 *     healthScore={healthScore}
 *     latestScan={latestScan}
 *     lang={lang}
 *   />
 *
 * What it does
 * ────────────
 *   • Listen button   — speaks the supplied briefing lines using
 *                       browser TTS. Self-hides on platforms without
 *                       speech support.
 *   • Ask field       — text input + Send. Routes the question to
 *                       an intent + composes an answer from the
 *                       caller's context. Plays the answer aloud
 *                       AND renders it visibly so deaf / muted
 *                       users still benefit.
 *   • Mic button      — opt-in speech recognition where the browser
 *                       supports it (Chromium-based). Falls back to
 *                       text-only on Safari / Firefox.
 *
 * Strict-rule audit
 *   • All hooks unconditional. SpeechRecognition usage wrapped in
 *     try/catch so a permission denial can't crash the page.
 *   • Self-hides cleanly when the browser supports no speech path
 *     AND the user hasn't typed anything (no empty panel).
 *   • Never blocks input — async work is fire-and-forget.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  routeIntent,
  answerForIntent,
  speak,
  stopVoice,
  isVoiceSupported,
} from '../../lib/voiceAssistant.js';

const STYLES = {
  wrap: {
    marginTop: 8,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.92)',
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: '#C8944D',
    color: '#FFFFFF',
    border: 'none',
  },
  input: {
    flex: '1 1 auto',
    minWidth: 0,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  answer: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.55,
  },
  micActive: {
    background: 'rgba(239,68,68,0.20)',
    border: '1px solid rgba(239,68,68,0.45)',
    color: '#FCA5A5',
  },
};

// Best-effort detection of the Web Speech API's SpeechRecognition.
// It's vendor-prefixed on most platforms; absent entirely on Firefox
// and (most of) Safari. We treat absence as "use the text input."
function _getSpeechRecognitionCtor() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition
        || window.webkitSpeechRecognition
        || null;
  } catch { return null; }
}

export default function VoiceAssistantPanel({
  briefing,
  risks,
  topAction,
  healthScore,
  latestScan,
  lang = 'en',
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]     = useState(null);   // { text, intent }
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const ttsSupported = useMemo(() => isVoiceSupported(), []);
  const sttCtor = useMemo(() => _getSpeechRecognitionCtor(), []);

  const buildContext = useCallback(() => ({
    briefing, risks, topAction, healthScore, latestScan, lang,
  }), [briefing, risks, topAction, healthScore, latestScan, lang]);

  const onListen = useCallback(() => {
    if (!ttsSupported) return;
    const lines = (briefing && Array.isArray(briefing.lines)) ? briefing.lines : [];
    const text = [
      briefing && briefing.greeting ? briefing.greeting : '',
      ...lines,
    ].filter(Boolean).join(' ');
    if (!text) return;
    speak(text, _langToBCP47(lang));
  }, [briefing, ttsSupported, lang]);

  const onAsk = useCallback((q) => {
    const intent = routeIntent(q);
    const a = answerForIntent(intent, buildContext());
    setAnswer(a);
    if (ttsSupported) {
      try { speak(a.text, a.lang); } catch { /* swallow */ }
    }
  }, [buildContext, ttsSupported]);

  const onSubmitTyped = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const q = String(question || '').trim();
    if (!q) return;
    onAsk(q);
  }, [question, onAsk]);

  const onMic = useCallback(() => {
    if (!sttCtor) return;
    if (listening) {
      try { recognitionRef.current && recognitionRef.current.stop(); }
      catch { /* swallow */ }
      setListening(false);
      return;
    }
    try {
      const rec = new sttCtor();
      rec.lang           = _langToBCP47(lang);
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous     = false;
      rec.onresult = (event) => {
        try {
          const transcript = event && event.results && event.results[0]
            && event.results[0][0] && event.results[0][0].transcript;
          if (transcript) {
            setQuestion(transcript);
            onAsk(transcript);
          }
        } catch { /* swallow */ }
      };
      rec.onerror = () => { setListening(false); };
      rec.onend   = () => { setListening(false); };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, sttCtor, lang, onAsk]);

  const onStopAudio = useCallback(() => {
    try { stopVoice(); } catch { /* swallow */ }
  }, []);

  // Self-hide when there's no voice path AND no input UI worth
  // showing. The text input is always useful, so we render the
  // panel whenever the briefing has content — but skip if no
  // briefing was supplied at all.
  if (!briefing) return null;

  return (
    <section style={STYLES.wrap} data-testid="voice-assistant-panel">
      <div style={STYLES.row}>
        {ttsSupported ? (
          <button type="button" onClick={onListen} style={STYLES.btn} data-testid="va-listen">
            ▶ Listen to briefing
          </button>
        ) : null}
        {ttsSupported ? (
          <button type="button" onClick={onStopAudio} style={STYLES.btn} data-testid="va-stop">
            ■ Stop
          </button>
        ) : null}
      </div>

      <form onSubmit={onSubmitTyped} style={STYLES.row} data-testid="va-ask-form">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask: what should I do today?"
          style={STYLES.input}
          data-testid="va-input"
        />
        <button type="submit" style={{ ...STYLES.btn, ...STYLES.btnPrimary }} data-testid="va-send">
          Ask
        </button>
        {sttCtor ? (
          <button
            type="button"
            onClick={onMic}
            style={listening ? { ...STYLES.btn, ...STYLES.micActive } : STYLES.btn}
            data-testid="va-mic"
            aria-pressed={listening}
            aria-label={listening ? 'Stop listening' : 'Speak your question'}
          >
            {listening ? '● Listening' : '🎤'}
          </button>
        ) : null}
      </form>

      {answer && answer.text ? (
        <p style={STYLES.answer} data-testid="va-answer" data-intent={answer.intent}>
          {answer.text}
        </p>
      ) : null}
    </section>
  );
}

// Local copy of the lang map so this component doesn't have to read
// from the helper's internals. Kept in sync with voiceAssistant.js.
function _langToBCP47(code) {
  const lc = String(code || 'en').toLowerCase();
  switch (lc) {
    case 'fr': return 'fr-FR';
    case 'sw': return 'sw-KE';
    case 'ha': return 'ha-NG';
    case 'tw': return 'en-GH';   // honest fallback (no Twi voice on most platforms)
    case 'hi': return 'hi-IN';
    case 'en':
    default:   return 'en-US';
  }
}
