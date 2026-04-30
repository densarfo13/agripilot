/**
 * VoiceAssistant — the bottom-sheet UI for the "Ask Farroway"
 * voice flow.
 *
 * Composition:
 *   1. Header              "Ask Farroway" + close
 *   2. Suggested questions grid (always visible — guided first)
 *   3. Mic button + transcript area
 *   4. Answer card with text + Play / Stop audio buttons
 *   5. Status / error footer
 *
 * Strict-rule audit
 *   • No backend / network calls — engine is browser-only.
 *   • Every state transition is reversible — closing the sheet
 *     stops the mic and any active utterance so audio never
 *     leaks into the rest of the app.
 *   • Visibility honours FEATURE_VOICE_ASSISTANT — when off,
 *     the launcher hides the sheet entry point so this
 *     component is unreachable.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import {
  startListening, stopListening,
  speakAnswer, stopSpeaking, detectVoiceSupport,
} from '../../utils/voiceEngine.js';
import {
  routeVoiceIntent, answerForIntent, getSuggestedQuestions,
} from '../../utils/voiceIntents.js';
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import {
  generateDailyPlan, getDailyPlanVoiceSummary,
} from '../../core/dailyIntelligenceEngine.js';
import { useProfile } from '../../context/ProfileContext.jsx';
import {
  getRegionConfig, shouldUseBackyardExperience,
} from '../../config/regionConfig.js';

const STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  ANSWER: 'answer',
  ERROR: 'error',
};

export default function VoiceAssistant({ open, onClose }) {
  const { lang } = useTranslation();
  const navigate = useNavigate();
  // Profile context — used by the today_tasks intent so the
  // voice answer reflects the farmer's actual daily plan when
  // FEATURE_DAILY_INTELLIGENCE is on.
  let profile = null;
  try { profile = useProfile()?.profile || null; }
  catch { /* outside ProfileContext — voice still works with
              the static intent answer. */ }

  const [state, setState] = React.useState(STATE.IDLE);
  const [transcript, setTranscript] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [answerLang, setAnswerLang] = React.useState(lang);
  const [errorCode, setErrorCode] = React.useState(null);
  const [audioFallbackLang, setAudioFallbackLang] = React.useState(null);
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? !!navigator.onLine : true,
  );

  const recognitionHandle = React.useRef(null);
  const support = React.useMemo(() => detectVoiceSupport(lang), [lang]);

  // ── Lifecycle: track online/offline so the spec's "voice
  //    unavailable on weak network" message can show.
  React.useEffect(() => {
    function onOnline()  { setIsOnline(true);  }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── On open / close: log telemetry, reset state, stop audio.
  React.useEffect(() => {
    if (open) {
      try { logEvent(EVENT_TYPES.VOICE_ASSISTANT_OPENED || 'voice_opened',
        { lang }); } catch { /* swallow */ }
      setState(STATE.IDLE);
      setTranscript('');
      setAnswer('');
      setErrorCode(null);
      setAudioFallbackLang(null);
    } else {
      stopListening();
      stopSpeaking();
      if (recognitionHandle.current) {
        try { recognitionHandle.current.stop(); } catch { /* ignore */ }
        recognitionHandle.current = null;
      }
    }
    // We deliberately don't depend on `lang` so re-rendering
    // mid-session doesn't blow away an in-flight transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyIntentResult(result, originLabel = 'voice') {
    setAnswer(result.answer || '');
    setAnswerLang(result.answerLang || 'en');
    setState(STATE.ANSWER);
    try {
      logEvent(EVENT_TYPES.VOICE_ASSISTANT_ASKED || 'voice_asked', {
        lang,
        intentId: result.id,
        matched: !!result.matched,
        origin: originLabel,
        answerLang: result.answerLang,
        fallbackUsed: !!result.fallbackUsed,
      });
    } catch { /* swallow */ }
    // Speak the answer if synthesis is available; the spec
    // mandates we still SHOW text even if audio fails.
    const speakResult = speakAnswer(result.answer, result.answerLang || 'en', {
      onError: () => { /* error already logged via state */ },
    });
    if (speakResult.ok && speakResult.fallbackLang) {
      setAudioFallbackLang(speakResult.fallbackLang);
    }
    // Navigation for sell/help — fire after a short pause so
    // the answer card has a chance to render and (if audio
    // works) start playing.
    if (result.action && result.action.includes('navigate') && result.navigate) {
      setTimeout(() => {
        try { onClose && onClose(); } catch { /* ignore */ }
        navigate(result.navigate);
      }, 1200);
    }
  }

  function handleSuggestedTap(question) {
    setTranscript(question.question);
    setState(STATE.THINKING);
    // Tapped questions bypass SR and route directly via intent id.
    let result = answerForIntent(question.id, lang);
    // Spec §10: when Daily Intelligence is enabled, the
    // "today_tasks" intent reads the actual daily plan summary
    // instead of the static template — keeps voice in sync
    // with what the Home card shows.
    if (question.id === 'today_tasks'
        && profile
        && isFeatureEnabled('FEATURE_DAILY_INTELLIGENCE')) {
      try {
        const plan = generateDailyPlan({
          farm: profile,
          weather: profile.weather || null,
        });
        const voice = getDailyPlanVoiceSummary(plan);
        if (voice) result = voice;
      } catch { /* fall back to the static template */ }
    }
    applyIntentResult({
      id: question.id,
      matched: true,
      action: question.action,
      navigate: question.navigate,
      answer: result,
      answerLang: result ? lang : 'en',
      fallbackUsed: false,
    }, 'suggested');
  }

  function handleMicTap() {
    if (state === STATE.LISTENING) {
      // Toggle off — stop listening.
      stopListening();
      setState(STATE.IDLE);
      return;
    }
    if (!support.recognition) {
      setErrorCode('unsupported');
      setState(STATE.ERROR);
      try { logEvent(EVENT_TYPES.VOICE_ASSISTANT_FAILED || 'voice_failed',
        { lang, code: 'unsupported' }); } catch { /* swallow */ }
      return;
    }
    if (!isOnline) {
      setErrorCode('offline');
      setState(STATE.ERROR);
      return;
    }
    setTranscript('');
    setAnswer('');
    setErrorCode(null);
    setState(STATE.LISTENING);
    recognitionHandle.current = startListening({
      lang,
      onResult: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setState(STATE.THINKING);
          const result = routeVoiceIntent(text, lang);
          applyIntentResult(result, 'voice');
        }
      },
      onError: (code) => {
        setErrorCode(code);
        setState(STATE.ERROR);
        try { logEvent(EVENT_TYPES.VOICE_ASSISTANT_FAILED || 'voice_failed',
          { lang, code }); } catch { /* swallow */ }
      },
      onEnd: () => {
        // If we ended without going to ANSWER (e.g. silent
        // session), bounce back to IDLE so the mic button is
        // tappable again.
        setState((s) => (s === STATE.LISTENING ? STATE.IDLE : s));
      },
    });
  }

  function handleReplay() {
    if (!answer) return;
    const r = speakAnswer(answer, answerLang, {});
    if (r.ok && r.fallbackLang) setAudioFallbackLang(r.fallbackLang);
  }
  function handleStopAudio() { stopSpeaking(); }

  if (!open) return null;

  // Region-aware suggested-question filtering (spec §9). The
  // sell intent is hidden for backyard users + regions where
  // enableSellFlow is false; voice routing still resolves the
  // intent if a farmer happens to speak the phrase.
  const country  = profile?.country || profile?.countryCode || null;
  const farmType = profile?.farmType || null;
  const regionConfig = getRegionConfig(country);
  const isBackyard = shouldUseBackyardExperience(country, farmType);
  const suggested = getSuggestedQuestions(lang, { regionConfig, isBackyard });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tSafe('voice.askFarroway', 'Ask Farroway')}
      style={S.scrim}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      data-testid="voice-assistant"
    >
      <div style={S.sheet}>
        {/* ── Header ── */}
        <div style={S.header}>
          <span style={S.headerTitle}>
            {tSafe('voice.askFarroway', 'Ask Farroway')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={S.close}
            data-testid="voice-close"
          >×</button>
        </div>

        {/* ── Suggested questions (always visible) ── */}
        <div style={S.suggestedWrap} data-testid="voice-suggested">
          <p style={S.eyebrow}>
            {tSafe('voice.tapToSpeak', 'Tap a question or speak')}
          </p>
          <div style={S.suggestedGrid}>
            {suggested.map((q) => (
              <button
                key={q.id}
                type="button"
                style={S.suggestedBtn}
                onClick={() => handleSuggestedTap(q)}
                data-testid={`voice-suggested-${q.id}`}
              >
                {tSafe(`voice.${labelKeyFor(q.id)}`, q.question)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mic / transcript ── */}
        <div style={S.micArea}>
          <button
            type="button"
            onClick={handleMicTap}
            disabled={!support.recognition && state !== STATE.LISTENING}
            style={{
              ...S.mic,
              ...(state === STATE.LISTENING ? S.micActive : null),
              ...(!support.recognition ? S.micDisabled : null),
            }}
            aria-label={
              state === STATE.LISTENING
                ? tSafe('voice.stop', 'Stop')
                : tSafe('voice.tapToSpeak', 'Tap to speak')
            }
            data-testid="voice-mic"
          >
            {state === STATE.LISTENING ? '\u23F9' : '\uD83C\uDFA4'}
          </button>
          <span style={S.micHint}>
            {state === STATE.LISTENING
              ? tSafe('voice.listening', 'Listening\u2026')
              : !support.recognition
                ? tSafe('voice.notSupported', 'Voice is unavailable. You can still tap a question.')
                : tSafe('voice.tapToSpeak', 'Tap the mic and speak')}
          </span>
          {transcript && (
            <p style={S.transcript} data-testid="voice-transcript">
              {transcript}
            </p>
          )}
        </div>

        {/* ── Answer card ── */}
        {state === STATE.ANSWER && answer && (
          <div style={S.answerCard} data-testid="voice-answer">
            <p style={S.answerText}>{answer}</p>
            <div style={S.answerActions}>
              <button
                type="button"
                onClick={handleReplay}
                style={S.actionBtn}
                data-testid="voice-replay"
              >
                {'\uD83D\uDD0A '}{tSafe('voice.playAnswer', 'Play answer')}
              </button>
              <button
                type="button"
                onClick={handleStopAudio}
                style={S.actionBtnGhost}
                data-testid="voice-stop"
              >
                {tSafe('voice.stop', 'Stop')}
              </button>
            </div>
            {audioFallbackLang && (
              <p style={S.fallbackNote}>
                {tSafe('voice.audioFallback',
                  'Audio for this language is not available on this device.')}
              </p>
            )}
          </div>
        )}

        {/* ── Error footer ── */}
        {state === STATE.ERROR && (
          <div style={S.errorCard} role="alert" data-testid="voice-error">
            <p style={S.errorText}>
              {errorCode === 'denied'
                ? tSafe('voice.permissionDenied',
                    'Microphone permission denied. You can still tap a question.')
                : errorCode === 'offline'
                  ? tSafe('voice.offline',
                      'Voice is unavailable. You can still tap a question.')
                  : errorCode === 'no-speech'
                    ? tSafe('voice.noSpeech',
                        'Did not catch that. Try again.')
                    : tSafe('voice.tryAgain',
                        'Something went wrong. Try again.')}
            </p>
            <button
              type="button"
              onClick={() => { setState(STATE.IDLE); setErrorCode(null); }}
              style={S.actionBtnGhost}
              data-testid="voice-error-dismiss"
            >
              {tSafe('voice.tryAgain', 'Try again')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Map intent id → suggested-question translation key.
function labelKeyFor(intentId) {
  switch (intentId) {
    case 'today_tasks': return 'todayTasks';
    case 'weather':     return 'weatherQuestion';
    case 'watering':    return 'waterQuestion';
    case 'harvest':     return 'harvestQuestion';
    case 'sell':        return 'sellQuestion';
    case 'help':        return 'helpQuestion';
    default:            return intentId;
  }
}

const S = {
  scrim: {
    position: 'fixed', inset: 0,
    background: 'rgba(8, 20, 35, 0.7)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '32rem',
    background: '#0B1D34',
    color: '#EAF2FF',
    borderRadius: '16px 16px 0 0',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 -16px 40px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: '1rem', fontWeight: 700 },
  close: {
    width: 32, height: 32, borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent', color: '#EAF2FF',
    fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.6875rem', color: '#9FB3C8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  suggestedWrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  suggestedGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  suggestedBtn: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    border: '1px solid rgba(34,197,94,0.28)',
    background: 'rgba(34,197,94,0.08)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textAlign: 'left',
    minHeight: 56,
    cursor: 'pointer',
  },
  micArea: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '0.5rem',
    padding: '0.75rem 0',
  },
  mic: {
    width: 64, height: 64, borderRadius: 999,
    border: 'none', background: '#22C55E', color: '#062714',
    fontSize: '1.5rem', cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  micActive: {
    background: '#EF4444', color: '#fff',
    boxShadow: '0 0 0 4px rgba(239,68,68,0.25)',
    transform: 'scale(1.04)',
  },
  micDisabled: {
    opacity: 0.5, cursor: 'not-allowed',
  },
  micHint: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    textAlign: 'center',
  },
  transcript: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    fontSize: '0.875rem',
    color: '#EAF2FF',
    width: '100%',
  },
  answerCard: {
    padding: '0.875rem 1rem',
    borderRadius: 14,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
  },
  answerText: {
    margin: 0,
    fontSize: '0.9375rem', lineHeight: 1.45, color: '#F1F5F9',
  },
  answerActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  actionBtn: {
    padding: '0.5rem 0.875rem', borderRadius: 999,
    border: 'none', background: '#22C55E', color: '#062714',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', minHeight: 36,
  },
  actionBtnGhost: {
    padding: '0.5rem 0.875rem', borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)', background: 'transparent',
    color: '#EAF2FF', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', minHeight: 36,
  },
  fallbackNote: {
    margin: 0, fontSize: '0.75rem', color: '#9FB3C8',
  },
  errorCard: {
    padding: '0.75rem 0.875rem', borderRadius: 12,
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  errorText: { margin: 0, fontSize: '0.8125rem', color: '#FCA5A5' },
};
