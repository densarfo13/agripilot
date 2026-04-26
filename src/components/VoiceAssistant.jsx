/**
 * VoiceAssistant — floating voice-first navigation button.
 *
 * Goal: a farmer who cannot read should be able to navigate the app
 * by speaking. Tap the floating mic at the bottom centre of the
 * screen, hear a localized prompt ("What do you want to do?"), say
 * one of a small fixed set of words ("farm", "tasks", "harvest",
 * "scan", "weather"), and the app navigates there.
 *
 * Design rules (per spec)
 * ───────────────────────
 *   • No NLP. Pure keyword matching against a fixed list.
 *   • Listens once per tap (one-shot recognition session — see
 *     voice/voiceEngine.js).
 *   • If nothing matches, speak the "didn't understand" hint and
 *     stop. Farmer can tap again.
 *   • Visible text routes through tStrict so non-English UIs never
 *     leak English.
 *   • Speech goes through the existing voiceEngine, which delegates
 *     to the 3-tier voiceService when available (prerecorded clips
 *     for Twi, provider TTS for en/fr/sw, browser TTS as fallback).
 *
 * Why a floating component instead of a fixed widget per page
 * ───────────────────────────────────────────────────────────
 * Mounting once at App level (next to <Routes>) means every farmer-
 * facing page gets the same button at the same position with no
 * per-page wiring. The component is `position: fixed; bottom: 16px;
 * left: 50%; transform: translateX(-50%)`, so it floats above the
 * page content on every route.
 *
 * Routes
 * ──────
 * Spec-listed targets are /farm /tasks /harvest /scan /weather.
 * Some of those don't exist as top-level routes in this codebase —
 * we keep the spoken keyword the same but resolve to the closest
 * existing path so the navigation actually works:
 *
 *     keyword     →  spec route   →  resolved real route
 *     ────────────────────────────────────────────────────
 *     farm        →  /farm        →  /my-farm     (MyFarmPage)
 *     tasks       →  /tasks       →  /tasks       (AllTasksPage)
 *     harvest     →  /harvest     →  /my-farm     (hosts HarvestCard)
 *     scan        →  /scan        →  /scan-crop   (CameraScanPage)
 *     weather     →  /weather     →  /today       (FarmerTodayPage)
 *
 * The COMMAND_MAP table below is exported so an integrator can swap
 * targets without editing the listener.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import {
  speak,
  speakKey,
  stopSpeaking,
  startListening,
  isSpeakSupported,
  isListenSupported,
} from '../voice/voiceEngine.js';
import useLowLiteracyMode from '../hooks/useLowLiteracyMode.js';

// ─── Command map ─────────────────────────────────────────────
//
// Each entry: keyword (lowercased substring) → route the navigator
// resolves to. Order matters — first match wins, so list more
// specific phrases before more general ones (e.g. "today tasks"
// before "today").
export const COMMAND_MAP = Object.freeze([
  // farm
  { match: ['my farm', 'check my farm', 'farm'], route: '/my-farm', key: 'farmerActions.myFarm' },
  // tasks
  { match: ['today tasks', "today's tasks", 'todays tasks', 'tasks', 'task'], route: '/tasks', key: 'farmerActions.tasks' },
  // progress — FarmerProgressPage at /progress
  { match: ['progress', 'my progress', 'how am i doing'], route: '/progress', key: 'farmerActions.progress' },
  // harvest — HarvestCard is on MyFarmPage
  { match: ['record harvest', 'harvest'], route: '/my-farm', key: 'farmerActions.recordHarvest' },
  // scan crop
  { match: ['scan crop', 'scan'], route: '/scan-crop', key: 'farmerActions.scanCrop' },
  // weather — FarmerTodayPage carries the weather card
  { match: ['weather', 'check weather'], route: '/today', key: 'farmerActions.weather' },
  // buyers — Market access surface (admin-restricted in this build,
  // but the spoken command is wired so a permitted user reaches it).
  { match: ['buyers', 'market access', 'market'], route: '/buyers', key: 'farmerActions.buyers' },
]);

/**
 * Pure keyword resolver — exported so tests / integrators can drop
 * in a different transcript without rendering the component.
 *
 * @param {string} transcript  whatever the recognizer returned
 * @returns {{route: string, key: string} | null}
 */
export function resolveCommand(transcript) {
  if (!transcript) return null;
  const normalised = String(transcript).toLowerCase().trim();
  if (!normalised) return null;
  for (const entry of COMMAND_MAP) {
    for (const phrase of entry.match) {
      if (normalised.includes(phrase)) {
        return { route: entry.route, key: entry.key };
      }
    }
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────

const STATE = Object.freeze({
  IDLE:      'idle',
  PROMPTING: 'prompting',  // speaking the "what do you want to do" prompt
  LISTENING: 'listening',
  RESOLVING: 'resolving',
  ERROR:     'error',
});

export default function VoiceAssistant() {
  // HOTFIX (Apr 2026): hooks must be called unconditionally at the
  // top of the component (Rules of Hooks). The previous
  // `try { useNavigate(); } catch { return null }` IIFE looked
  // safe — useNavigate doesn't actually throw at call-time when
  // mounted inside a Router — but conditional hook invocation
  // desyncs React's internal hook counter under StrictMode dev
  // re-renders, surfacing as "Rendered more hooks than during the
  // previous render" → ErrorBoundary fires → "Something went wrong".
  // Mounted inside <BrowserRouter> in App.jsx so this is safe.
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const { enabled: simpleMode } = useLowLiteracyMode();
  const [state, setState] = useState(STATE.IDLE);
  const abortRef = useRef(null);

  // Cleanup on unmount: any in-flight prompt or listener.
  useEffect(() => () => {
    try { stopSpeaking(); } catch { /* ignore */ }
    try { abortRef.current?.(); } catch { /* ignore */ }
  }, []);

  const speakSupported   = isSpeakSupported();
  const listenSupported  = isListenSupported();
  const supported        = speakSupported && listenSupported;

  const handleTranscript = useCallback((text) => {
    setState(STATE.RESOLVING);
    const match = resolveCommand(text);
    if (match) {
      // Confirm the destination aloud before routing — gives the
      // farmer a moment to realise the app understood, and the
      // navigation is instantaneous so they hear "Tasks" → screen
      // changes.
      speakKey(match.key, lang || 'en', tStrict(match.key, ''));
      try { navigate?.(match.route); } catch { /* ignore */ }
      setState(STATE.IDLE);
      return;
    }
    // No match — speak the fallback hint.
    const hint = tStrict(
      'voiceNav.notUnderstood',
      "I didn't understand. Try saying tasks or farm.",
    );
    speak(hint, lang || 'en');
    setState(STATE.IDLE);
  }, [lang, navigate]);

  const beginListening = useCallback(() => {
    setState(STATE.LISTENING);
    abortRef.current = startListening(
      handleTranscript,
      lang || 'en',
      {
        onError: () => {
          // Common: 'no-speech', 'not-allowed', 'aborted'. Treat
          // them all the same — drop back to idle. The user can
          // tap again. We do NOT speak on 'aborted' (user pressed
          // again to cancel) — checked via state below.
          setState((cur) => (cur === STATE.LISTENING ? STATE.IDLE : cur));
        },
      },
    );
  }, [handleTranscript, lang]);

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (!supported) return;

    // If we're already listening, treat the second tap as cancel.
    if (state === STATE.LISTENING) {
      try { abortRef.current?.(); } catch { /* ignore */ }
      try { stopSpeaking(); } catch { /* ignore */ }
      setState(STATE.IDLE);
      return;
    }
    if (state === STATE.PROMPTING) {
      // Double-tap during the prompt: skip prompt, start listening.
      try { stopSpeaking(); } catch { /* ignore */ }
      beginListening();
      return;
    }

    // Fresh tap: speak the prompt, then start listening.
    setState(STATE.PROMPTING);
    const promptText = tStrict('voiceNav.prompt', 'What do you want to do?');
    // Speak via the key-aware path so we hit the prerecorded /
    // provider-TTS tier when available.
    speakKey('voiceNav.prompt', lang || 'en', promptText);
    // The Web Speech API's `onend` event for SpeechSynthesis is
    // unreliable across browsers (esp. mobile Safari). Use a short
    // timeout based on text length instead — gives us deterministic
    // behaviour across the 6 supported languages.
    const ms = Math.min(2400, 600 + promptText.length * 55);
    setTimeout(() => {
      // Only auto-advance to listening if the user hasn't tapped
      // again to cancel (state would be IDLE).
      setState((cur) => {
        if (cur !== STATE.PROMPTING) return cur;
        try { beginListening(); } catch { /* ignore */ }
        return STATE.LISTENING;
      });
    }, ms);
  }, [state, supported, lang, beginListening]);

  // Render nothing if neither tier is available — no point in a
  // floating button that can't speak or hear. Component still
  // mounts and unmounts cleanly.
  if (!supported) return null;

  const ariaLabel = tStrict('voiceNav.tap', 'Voice assistant');
  const status =
    state === STATE.PROMPTING ? tStrict('voiceNav.prompting', '') :
    state === STATE.LISTENING ? tStrict('voiceNav.listening', '') :
    state === STATE.RESOLVING ? tStrict('voiceNav.resolving', '') :
    '';

  const wrapStyle = {
    position: 'fixed',
    left: '50%',
    bottom: 16,
    transform: 'translateX(-50%)',
    zIndex: 70,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'none', // children opt back in
  };

  const btnStyle = {
    pointerEvents: 'auto',
    width: simpleMode ? 76 : 64,
    height: simpleMode ? 76 : 64,
    borderRadius: '50%',
    border: '1px solid rgba(34,197,94,0.45)',
    background:
      state === STATE.LISTENING ? 'rgba(239,68,68,0.22)'
      : state === STATE.PROMPTING ? 'rgba(245,158,11,0.22)'
      : 'rgba(34,197,94,0.22)',
    color: '#fff',
    fontSize: simpleMode ? 36 : 30,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 120ms ease, background 200ms ease',
  };

  const statusStyle = {
    pointerEvents: 'none',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(11,29,52,0.9)',
    padding: '2px 10px',
    borderRadius: 999,
    maxWidth: '60vw',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div style={wrapStyle} className={'voice-assistant voice-assistant--' + state}>
      {status ? <span style={statusStyle}>{status}</span> : null}
      <button
        type="button"
        onClick={onClick}
        style={btnStyle}
        aria-label={ariaLabel}
        aria-pressed={state === STATE.LISTENING}
        data-testid="voice-assistant-btn"
        data-i18n-skip
      >
        <span aria-hidden="true">
          {state === STATE.LISTENING ? '🎙' : '🎤'}
        </span>
      </button>
    </div>
  );
}
