/**
 * PulseQuestion — open-ended pulse check after several days of
 * usage. One input, blur to submit, no buttons.
 *
 * Behaviour mirrors the spec § 4 verbatim:
 *   • renders one short prompt + a single text input
 *   • on blur with non-empty text → save + track
 *   • on blur with empty text → just dismiss (no nag)
 *   • once dismissed, render nothing
 *
 * Spec safety rules
 *   • Self-hides when the `feedbackSystem` flag is off.
 *   • All copy via tStrict.
 *   • Never throws.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { saveFeedback, trackEvent } from '../../analytics/analyticsStore.js';

const STYLES = {
  wrap: {
    marginTop: 16,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
  },
  prompt: {
    margin: '0 0 8px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'inherit',
  },
};

export default function PulseQuestion({ context = 'pulse' }) {
  // Subscribe to language change.
  useTranslation();
  const flagOn = isFeatureEnabled('feedbackSystem');
  const [done, setDone] = useState(false);
  if (!flagOn) return null;
  if (done) return null;

  function onBlur(e) {
    const text = (e?.target?.value || '').trim();
    if (text.length > 0) {
      try {
        saveFeedback({ type: 'pulse_feedback', context, text });
        trackEvent('pulse_feedback_submitted', { context });
      } catch { /* never propagate */ }
    }
    setDone(true);
  }

  return (
    <div style={STYLES.wrap} data-testid="pulse-question" data-context={context}>
      <p style={STYLES.prompt}>
        {tStrict('feedback.pulse.prompt', 'How has Farroway been helping you so far?')}
      </p>
      <input
        type="text"
        placeholder={tStrict('feedback.pulse.placeholder', 'Tell us in a few words...')}
        onBlur={onBlur}
        style={STYLES.input}
        data-testid="pulse-input"
      />
    </div>
  );
}
