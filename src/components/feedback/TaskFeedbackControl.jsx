/**
 * TaskFeedbackControl — non-intrusive feedback widget for the
 * Home task card. Two primary actions:
 *
 *   👍 Helpful    → logs task_feedback({ type: 'helpful' })
 *   👎 Not right  → reveals a small menu with three reasons:
 *                    • Doesn't match my field  (doesnt_match)
 *                    • I already did this       (already_did)
 *                    • Not clear                 (not_clear)
 *
 * The control is deliberately small and optional — it sits as a
 * row of muted icon buttons beneath the task, and the 👎 path
 * expands inline without blocking the UX.
 *
 * Events flow through the caller-supplied `onFeedback` or through
 * recordTaskFeedback() from outcomeTracking.js — this component
 * only handles UI.
 */

import { useState } from 'react';
import { recordTaskFeedback } from '../../utils/outcomeTracking.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const REASON_OPTIONS = [
  { id: 'doesnt_match', key: 'closing_gaps.feedback.doesnt_match',
    fallback: 'Doesn\u2019t match my field' },
  { id: 'already_did',  key: 'closing_gaps.feedback.already_did',
    fallback: 'I already did this' },
  { id: 'not_clear',    key: 'closing_gaps.feedback.not_clear',
    fallback: 'Not clear' },
];

export default function TaskFeedbackControl({
  task = null,
  t = null,
  onFeedback = null,
  countryCode = null,
  cropId = null,
  stage = null,
  logEvent = null,
  className = '',
}) {
  const [pending, setPending] = useState(null); // 'helpful' | 'not_right' | null
  const [submittedType, setSubmittedType] = useState(null);

  function submit(type, reason = null) {
    const feedback = { type, reason };
    if (typeof onFeedback === 'function') {
      onFeedback(feedback);
    }
    recordTaskFeedback(task, feedback, {
      logEvent, countryCode, cropId, stage,
    });
    setSubmittedType(type);
    setPending(null);
  }

  // Once feedback is submitted, show a muted thank-you line that
  // doesn't compete with the task card.
  if (submittedType) {
    return (
      <div
        className={`task-feedback task-feedback--submitted ${className}`.trim()}
        aria-live="polite"
        style={{ marginTop: 10, color: '#78909c', fontSize: 12, fontStyle: 'italic' }}
      >
        {resolve(t, 'closing_gaps.feedback.thanks', 'Thanks — we\u2019ll use this.')}
      </div>
    );
  }

  return (
    <div className={`task-feedback ${className}`.trim()} style={{ marginTop: 10 }}>
      {pending !== 'not_right' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#90a4ae', fontSize: 12 }}>
            {resolve(t, 'closing_gaps.feedback.prompt',
              'Does this match your field?')}
          </span>
          <button
            type="button"
            onClick={() => submit('helpful')}
            aria-label={resolve(t, 'closing_gaps.feedback.helpful', 'Helpful')}
            style={btnStyle}
          >
            👍 <span style={{ marginLeft: 4, fontSize: 12 }}>
              {resolve(t, 'closing_gaps.feedback.helpful', 'Helpful')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPending('not_right')}
            aria-label={resolve(t, 'closing_gaps.feedback.not_right', 'Not right')}
            style={btnStyle}
          >
            👎 <span style={{ marginLeft: 4, fontSize: 12 }}>
              {resolve(t, 'closing_gaps.feedback.not_right', 'Not right')}
            </span>
          </button>
        </div>
      )}

      {pending === 'not_right' && (
        <div
          className="task-feedback__reasons"
          role="group"
          aria-label={resolve(t, 'closing_gaps.feedback.why_not_right',
            'Tell us why')}
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span style={{ color: '#90a4ae', fontSize: 12, marginRight: 6 }}>
            {resolve(t, 'closing_gaps.feedback.why_not_right',
              'Tell us why')}
          </span>
          {REASON_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => submit('not_right', opt.id)}
              style={reasonBtnStyle}
            >
              {resolve(t, opt.key, opt.fallback)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPending(null)}
            aria-label={resolve(t, 'closing_gaps.feedback.cancel', 'Cancel')}
            style={{ ...reasonBtnStyle, color: '#90a4ae' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  background: 'transparent',
  border: '1px solid #cfd8dc',
  color: '#455a64',
  padding: '4px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
};
const reasonBtnStyle = {
  background: '#eceff1',
  border: 0,
  color: '#37474f',
  padding: '4px 10px',
  borderRadius: 14,
  cursor: 'pointer',
  fontSize: 12,
};
