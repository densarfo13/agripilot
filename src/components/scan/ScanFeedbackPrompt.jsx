/**
 * ScanFeedbackPrompt — small inline card rendered below the
 * scan result that asks "Was this helpful?" and forwards the
 * answer to /api/scan/feedback for ML training (advanced ML
 * scan layer spec §9).
 *
 *   <ScanFeedbackPrompt scanId={result.scanId} />
 *
 * UX rules
 *   * Three taps: Yes / No / Not sure — one-tap submit.
 *   * Show "Thanks — we use this to improve" briefly, then
 *     self-dismiss.
 *   * Never blocks the user. Failure to POST is silent.
 *   * Once submitted for a given scanId, the prompt does NOT
 *     re-show on subsequent renders (sessionStorage flag).
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — fetch + storage calls are guarded.
 *   * Posts via the existing api client when available; falls
 *     back to a fire-and-forget fetch with a 1500 ms abort.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border:  'rgba(255,255,255,0.10)',
  green:   '#22C55E',
  amber:   '#F59E0B',
};

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '14px 16px',
    margin: '12px 0',
    color: C.ink,
  },
  title: { margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: C.inkSoft },
  q:     { margin: '6px 0 10px', fontSize: 15, fontWeight: 700, color: C.ink },
  row:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill:  {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    minHeight: 36,
  },
  thanks: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    textAlign: 'center',
    padding: '4px 0 2px',
  },
};

const SUBMITTED_KEY_PREFIX = 'farroway_scan_feedback_done:';

function _wasSubmitted(scanId) {
  if (!scanId) return false;
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(SUBMITTED_KEY_PREFIX + scanId) === 'true';
  } catch { return false; }
}

function _markSubmitted(scanId) {
  if (!scanId) return;
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SUBMITTED_KEY_PREFIX + scanId, 'true');
  } catch { /* swallow */ }
}

async function _postFeedback(scanId, userFeedback) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await fetch('/api/scan/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId, userFeedback }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch { /* swallow */ }
}

export default function ScanFeedbackPrompt({ scanId }) {
  useTranslation();
  const [submitted, setSubmitted] = useState(() => _wasSubmitted(scanId));

  useEffect(() => {
    if (!submitted) return undefined;
    const id = setTimeout(() => { /* allow component to fade */ }, 1500);
    return () => clearTimeout(id);
  }, [submitted]);

  function handlePick(value) {
    if (!scanId) return;
    if (submitted) return;
    setSubmitted(true);
    _markSubmitted(scanId);
    try { trackEvent('scan_feedback', { scanId, value }); }
    catch { /* swallow */ }
    _postFeedback(scanId, value);
  }

  if (!scanId) return null;

  if (submitted) {
    return (
      <section style={S.card} data-testid="scan-feedback-thanks">
        <div style={S.thanks}>
          {tStrict('scan.feedback.thanks',
            'Thanks \u2014 we use this to improve.')}
        </div>
      </section>
    );
  }

  return (
    <section style={S.card} data-testid="scan-feedback-prompt">
      <span style={S.title}>
        {tStrict('scan.feedback.title', 'Helpful?')}
      </span>
      <p style={S.q}>
        {tStrict('scan.feedback.question', 'Was this guidance helpful?')}
      </p>
      <div style={S.row}>
        <button
          type="button"
          onClick={() => handlePick('helpful')}
          style={S.pill}
          data-testid="scan-feedback-yes"
        >
          {tStrict('scan.feedback.yes', 'Yes')}
        </button>
        <button
          type="button"
          onClick={() => handlePick('not_helpful')}
          style={S.pill}
          data-testid="scan-feedback-no"
        >
          {tStrict('scan.feedback.no', 'No')}
        </button>
        <button
          type="button"
          onClick={() => handlePick('not_sure')}
          style={S.pill}
          data-testid="scan-feedback-not-sure"
        >
          {tStrict('scan.feedback.notSure', 'Not sure')}
        </button>
      </div>
    </section>
  );
}
