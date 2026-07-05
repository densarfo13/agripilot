/**
 * JarvisDock.jsx — Jarvis MVP UI: floating mic button + command panel.
 *
 * Honest kernel UI. States: Listening / Thinking / Ready / Need clarification /
 * Offline / Error. Voice via the on-device Web Speech adapter; TEXT INPUT IS THE
 * UNIVERSAL FALLBACK (offline or unsupported → text-only). Every farmer-visible
 * string goes through tSafe (registered in all 6 locale columns).
 *
 * Safety contract:
 *   • Renders null unless the Jarvis flag is ON (default OFF).
 *   • NEVER rendered on the /scan route (Scan render path stays untouched).
 *   • Navigates only — never mutates farm data (journal/save is the farmer's tap).
 *   • Consent gate before insurance flows; history is local-only and deletable.
 *   • All hooks unconditional and above every early return (rules-of-hooks).
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { classify } from '../jarvis/intentClassifier.js';
import { respond } from '../jarvis/farmBrainResponder.js';
import { loadFarmContext } from '../jarvis/farmContextLoader.js';
import { addCommand, listCommands, clearCommands } from '../jarvis/commandHistory.js';
import { trackJarvis } from '../jarvis/jarvisTelemetry.js';
import { isJarvisEnabled, setJarvisEnabled } from '../jarvis/jarvisFlags.js';
import { voiceAvailable, startListening } from '../voice/voiceInput.js';

const C = {
  panel: '#0E1A24', ink: '#EAF2FF', subtle: 'rgba(234,242,255,0.72)',
  line: 'rgba(234,242,255,0.16)', accent: '#C8944D', accentInk: '#08111A',
  green: '#1F6A3A',
};

const S = {
  fab: {
    position: 'fixed', right: 16, bottom: 96, zIndex: 1400,
    width: 56, height: 56, borderRadius: 999, border: 'none', cursor: 'pointer',
    background: C.green, color: '#FFFFFF', fontSize: 24, fontWeight: 700,
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(4,10,16,0.72)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12,
  },
  sheet: {
    width: '100%', maxWidth: 560, maxHeight: '86vh', overflow: 'auto',
    background: C.panel, border: '1px solid ' + C.line, borderRadius: 18,
    padding: 16, boxSizing: 'border-box',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  },
  title: { margin: 0, fontSize: 17, fontWeight: 800, color: C.ink },
  state: { margin: '4px 0 12px', fontSize: 13, fontWeight: 700, color: C.accent },
  answer: { margin: '0 0 10px', fontSize: 15, color: C.ink, lineHeight: 1.5 },
  contextLine: { margin: '0 0 10px', fontSize: 13, color: C.subtle },
  card: {
    background: 'rgba(255,255,255,0.045)', border: '1px solid ' + C.line,
    borderRadius: 14, padding: '12px 14px', marginBottom: 12,
  },
  btnPrimary: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 8, border: 'none',
    borderRadius: 999, background: C.accent, color: C.accentInk, fontSize: 15,
    fontWeight: 700, cursor: 'pointer',
  },
  btnGhost: {
    display: 'block', width: '100%', minHeight: 48, marginTop: 8,
    border: '1px solid ' + C.line, borderRadius: 999, background: 'transparent',
    color: C.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnText: {
    display: 'block', width: '100%', minHeight: 44, marginTop: 4, border: 'none',
    borderRadius: 999, background: 'transparent', color: C.subtle, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
  },
  inputRow: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, minHeight: 48, borderRadius: 12, border: '1px solid ' + C.line,
    background: 'rgba(0,0,0,0.35)', color: C.ink, padding: '0 12px', fontSize: 15,
  },
  send: {
    minHeight: 48, minWidth: 84, borderRadius: 12, border: 'none',
    background: C.green, color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  sectionTitle: { margin: '12px 0 6px', fontSize: 13, fontWeight: 700, color: C.subtle },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    minHeight: 44, padding: '0 14px', borderRadius: 999, border: '1px solid ' + C.line,
    background: 'transparent', color: C.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  recent: { margin: '4px 0 0', fontSize: 13, color: C.subtle, lineHeight: 1.7 },
  privacy: { margin: '14px 0 0', fontSize: 12, color: C.subtle, lineHeight: 1.5 },
};

function _speak(text) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return false;
    const u = new window.SpeechSynthesisUtterance(String(text));
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export default function JarvisDock() {
  // ALL hooks unconditional and above every early return (rules-of-hooks).
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [uiState, setUiState] = React.useState('ready'); // ready|listening|thinking|clarify|offline|error
  const [text, setText] = React.useState('');
  const [reply, setReply] = React.useState(null);        // responder result
  const [pendingConsent, setPendingConsent] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const stopRef = React.useRef(null);

  const canVoice = voiceAvailable();

  const handleCommand = React.useCallback((utterance) => {
    const raw = String(utterance || '').trim();
    if (!raw) return;
    setUiState('thinking'); setStatus(''); setPendingConsent(null);
    try {
      const ctx = loadFarmContext();
      const cls = classify(raw);
      trackJarvis('command_classified', { intent: cls.intent, score: cls.score });
      addCommand(raw, cls.intent);
      setHistory(listCommands());
      const res = respond(cls.intent, ctx);
      setReply(res);
      if (res.clarify) { setUiState('clarify'); return; }
      trackJarvis('command_routed', { intent: cls.intent, consent: !!res.needsConsent });
      if (res.needsConsent) { setPendingConsent(res); setUiState('ready'); return; }
      const spoken = _speak(tSafe(res.answerKey, res.answerFallback));
      if (spoken) trackJarvis('spoken_response_played', {});
      setUiState('ready');
    } catch {
      trackJarvis('command_failed', {});
      setUiState('error');
    }
  }, []);

  const onMic = React.useCallback(() => {
    if (!canVoice) { setUiState('offline'); return; }
    setUiState('listening');
    trackJarvis('voice_record_started', {});
    stopRef.current = startListening({
      lang: 'en',
      onResult: (t) => { trackJarvis('voice_record_completed', {}); handleCommand(t); },
      onError: () => { trackJarvis('voice_transcription_failed', {}); setUiState('error'); },
      onEnd: () => { stopRef.current = null; },
    });
  }, [canVoice, handleCommand]);

  const onOpen = React.useCallback(() => {
    setOpen(true);
    setHistory(listCommands());
    setUiState(canVoice ? 'ready' : 'offline');
    trackJarvis('jarvis_opened', { voice: canVoice });
  }, [canVoice]);

  const onClose = React.useCallback(() => {
    try { if (stopRef.current) stopRef.current(); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const onAction = React.useCallback((action, consented) => {
    if (!action) return;
    trackJarvis('jarvis_action_clicked', { path: action.path, consented: !!consented });
    trackJarvis('command_completed', { path: action.path });
    setOpen(false);
    try { navigate(action.path); } catch { /* router always mounted */ }
  }, [navigate]);

  const onDeleteHistory = React.useCallback(() => {
    clearCommands(); setHistory([]);
    setStatus(tSafe('jarvis.privacy.deleted', 'History deleted'));
  }, []);

  const onDisable = React.useCallback(() => {
    setJarvisEnabled(false); setOpen(false);
  }, []);

  // Hooks done — safe to bail. Flag off → nothing; NEVER on the /scan route.
  if (!isJarvisEnabled()) return null;
  if (String(location.pathname || '').startsWith('/scan')) return null;

  const stateLabel = {
    ready: tSafe('jarvis.state.ready', 'Ready'),
    listening: tSafe('jarvis.state.listening', 'Listening…'),
    thinking: tSafe('jarvis.state.thinking', 'Thinking…'),
    clarify: tSafe('jarvis.state.clarify', 'Need a little more'),
    offline: tSafe('jarvis.state.offline', 'Voice unavailable — type instead'),
    error: tSafe('jarvis.state.error', 'Something went wrong — try typing'),
  }[uiState];

  return (
    <>
      <button type="button" style={S.fab} onClick={onOpen}
        data-testid="jarvis-fab" aria-label={tSafe('jarvis.mic.label', 'Ask Jarvis')}>
        🎤
      </button>
      {open ? (
        <div style={S.overlay} onClick={onClose} data-testid="jarvis-panel" role="dialog" aria-modal="true">
          <div style={S.sheet} onClick={(e) => { try { e.stopPropagation(); } catch { /* ignore */ } }}>
            <h2 style={S.title}>{tSafe('jarvis.title', 'Jarvis')}</h2>
            <p style={S.state} data-testid="jarvis-state" aria-live="polite">{stateLabel}</p>

            {/* Text fallback — always present (the universal path). */}
            <div style={S.inputRow}>
              <input style={S.input} value={text} data-testid="jarvis-text-input"
                placeholder={tSafe('jarvis.input.placeholder', 'Type what you need…')}
                aria-label={tSafe('jarvis.input.placeholder', 'Type what you need…')}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleCommand(text); setText(''); } }} />
              <button type="button" style={S.send} data-testid="jarvis-text-send"
                onClick={() => { handleCommand(text); setText(''); }}>
                {tSafe('jarvis.input.send', 'Ask')}
              </button>
            </div>

            {canVoice ? (
              <button type="button" style={S.btnGhost} onClick={onMic} data-testid="jarvis-mic">
                🎤 {tSafe('jarvis.mic.label', 'Ask Jarvis')}
              </button>
            ) : null}

            {/* Answer + ONE next action */}
            {reply ? (
              <div style={S.card} data-testid="jarvis-action-card">
                <p style={S.answer}>{tSafe(reply.answerKey, reply.answerFallback)}</p>
                {reply.contextLine ? (
                  <p style={S.contextLine}>
                    {tSafe(reply.contextLine.key, reply.contextLine.fallback)}: {reply.contextLine.value}
                  </p>
                ) : null}
                {pendingConsent ? (
                  <>
                    <button type="button" style={S.btnPrimary} data-testid="jarvis-consent-agree"
                      onClick={() => onAction(pendingConsent.action, true)}>
                      {tSafe('jarvis.consent.agree', 'OK, continue')}
                    </button>
                    <button type="button" style={S.btnGhost} data-testid="jarvis-consent-cancel"
                      onClick={() => { setPendingConsent(null); setReply(null); }}>
                      {tSafe('jarvis.consent.cancel', 'Not now')}
                    </button>
                  </>
                ) : (reply.action ? (
                  <button type="button" style={S.btnPrimary} data-testid="jarvis-action-go"
                    onClick={() => onAction(reply.action, false)}>
                    {tSafe(reply.action.labelKey, reply.action.labelFallback)}
                  </button>
                ) : null)}
              </div>
            ) : null}

            {/* Suggested actions */}
            <p style={S.sectionTitle}>{tSafe('jarvis.suggested', 'Try asking')}</p>
            <div style={S.chipRow}>
              {[['jarvis.suggest.today', 'What should I do today?'],
                ['jarvis.suggest.scan', 'Scan my plant'],
                ['jarvis.suggest.weather', 'When should I water?']].map(([k, fb]) => (
                <button key={k} type="button" style={S.chip} data-testid={'jarvis-suggest-' + k.split('.').pop()}
                  onClick={() => handleCommand(tSafe(k, fb))}>
                  {tSafe(k, fb)}
                </button>
              ))}
            </div>

            {/* Recent commands (local-only) */}
            {history.length > 0 ? (
              <>
                <p style={S.sectionTitle}>{tSafe('jarvis.recent', 'Recent commands')}</p>
                <div style={S.recent} data-testid="jarvis-recent">
                  {history.slice(0, 5).map((h, i) => <div key={'h' + i}>• {h.text}</div>)}
                </div>
              </>
            ) : null}

            {status ? <p style={{ ...S.sectionTitle, color: '#86EFAC' }} data-testid="jarvis-status">{status}</p> : null}

            <p style={S.privacy}>
              {tSafe('jarvis.privacy.notice',
                'Your voice stays on this phone. Commands are saved only on this device and you can delete them anytime.')}
            </p>
            <button type="button" style={S.btnText} onClick={onDeleteHistory} data-testid="jarvis-delete-history">
              {tSafe('jarvis.privacy.deleteHistory', 'Delete command history')}
            </button>
            <button type="button" style={S.btnText} onClick={onDisable} data-testid="jarvis-disable">
              {tSafe('jarvis.privacy.disable', 'Turn off Jarvis')}
            </button>
            <button type="button" style={S.btnGhost} onClick={onClose} data-testid="jarvis-close">
              {tSafe('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
