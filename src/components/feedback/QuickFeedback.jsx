/**
 * QuickFeedback — single-question Yes/No widget with optional
 * reason on "No".
 *
 * Spec safety rules
 *   • At most 1-2 questions, never blocks the user.
 *   • Self-hides when the `feedbackSystem` flag is off.
 *   • Renders nothing once submitted (no nag).
 *   • Never throws.
 *
 * Visible text
 *   All copy routes through tStrict so non-English UIs see the
 *   correct localized string. The spec hardcoded English; we
 *   honor the strict no-leak rule from prior turns.
 *
 * Props
 *   context  e.g. 'daily_plan' — written into the saved entry
 *   prompt   optional override key for the question text
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { saveFeedback, trackEvent } from '../../analytics/analyticsStore.js';

const STYLES = {
  wrap: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
  },
  question: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  btn: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  yes: { background: '#22C55E', color: '#0B1D34' },
  no:  { background: 'rgba(239,68,68,0.85)', color: '#fff' },
  input: {
    marginTop: 8,
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  thanks: {
    margin: 0,
    fontSize: 12,
    color: '#86EFAC',
  },
};

export default function QuickFeedback({ context = 'general', prompt = '' }) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const flagOn = isFeatureEnabled('feedbackSystem');
  const [submitted, setSubmitted] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');

  if (!flagOn) return null;

  if (submitted) {
    return (
      <div style={STYLES.wrap} data-testid="quick-feedback-thanks">
        <p style={STYLES.thanks}>
          {tStrict('feedback.thanks', 'Thanks for your feedback')}
        </p>
      </div>
    );
  }

  const promptText = prompt
    ? tStrict(prompt, '')
    : tStrict('feedback.quick.prompt', 'Was today\u2019s plan helpful?');

  function handleSubmit(value) {
    try {
      saveFeedback({ type: 'quick_feedback', context, value });
      trackEvent('feedback_submitted', { context, value });
    } catch { /* never propagate from analytics */ }
    if (value === 'no') {
      setShowReason(true);
    } else {
      setSubmitted(true);
    }
  }

  function handleReasonBlur() {
    const trimmed = (reason || '').trim();
    if (trimmed) {
      try {
        saveFeedback({ type: 'feedback_reason', context, text: trimmed });
        trackEvent('feedback_reason_added', { context });
      } catch { /* never propagate */ }
    }
    setSubmitted(true);
  }

  return (
    <div style={STYLES.wrap} data-testid="quick-feedback" data-context={context}>
      <p style={STYLES.question}>{promptText}</p>
      <div style={STYLES.row}>
        <button
          type="button"
          onClick={() => handleSubmit('yes')}
          style={{ ...STYLES.btn, ...STYLES.yes }}
          data-testid="quick-feedback-yes"
        >
          {tStrict('feedback.yes', 'Yes')}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('no')}
          style={{ ...STYLES.btn, ...STYLES.no }}
          data-testid="quick-feedback-no"
        >
          {tStrict('feedback.no', 'No')}
        </button>
      </div>
      {showReason ? (
        <input
          autoFocus
          type="text"
          placeholder={tStrict('feedback.reasonPlaceholder', 'What was wrong?')}
          value={reason}
          onChange={(e) => setReason(e.target?.value || '')}
          onBlur={handleReasonBlur}
          style={STYLES.input}
          data-testid="quick-feedback-reason"
        />
      ) : null}
    </div>
  );
}
