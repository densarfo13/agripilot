/**
 * UserFeedbackPrompt — small bottom-anchored card that lets
 * the user tell us what was confusing right after a meaningful
 * action (final feedback-loop spec §1, §8).
 *
 *   <UserFeedbackPrompt screen="scan" onClose={() => ...} />
 *
 * Self-contained:
 *   * 5 fixed options + "Other" (free-form text)
 *   * Tap an option → save + dismiss; one-tap submission.
 *   * "Other" reveals a 200-char text box + a Send button.
 *   * Close (×) icon dismisses without saving.
 *
 * Spec §8 rules — enforced by the parent host (UserFeedbackPromptHost):
 *   * Show max once per session.
 *   * Never on first app open — only when an event fires.
 *   * Never during onboarding — host listens for the request
 *     event but ignores it during onboarding paths.
 *   * Bottom card, NOT a modal. No backdrop.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never blocks user flow — fixed at bottom with safe-area-
 *     inset awareness so it doesn't collide with the home indicator.
 *   * Never throws — store calls are guarded.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  saveFeedback, FEEDBACK_OPTIONS,
} from '../../analytics/userFeedbackStore.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  green: '#22C55E',
  ink:   '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border: 'rgba(255,255,255,0.10)',
  panel:  'rgba(15, 23, 42, 0.96)', // #0F172A near-opaque
};

const S = {
  // Fixed bottom card. Self-honors safe-area-inset-bottom so
  // the iPhone home indicator never overlaps the dismiss row.
  wrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 1100,
    padding: '0 12px 12px',
    pointerEvents: 'none',
  },
  card: {
    pointerEvents: 'auto',
    maxWidth: 520,
    margin: '0 auto',
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '14px 14px 12px',
    color: C.ink,
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: { margin: 0, fontSize: 15, fontWeight: 800 },
  close: {
    appearance: 'none',
    fontFamily: 'inherit',
    background: 'transparent',
    border: 'none',
    color: C.inkSoft,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0 4px',
    minWidth: 28,
    minHeight: 28,
    lineHeight: 1,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  option: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    minHeight: 40,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.32)',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
    fontFamily: 'inherit',
    minHeight: 64,
    resize: 'vertical',
    marginTop: 8,
  },
  sendRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 8 },
  send: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: C.green,
    color: '#062714',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    minHeight: 36,
  },
  thanks: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    textAlign: 'center',
    padding: '6px 4px 2px',
  },
};

export default function UserFeedbackPrompt({ screen, onClose }) {
  // Subscribe so option labels refresh on language change.
  useTranslation();
  const [picked, setPicked]   = useState(null);    // null | feedbackType
  const [otherText, setOther] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Auto-dismiss the success state after 1500ms so the card
  // doesn't linger on the screen after thanks shows.
  useEffect(() => {
    if (!submitted) return undefined;
    const id = setTimeout(() => {
      try { onClose && onClose(); } catch { /* swallow */ }
    }, 1500);
    return () => clearTimeout(id);
  }, [submitted, onClose]);

  function commit(feedbackType, feedbackText = '') {
    try {
      saveFeedback({
        screen,
        feedbackType,
        feedbackText: String(feedbackText || '').slice(0, 400),
      });
    } catch { /* swallow */ }
    setSubmitted(true);
  }

  function handlePick(opt) {
    if (opt.type === 'other') {
      setPicked('other');
      return;
    }
    commit(opt.type, '');
  }

  function handleSendOther() {
    commit('other', otherText);
  }

  function handleClose() {
    try { trackEvent('feedback_prompt_dismissed', { screen }); }
    catch { /* swallow */ }
    try { onClose && onClose(); } catch { /* swallow */ }
  }

  if (submitted) {
    return (
      <div style={S.wrap} aria-live="polite" data-testid="user-feedback-thanks">
        <div style={S.card}>
          <div style={S.thanks}>
            {tStrict('feedback.thanks',
              'Thanks \u2014 we use this to fix the next thing.')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap} data-testid="user-feedback-prompt" data-screen={screen || ''}>
      <div style={S.card} role="dialog" aria-label="Feedback">
        <div style={S.header}>
          <h3 style={S.title}>
            {tStrict('feedback.prompt.title', 'What was confusing?')}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            style={S.close}
            aria-label="Close"
            data-testid="feedback-close"
          >
            {'\u00D7'}
          </button>
        </div>

        {picked !== 'other' ? (
          <div style={S.list}>
            {FEEDBACK_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => handlePick(opt)}
                style={S.option}
                data-testid={`feedback-opt-${opt.type}`}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              style={S.textarea}
              placeholder={tStrict('feedback.other.placeholder',
                'Tell us in one line what didn\u2019t work.')}
              value={otherText}
              onChange={(e) => setOther(e.target.value.slice(0, 400))}
              maxLength={400}
              data-testid="feedback-other-text"
            />
            <div style={S.sendRow}>
              <button
                type="button"
                onClick={handleSendOther}
                style={S.send}
                disabled={!otherText.trim()}
                data-testid="feedback-other-send"
              >
                {tStrict('feedback.other.send', 'Send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
