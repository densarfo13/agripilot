/**
 * FollowUpPrompt.jsx — "What happened?" prompt for the 3 / 7 / 14
 * day recommendation follow-up.
 *
 *   <FollowUpPrompt
 *     scanId="scan_xxx"
 *     recommendation="lime application"
 *     dayOffset={3}
 *     category="soil"
 *     crop="tomato"
 *     region="Maryland"
 *     onCaptured={(result) => {}}
 *   />
 *
 * Three buttons: Improved / No Change / Worse. Self-collapses
 * after the user taps. Never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { recordFollowUpOutcome } from
  '../../runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker';

function FollowUpPromptInner(props) {
  const {
    scanId, recommendation, dayOffset, category,
    crop, region, season, taskId, onCaptured,
  } = props || {};
  const [status, setStatus] = React.useState('pending');
  const [saving, setSaving] = React.useState(false);

  const tap = React.useCallback(async (result) => {
    if (saving || status !== 'pending') return;
    setSaving(true);
    try {
      const res = await recordFollowUpOutcome({
        scanId:         String(scanId || ''),
        recommendation: String(recommendation || ''),
        dayOffset:      Number(dayOffset) || 3,
        result,
        category:       category || 'other',
        crop, region, season, taskId,
      });
      if (res && res.ok) {
        setStatus(result);
        if (typeof onCaptured === 'function') {
          try { onCaptured(result); } catch { /* swallow */ }
        }
      } else {
        setStatus('error');
      }
    } finally {
      setSaving(false);
    }
  }, [scanId, recommendation, dayOffset, category, crop, region, season, taskId, saving, status, onCaptured]);

  if (status === 'pending' || status === 'error') {
    return (
      <div
        style={S.wrap}
        data-testid="follow-up-prompt"
        data-scan-id={scanId || ''}
        data-day-offset={String(dayOffset || 0)}>
        <p style={S.eyebrow}>
          {tSafe('outcomes.followUp.day', 'Day')} {dayOffset || ''} —
          {' '}<span style={S.recHint}>{recommendation || tSafe('outcomes.followUp.rec', 'recommendation')}</span>
        </p>
        <p style={S.q}>{tSafe('outcomes.followUp.question', 'What happened?')}</p>
        <div style={S.btnRow}>
          <button type="button" style={S.btnYes}
            disabled={saving} onClick={() => tap('improved')}
            data-testid="follow-up-improved">
            {tSafe('outcomes.followUp.improved', 'Improved')}
          </button>
          <button type="button" style={S.btnPartial}
            disabled={saving} onClick={() => tap('same')}
            data-testid="follow-up-same">
            {tSafe('outcomes.followUp.same', 'No Change')}
          </button>
          <button type="button" style={S.btnNo}
            disabled={saving} onClick={() => tap('worse')}
            data-testid="follow-up-worse">
            {tSafe('outcomes.followUp.worse', 'Worse')}
          </button>
        </div>
        {status === 'error' ? (
          <p style={S.err}>{tSafe('outcomes.followUp.error', 'Could not save — try again.')}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div style={S.wrap} data-testid="follow-up-prompt-done"
      data-scan-id={scanId || ''}
      data-day-offset={String(dayOffset || 0)}>
      <p style={S.done}>
        ✓ {tSafe('outcomes.followUp.recorded', 'Recorded')}: <strong>{status}</strong>
      </p>
    </div>
  );
}

export default class FollowUpPrompt extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <FollowUpPromptInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
    fontFamily: 'system-ui',
  },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  recHint: { fontWeight: 700, color: 'rgba(60,72,55,0.75)',
    textTransform: 'none', letterSpacing: 0 },
  q: { margin: 0, fontSize: 13, fontWeight: 700, color: '#1F2933' },
  btnRow: { display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnYes: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', flex: 1, minWidth: 84 },
  btnPartial: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#9a6a00', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', flex: 1, minWidth: 84 },
  btnNo: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#a13a3a', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', flex: 1, minWidth: 84 },
  done: { margin: 0, fontSize: 13, color: '#2f7a3a', fontWeight: 700 },
  err: { margin: 0, fontSize: 12, color: '#a13a3a' },
};
