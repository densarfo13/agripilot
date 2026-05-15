/**
 * FarmCopilotSheet — the conversational surface for the Farm
 * Copilot Beta. A calm bottom sheet, NOT a generic chatbot screen.
 *
 *   <FarmCopilotSheet open={open} onClose={fn} />
 *
 * Features (spec §4, §7, §9, §10, §15, §16)
 *   • Typed input + send.
 *   • Voice input via the browser SpeechRecognition API — guarded;
 *     if unavailable or the mic is denied, the typed input simply
 *     stays the path. The copilot NEVER fails on missing voice.
 *   • Cross-session memory — on open, the conversation is restored
 *     from copilotMemory (localStorage-backed, capped). A "Clear"
 *     control wipes it.
 *   • Conversation history capped at MAX_TURNS so memory cannot
 *     bloat (spec §15).
 *   • Suggested starter prompts.
 *   • Tap-to-play speech for any answer (speechSynthesis) — never
 *     autoplays (spec §7).
 *   • Real safe actions: a NAVIGATE reply renders an "Open" button
 *     that routes in-app (non-destructive — no confirmation). A
 *     reply that carries a mutating action shows a Yes / No
 *     confirmation; "Yes" is recorded to memory but the Beta does
 *     not silently mutate — destructive wiring is a tracked
 *     follow-up.
 *
 * Strict-rule audit
 *   • Never throws. Every browser API is feature-detected + wrapped.
 *   • Speaking stops on close / unmount.
 *   • Inline styles only. i18n labels via tSafe.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { askCopilot, SUGGESTED_PROMPTS } from '../../copilot/copilotEngine.js';
import {
  readCopilotMemory, recordTurn, recordRecommendation, clearCopilotMemory,
} from '../../copilot/copilotMemory.js';

// Conversation history cap — bounds memory + render cost (spec §15).
const MAX_TURNS = 24;

function _emit(kind, detail) {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('farroway:copilot', {
        detail: { kind, ...(detail || {}) },
      }));
    }
  } catch { /* telemetry must never break the UI */ }
}

function _getSpeechRecognition() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  } catch { return null; }
}

function _navPathOf(reply) {
  try {
    if (reply && reply.action === 'navigate'
        && reply.actionPayload && typeof reply.actionPayload.path === 'string'
        && reply.actionPayload.path.startsWith('/')) {
      return reply.actionPayload.path;
    }
  } catch { /* swallow */ }
  return null;
}

export default function FarmCopilotSheet({ open, onClose }) {
  const navigate = useNavigate();
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  // Stop any speech when the sheet closes or unmounts.
  const stopSpeaking = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch { /* swallow */ }
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    if (open) _emit('copilot_opened');
    return () => {
      stopSpeaking();
      try { recognitionRef.current && recognitionRef.current.abort(); }
      catch { /* swallow */ }
    };
  }, [open, stopSpeaking]);

  // Cross-session memory — restore the prior conversation on open
  // (spec §7). Only seeds when the sheet has no live messages yet.
  useEffect(() => {
    if (!open) return;
    try {
      const { turns } = readCopilotMemory();
      if (Array.isArray(turns) && turns.length > 0) {
        const seeded = [];
        for (const t of turns) {
          seeded.push({ id: 'mu' + t.at, role: 'user', text: t.question });
          seeded.push({
            id: 'mc' + t.at, role: 'copilot', text: t.answer,
            confidence: 'likely', restored: true,
          });
        }
        setMessages((prev) => (prev.length === 0 ? seeded : prev));
      }
    } catch { /* swallow */ }
  }, [open]);

  useEffect(() => {
    try {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } catch { /* swallow */ }
  }, [messages]);

  const pushTurn = useCallback((turn) => {
    setMessages((prev) => {
      const next = [...prev, turn];
      return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
    });
  }, []);

  const ask = useCallback((rawText) => {
    const text = String(rawText || '').trim();
    if (!text) return;
    pushTurn({ id: 'u' + Date.now(), role: 'user', text });
    setInput('');
    let reply;
    try {
      reply = askCopilot(text);
    } catch {
      reply = { answer: tSafe('copilot.error', 'Something went wrong. Please try again.'),
                requiresConfirmation: false, confidence: 'limited', intent: 'error' };
    }
    _emit('copilot_answered', { intent: reply.intent, confidence: reply.confidence });
    pushTurn({
      id: 'c' + Date.now(),
      role: 'copilot',
      text: reply.answer,
      intent: reply.intent || 'unknown',
      confidence: reply.confidence,
      requiresConfirmation: !!reply.requiresConfirmation,
      navPath: _navPathOf(reply),
      confirmed: false,
    });
    // Persist the turn so re-opening the copilot restores it.
    try { recordTurn({ question: text, answer: reply.answer, intent: reply.intent }); }
    catch { /* swallow */ }
  }, [pushTurn]);

  const speak = useCallback((id, text) => {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      if (speakingId === id) { setSpeakingId(null); return; }
      const u = new window.SpeechSynthesisUtterance(String(text || ''));
      u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(u);
      setSpeakingId(id);
      _emit('copilot_spoken');
    } catch { setSpeakingId(null); }
  }, [speakingId]);

  const startVoice = useCallback(() => {
    const SR = _getSpeechRecognition();
    if (!SR) {
      // No voice support — typed input stays the path. Never fail.
      _emit('copilot_voice_unavailable');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        try {
          const said = e.results[0][0].transcript;
          if (said) ask(said);
        } catch { /* swallow */ }
      };
      rec.onerror = () => { setListening(false); _emit('copilot_voice_denied'); };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      _emit('copilot_voice_started');
    } catch {
      setListening(false);
    }
  }, [ask]);

  // Safe NAVIGATE action — non-destructive, no confirmation needed.
  const goTo = useCallback((path) => {
    _emit('copilot_navigate', { path });
    try { onClose && onClose(); } catch { /* swallow */ }
    try { navigate(path); } catch { /* swallow */ }
  }, [navigate, onClose]);

  const resolveConfirm = useCallback((id, accepted) => {
    let intent = 'unknown';
    setMessages((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      intent = m.intent || 'unknown';
      return { ...m, requiresConfirmation: false, confirmed: accepted };
    }));
    try { recordRecommendation({ intent, accepted }); } catch { /* swallow */ }
    _emit(accepted ? 'copilot_action_confirmed' : 'copilot_action_declined', { intent });
    pushTurn({
      id: 'c' + Date.now(),
      role: 'copilot',
      text: accepted
        ? tSafe('copilot.actionNoted', 'Noted. Open Tasks to see it — I won’t change anything on its own.')
        : tSafe('copilot.actionCancelled', 'Okay, I won’t do that.'),
      confidence: 'likely',
      requiresConfirmation: false,
    });
  }, [pushTurn]);

  const clearHistory = useCallback(() => {
    try { clearCopilotMemory(); } catch { /* swallow */ }
    setMessages([]);
    _emit('copilot_memory_cleared');
  }, []);

  if (!open) return null;

  const voiceSupported = !!_getSpeechRecognition();

  return (
    <div style={S.overlay} onClick={onClose} data-testid="farm-copilot-sheet">
      <div style={S.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tSafe('copilot.title', 'Farm Copilot')}>
        <div style={S.header}>
          <div>
            <div style={S.title}>{tSafe('copilot.title', 'Farm Copilot')}</div>
            <div style={S.betaTag}>{tSafe('copilot.betaTag', 'Beta')}</div>
          </div>
          <div style={S.headerActions}>
            {messages.length > 0 && (
              <button type="button" onClick={clearHistory} style={S.clearBtn} data-testid="farm-copilot-clear">
                {tSafe('copilot.clear', 'Clear')}
              </button>
            )}
            <button type="button" onClick={onClose} style={S.closeBtn} aria-label={tSafe('common.close', 'Close')}>
              {'✕'}
            </button>
          </div>
        </div>

        <div style={S.history} ref={scrollRef}>
          {messages.length === 0 && (
            <p style={S.empty}>
              {tSafe('copilot.intro', 'Ask me about today’s tasks, your last scan, watering, or what needs attention.')}
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} style={m.role === 'user' ? S.userRow : S.copilotRow}>
              <div style={m.role === 'user' ? S.userBubble : S.copilotBubble}>
                {m.text}
                {m.role === 'copilot' && m.confidence === 'limited' && (
                  <span style={S.lowConf}>{tSafe('copilot.lowConfidence', 'Low certainty')}</span>
                )}
              </div>
              {m.role === 'copilot' && (
                <div style={S.bubbleActions}>
                  <button type="button" style={S.miniBtn} onClick={() => speak(m.id, m.text)}>
                    {speakingId === m.id
                      ? tSafe('copilot.stop', 'Stop')
                      : tSafe('copilot.play', 'Play')}
                  </button>
                  {m.navPath && (
                    <button
                      type="button"
                      style={S.openBtn}
                      onClick={() => goTo(m.navPath)}
                      data-testid="farm-copilot-open"
                    >
                      {tSafe('copilot.open', 'Open')}
                    </button>
                  )}
                </div>
              )}
              {m.role === 'copilot' && m.requiresConfirmation && (
                <div style={S.confirmRow}>
                  <span style={S.confirmText}>{tSafe('copilot.confirm', 'Do you want me to do that?')}</span>
                  <button type="button" style={S.yesBtn} onClick={() => resolveConfirm(m.id, true)}>
                    {tSafe('common.yes', 'Yes')}
                  </button>
                  <button type="button" style={S.noBtn} onClick={() => resolveConfirm(m.id, false)}>
                    {tSafe('common.no', 'No')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {messages.length === 0 && (
          <div style={S.prompts}>
            {SUGGESTED_PROMPTS.map((p) => (
              <button key={p} type="button" style={S.promptChip} onClick={() => ask(p)}>
                {p}
              </button>
            ))}
          </div>
        )}

        <div style={S.inputRow}>
          {voiceSupported && (
            <button
              type="button"
              onClick={startVoice}
              style={{ ...S.voiceBtn, ...(listening ? S.voiceBtnActive : null) }}
              aria-label={tSafe('copilot.speak', 'Speak')}
              data-testid="farm-copilot-voice"
            >
              {listening ? tSafe('copilot.listening', 'Listening…') : '🎤'}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(input); }}
            placeholder={tSafe('copilot.placeholder', 'Type your question')}
            style={S.input}
            data-testid="farm-copilot-input"
          />
          <button type="button" onClick={() => ask(input)} style={S.sendBtn}>
            {tSafe('copilot.send', 'Ask')}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 120,
    background: 'rgba(8,17,26,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '32rem',
    background: '#0E1F2C',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column',
    maxHeight: '82vh',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  title: { fontSize: '1rem', fontWeight: 800, color: '#EAF2FF' },
  betaTag: {
    fontSize: '0.625rem', fontWeight: 800, color: '#86EFAC',
    letterSpacing: '0.05em', textTransform: 'uppercase',
  },
  clearBtn: {
    height: 32, padding: '0 0.7rem', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'transparent', color: '#9FB3C8',
    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.08)', color: '#EAF2FF',
    cursor: 'pointer', fontSize: '0.85rem',
  },
  history: {
    flex: 1, overflowY: 'auto', padding: '0.85rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  empty: { color: '#9FB3C8', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 },
  userRow:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  copilotRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  userBubble: {
    background: '#1F6F54', color: '#FFFFFF',
    padding: '0.55rem 0.8rem', borderRadius: 14, borderBottomRightRadius: 4,
    fontSize: '0.9rem', maxWidth: '85%',
  },
  copilotBubble: {
    background: 'rgba(255,255,255,0.07)', color: '#EAF2FF',
    padding: '0.55rem 0.8rem', borderRadius: 14, borderBottomLeftRadius: 4,
    fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '90%',
  },
  lowConf: {
    display: 'block', marginTop: '0.35rem',
    fontSize: '0.6875rem', fontWeight: 700, color: '#F0CB7A',
  },
  bubbleActions: { marginTop: '0.25rem', display: 'flex', gap: '0.35rem' },
  miniBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.16)',
    color: '#9FB3C8', borderRadius: 8, padding: '0.2rem 0.55rem',
    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
  },
  openBtn: {
    background: 'rgba(31,111,84,0.22)', border: '1px solid rgba(134,239,172,0.32)',
    color: '#86EFAC', borderRadius: 8, padding: '0.2rem 0.6rem',
    fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    marginTop: '0.4rem', flexWrap: 'wrap',
  },
  confirmText: { fontSize: '0.8rem', color: '#9FB3C8' },
  yesBtn: {
    background: '#1F6F54', color: '#FFFFFF', border: 'none',
    borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 700,
    fontSize: '0.8rem', cursor: 'pointer',
  },
  noBtn: {
    background: 'transparent', color: '#EAF2FF',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 600,
    fontSize: '0.8rem', cursor: 'pointer',
  },
  prompts: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
    padding: '0 1rem 0.6rem',
  },
  promptChip: {
    background: 'rgba(200,148,77,0.12)', color: '#E0B873',
    border: '1px solid rgba(200,148,77,0.30)',
    borderRadius: 999, padding: '0.35rem 0.7rem',
    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  },
  inputRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.7rem 1rem 0.9rem', borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  voiceBtn: {
    width: 40, height: 40, flexShrink: 0,
    borderRadius: 999, border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.06)', color: '#EAF2FF',
    cursor: 'pointer', fontSize: '1rem',
  },
  voiceBtnActive: { background: '#C8944D', color: '#FFFFFF', borderColor: '#C8944D' },
  input: {
    flex: 1, minWidth: 0,
    background: 'rgba(255,255,255,0.06)', color: '#EAF2FF',
    border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10,
    padding: '0.55rem 0.7rem', fontSize: '0.9rem', fontFamily: 'inherit',
  },
  sendBtn: {
    flexShrink: 0,
    background: '#1F6F54', color: '#FFFFFF', border: 'none',
    borderRadius: 10, padding: '0.55rem 0.95rem',
    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
  },
};
