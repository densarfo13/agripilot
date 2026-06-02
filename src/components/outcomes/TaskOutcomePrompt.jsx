/**
 * TaskOutcomePrompt.jsx — "Did you complete this task?" prompt.
 *
 *   <TaskOutcomePrompt
 *     taskId="task_xxx"
 *     scanId="scan_xxx"
 *     recommendation="apply lime"
 *     onCaptured={(completion) => {}}
 *   />
 *
 * Three buttons: Yes / Partially / No. Self-collapses to a
 * confirmation row after the user taps. Never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { recordTaskOutcome } from
  '../../runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker';

function TaskOutcomePromptInner(props) {
  const { taskId, scanId, recommendation, onCaptured } = props || {};
  const [status, setStatus] = React.useState('pending');
  const [saving, setSaving] = React.useState(false);

  const tap = React.useCallback(async (completion) => {
    if (saving || status !== 'pending') return;
    setSaving(true);
    try {
      const res = await recordTaskOutcome({
        taskId: String(taskId || ''),
        completion,
        scanId,
        recommendation,
      });
      if (res && res.ok) {
        setStatus(completion);
        if (typeof onCaptured === 'function') {
          try { onCaptured(completion); } catch { /* swallow */ }
        }
      } else {
        setStatus('error');
      }
    } finally {
      setSaving(false);
    }
  }, [taskId, scanId, recommendation, saving, status, onCaptured]);

  if (status === 'pending' || status === 'error') {
    return (
      <div
        style={S.wrap}
        data-testid="task-outcome-prompt"
        data-task-id={taskId || ''}>
        <p style={S.q}>{tSafe('outcomes.task.question', 'Did you complete this task?')}</p>
        <div style={S.btnRow}>
          <button type="button" style={S.btnYes}
            disabled={saving} onClick={() => tap('yes')}
            data-testid="task-outcome-yes">
            {tSafe('outcomes.task.yes', 'Yes')}
          </button>
          <button type="button" style={S.btnPartial}
            disabled={saving} onClick={() => tap('partial')}
            data-testid="task-outcome-partial">
            {tSafe('outcomes.task.partial', 'Partially')}
          </button>
          <button type="button" style={S.btnNo}
            disabled={saving} onClick={() => tap('no')}
            data-testid="task-outcome-no">
            {tSafe('outcomes.task.no', 'No')}
          </button>
        </div>
        {status === 'error' ? (
          <p style={S.err}>{tSafe('outcomes.task.error', 'Could not save — try again.')}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={S.wrap} data-testid="task-outcome-prompt-done"
      data-task-id={taskId || ''}>
      <p style={S.done}>
        ✓ {tSafe('outcomes.task.recorded', 'Recorded')}: <strong>{status}</strong>
      </p>
    </div>
  );
}

export default class TaskOutcomePrompt extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <TaskOutcomePromptInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
    fontFamily: 'system-ui',
  },
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
