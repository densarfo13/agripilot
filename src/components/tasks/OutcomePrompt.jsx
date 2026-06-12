/**
 * OutcomePrompt.jsx — sprint #198: the farmer-facing outcome loop.
 *
 *   <OutcomePrompt task={completedTask} farmId={farmId} />
 *
 * The Fable-5 critic pass found the FOS-1 outcome loop's last mile
 * missing: followUpEngine statuses (improved/same/worse), the
 * follow-up API, and outcome storage all shipped (#168/#173) — but
 * no UI ever ASKED the farmer "Did this help?". Outcome Capture %
 * (north-star KPI #4) was structurally stuck at zero.
 *
 * Renders after task completion, under the CompletionCard:
 *
 *   Did this help?
 *   [ 👍 Better ]  [ ➖ Same ]  [ 👎 Worse ]
 *
 * On pick:
 *   - fires the `outcome_recorded` pilot event (closing one of the
 *     #189 unwired call sites) with metadata.outcomeStatus
 *   - records the knowledge-graph outcome edge with the farmer's
 *     ACTUAL answer (replacing the old default-'improved' guess
 *     for harvest tasks)
 *   - flips to a brief localized "Thanks — this helps us improve"
 *     state, then the card stays quiet
 *
 * Low-literacy rules (spec §7): three big buttons, one question,
 * no paragraphs, emoji anchors, ≥52px tap targets.
 *
 * Self-contained; every side effect lazy-imported + _safe-wrapped —
 * an analytics failure can never break the completion celebration.
 */

import React, { useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const OUTCOMES = [
  { key: 'better', status: 'improved', emoji: '👍' },
  { key: 'same',   status: 'same',     emoji: '➖' },
  { key: 'worse',  status: 'worse',    emoji: '👎' },
];

export default function OutcomePrompt({ task, farmId }) {
  const [picked, setPicked] = useState(null);

  if (!task || !task.id) return null;

  function pick(outcome) {
    if (picked) return;
    setPicked(outcome.key);
    // Pilot event — outcome_recorded (north-star KPI #4 numerator).
    _safe(() => {
      import('../../runtime/analytics/PilotAnalyticsRuntime')
        .then((m) => _safe(() => m.trackPilotEvent({
          eventType: 'outcome_recorded',
          metadata: { outcomeStatus: outcome.status },
        }), null))
        .catch(() => { /* swallow */ });
    }, null);
    // Knowledge-graph edge with the farmer's REAL answer.
    _safe(() => {
      import('../../runtime/knowledgeGraph')
        .then((m) => _safe(() => {
          if (m && typeof m.recordOutcomeEdge === 'function') {
            const outcomeId = 'task:' + String(task.id) + ':'
              + new Date().toISOString().slice(0, 10);
            m.recordOutcomeEdge(
              String(task.id), outcomeId, outcome.status,
              new Date().toISOString());
          }
        }, null))
        .catch(() => { /* swallow */ });
    }, null);
    // Structured local event for the NGO/outcome aggregators.
    _safe(() => {
      import('../../core/analytics.js')
        .then((m) => _safe(() => {
          if (m && typeof m.safeTrackEvent === 'function') {
            m.safeTrackEvent('outcome_recorded', {
              farmId: farmId || null,
              taskId: task.id,
              outcome: outcome.status,
              source: 'outcome_prompt',
            });
          }
        }, null))
        .catch(() => { /* swallow */ });
    }, null);
  }

  if (picked) {
    return (
      <div style={S.card} data-testid="outcome-prompt-thanks">
        <p style={S.thanks}>
          {tSafe('outcome.thanks', 'Thanks — this helps your next plan.')}
        </p>
      </div>
    );
  }

  return (
    <div style={S.card} data-testid="outcome-prompt">
      <p style={S.question}>
        {tSafe('outcome.question', 'Did this help?')}
      </p>
      <div style={S.row}>
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            style={S.btn}
            onClick={() => pick(o)}
            data-testid={'outcome-' + o.key}
          >
            <span style={S.emoji} aria-hidden="true">{o.emoji}</span>
            <span style={S.btnLabel}>
              {tSafe('outcome.' + o.key,
                o.key === 'better' ? 'Better'
                : o.key === 'same' ? 'Same' : 'Worse')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    marginTop: 10,
  },
  question: {
    margin: '0 0 10px',
    fontSize: 16,
    fontWeight: 700,
    color: '#1F2933',
    textAlign: 'center',
  },
  row: { display: 'flex', gap: 8 },
  btn: {
    flex: 1,
    minHeight: 56, // low-literacy tap target
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    background: '#F8FAFC',
    border: '1px solid rgba(31,41,51,0.10)',
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  emoji: { fontSize: 20, lineHeight: 1 },
  btnLabel: { fontSize: 13, fontWeight: 700, color: '#1F2933' },
  thanks: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#1F6A3A',
    textAlign: 'center',
  },
};
