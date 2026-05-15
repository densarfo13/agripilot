/**
 * ManualIssuePicker — the manual fallback for a scan that the AI
 * could not read confidently (Final Scan Preview + Gallery-First
 * Fix §4, §5).
 *
 *   <ManualIssuePicker onResolved={(issue) => ...} />
 *
 * When the scan is low-confidence or the AI check is unavailable,
 * the farmer is never left without a next step: they pick what
 * they see from six plain options. The pick is a REAL outcome —
 * it is not cosmetic:
 *
 *   • saved to the scan journal   (saveScanUseful → scan history,
 *     which the journal + farm-intelligence loop both read)
 *   • a follow-up task is created (addScanTasks — itself flag-gated;
 *     when scanToTask is off the journal save still happens)
 *
 * The six options are exactly the spec's list:
 *   Yellow leaves · Brown spots · Insects · Dry soil ·
 *   Mold or rot · Not sure
 *
 * Strict-rule audit
 *   • Never throws — every store call is wrapped.
 *   • Inline styles only. No raw API output, no fake certainty —
 *     a manual pick is recorded with confidence 'manual'.
 *   • SSR-safe (the store helpers guard localStorage themselves).
 */

import React, { useCallback, useState } from 'react';
import { saveScanUseful } from '../../lib/scan/scanHistoryStore.js';
import { addScanTasks } from '../../core/scanToTask.js';
import { getFarmContext } from '../../lib/farmContextEngine.js';

// id → { label, category, followUp }. The category values match
// the scan engine's own category vocabulary (disease / pest /
// fungal / nutrient_deficiency / needs_review) so a manual entry
// is indistinguishable downstream from an AI one — except its
// confidence is honestly recorded as 'manual'.
const ISSUES = Object.freeze([
  { id: 'yellow_leaves', label: 'Yellow leaves', category: 'nutrient_deficiency',
    followUp: 'Check watering and feeding for the yellowing leaves' },
  { id: 'brown_spots',   label: 'Brown spots',   category: 'disease',
    followUp: 'Inspect the plant for spreading brown spots' },
  { id: 'insects',       label: 'Insects',       category: 'pest',
    followUp: 'Check under the leaves and stems for pests' },
  { id: 'dry_soil',      label: 'Dry soil',      category: 'needs_review',
    followUp: 'Water the plant and check the soil moisture' },
  { id: 'mold_or_rot',   label: 'Mold or rot',   category: 'fungal',
    followUp: 'Remove affected parts and improve airflow around the plant' },
  { id: 'not_sure',      label: 'Not sure',      category: 'needs_review',
    followUp: 'Take a closer look at the plant in good light today' },
]);

function _experience() {
  try {
    const ctx = getFarmContext();
    return (ctx && ctx.experience) || 'generic';
  } catch {
    return 'generic';
  }
}

export default function ManualIssuePicker({ onResolved }) {
  const [resolved, setResolved] = useState(null); // the chosen issue
  const [taskAdded, setTaskAdded] = useState(false);

  const handlePick = useCallback((issue) => {
    if (resolved) return;
    const experience = _experience();
    const scanId = 'manual_' + Date.now().toString(36)
      + '_' + Math.random().toString(36).slice(2, 6);

    // 1. Save the manual observation to the scan journal. Honestly
    //    tagged source:'manual' / confidence:'manual' — never
    //    presented as an AI finding.
    try {
      saveScanUseful(
        {
          scanId,
          category:      issue.category,
          possibleIssue: issue.label,
          source:        'manual',
          confidence:    'manual',
        },
        { experience, noticed: issue.label },
      );
    } catch { /* never throw from a fallback */ }

    // 2. Create an optional follow-up task so Today's Plan always
    //    carries a next step. addScanTasks is flag-gated; when the
    //    flag is off this is a clean no-op and the journal save
    //    above still stands.
    let added = false;
    try {
      const tasks = addScanTasks(
        [{ title: issue.followUp, urgency: 'medium', source: 'scan' }],
        { scanId, experience },
      );
      added = Array.isArray(tasks) && tasks.length > 0;
    } catch { /* never throw */ }

    setResolved(issue);
    setTaskAdded(added);
    if (typeof onResolved === 'function') {
      try { onResolved(issue); } catch { /* swallow */ }
    }
  }, [resolved, onResolved]);

  if (resolved) {
    return (
      <div style={S.wrap} data-testid="manual-issue-resolved" data-issue={resolved.id}>
        <p style={S.confirmTitle}>Saved to your journal</p>
        <p style={S.confirmBody}>
          {'You noted “' + resolved.label + '”. '}
          {taskAdded
            ? 'A follow-up check was added to Today’s plan.'
            : 'Open your journal any time to review it.'}
        </p>
      </div>
    );
  }

  return (
    <div style={S.wrap} data-testid="manual-issue-picker">
      <p style={S.prompt}>Pick what you see</p>
      <div style={S.grid}>
        {ISSUES.map((issue) => (
          <button
            key={issue.id}
            type="button"
            onClick={() => handlePick(issue)}
            style={S.option}
            data-testid={'manual-issue-' + issue.id}
          >
            {issue.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Exposed for tests + any caller that needs the canonical list.
export const MANUAL_ISSUES = ISSUES;

const S = {
  wrap: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid rgba(36,49,58,0.10)',
  },
  prompt: {
    margin: '0 0 0.5rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#1F2933',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  option: {
    padding: '0.6rem 0.5rem',
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.18)',
    borderRadius: 10,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#1F2933',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmTitle: {
    margin: '0 0 0.25rem',
    fontSize: '0.9375rem',
    fontWeight: 800,
    color: '#1F6F54',
  },
  confirmBody: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#667085',
    lineHeight: 1.5,
  },
};
