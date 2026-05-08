/**
 * UsefulResultCard — FEATURE_SCAN_USEFULNESS result card.
 *
 * Renders a clean, farmer-friendly scan result with three sections:
 *   1. What we noticed   — cautious, non-prescriptive observation text
 *   2. What to check next — 3 actionable bullets per category
 *   3. Suggested task     — one follow-up task with "Add follow-up task" button
 *
 * Safe scan categories (no ML model required):
 *   healthy | yellowing | holes_or_pest_damage |
 *   spots_or_disease_concern | needs_review (unclear photo)
 *
 * Rules
 * ─────
 *   • All hooks called unconditionally (rules-of-hooks safe).
 *   • Never claims "confirmed disease" — uses "may", "could",
 *     "possibly" throughout.
 *   • "Add follow-up task" button persists via scanToTask pipeline.
 *   • Never throws — every section falls back to safe defaults.
 *   • No camera, no network, no blocking render.
 *
 * Props
 *   result         — ScanResult from the engine (category, possibleIssue, scanId)
 *   experience     — 'farm' | 'backyard' | 'generic'
 *   onRetake       — () → void  (navigate back to capture)
 *   onTaskAdded    — () → void  (optional; called after task persisted)
 */

import { useCallback, useState } from 'react';
import { addScanTasks } from '../../core/scanToTask.js';

// ─── Per-category guidance ────────────────────────────────────────
// Spec-exact wording. Honest, action-framed, no certainty claims.

const GUIDANCE = Object.freeze({
  healthy: Object.freeze({
    emoji:    '✅',
    label:    'Looks Healthy',
    noticed:  'Your crop appears healthy. No obvious issues detected.',
    checks: [
      'Continue daily crop monitoring.',
      'Check that water and nutrients are sufficient.',
      'Look for any early stress signs over the next few days.',
    ],
    task:     'Continue monitoring your crop daily.',
  }),

  yellowing: Object.freeze({
    emoji:    '🌿',
    label:    'Yellowing Leaves',
    noticed:  'We noticed yellowing that may be caused by water stress, nutrient issues, or pests.',
    checks: [
      'Check soil moisture — water if the top inch feels dry.',
      'Inspect lower leaves closely for yellowing pattern.',
      'Look under leaves for pests or sticky residue.',
    ],
    task:     'Check soil moisture and inspect lower leaves.',
  }),

  holes_or_pest_damage: Object.freeze({
    emoji:    '🐛',
    label:    'Holes or Pest Damage',
    noticed:  'We noticed holes or irregular leaf edges that may indicate pest activity.',
    checks: [
      'Inspect under leaves for insects, eggs, or sticky residue.',
      'Check stems and the soil near the base of the plant.',
      'Look for trails, droppings, or chewed roots.',
    ],
    task:     'Inspect under leaves for pests.',
  }),

  spots_or_disease_concern: Object.freeze({
    emoji:    '🍂',
    label:    'Spots or Disease Concern',
    noticed:  'We noticed spots that may indicate a fungal or bacterial concern.',
    checks: [
      'Separate and isolate affected leaves where possible.',
      'Avoid watering from above — water at the base instead.',
      'Monitor nearby plants over 2–3 days for any spread.',
    ],
    task:     'Separate affected leaves and monitor for spread.',
  }),

  needs_review: Object.freeze({
    emoji:    '📷',
    label:    'Unclear Photo',
    noticed:  'The photo didn\'t give us enough detail to identify a specific issue.',
    checks: [
      'Take the photo outdoors in good natural light.',
      'Get close to the affected leaf or area.',
      'Remove shadows and avoid blurry shots.',
    ],
    task:     'Take a clearer photo in good light.',
  }),
});

// Fallback for any unknown category.
const _FALLBACK = GUIDANCE.needs_review;

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  // Category chip row
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.80)',
  },
  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 4,
  },
  // "What we noticed" text
  noticedText: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 1.55,
  },
  // "What to check next" list
  checkList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    lineHeight: 1.45,
  },
  // Suggested task block
  taskBlock: {
    padding: '10px 13px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.22)',
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  taskText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 1.4,
    flex: '1 1 auto',
    minWidth: 0,
  },
  addBtn: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    borderRadius: 8,
    padding: '7px 13px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  taskToast: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flex: '0 0 auto',
  },
  // Bottom buttons row
  buttonsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
  },
};

// ─── Component ───────────────────────────────────────────────────

export default function UsefulResultCard({
  result,
  experience = 'generic',
  onRetake,
  onTaskAdded,
}) {
  // All hooks declared unconditionally — rules-of-hooks safe.
  const [taskAdded, setTaskAdded] = useState(false);

  const handleAddTask = useCallback(() => {
    if (taskAdded) return;
    const category = (result && result.category) ? result.category : 'needs_review';
    const guidance  = GUIDANCE[category] || _FALLBACK;
    const scanId    = (result && result.scanId) ? result.scanId : null;
    try {
      addScanTasks(
        [{ title: guidance.task, urgency: 'medium', actionType: 'inspect' }],
        { scanId, experience }
      );
    } catch { /* never crash the card */ }
    setTaskAdded(true);
    if (typeof onTaskAdded === 'function') {
      try { onTaskAdded(); } catch { /* ignore */ }
    }
  }, [taskAdded, result, experience, onTaskAdded]);

  // Safe category lookup.
  const category = (result && result.category) ? String(result.category) : 'needs_review';
  const guidance  = GUIDANCE[category] || _FALLBACK;

  return (
    <article
      style={S.card}
      data-testid="useful-result-card"
      data-category={category}
      data-experience={experience}
    >
      {/* Category chip */}
      <div style={S.chipRow}>
        <span
          style={S.chip}
          data-testid="useful-result-category"
        >
          {guidance.emoji} {guidance.label}
        </span>
      </div>

      {/* What we noticed */}
      <div>
        <div style={S.sectionLabel}>What we noticed</div>
        <p style={S.noticedText} data-testid="useful-result-noticed">
          {guidance.noticed}
        </p>
      </div>

      {/* What to check next */}
      <div>
        <div style={S.sectionLabel}>What to check next</div>
        <ul style={S.checkList} data-testid="useful-result-checks">
          {guidance.checks.map((check, i) => (
            <li key={i}>{check}</li>
          ))}
        </ul>
      </div>

      {/* Suggested task */}
      <div style={S.taskBlock} data-testid="useful-result-task-block">
        <div style={S.sectionLabel}>Suggested task</div>
        <div style={S.taskRow}>
          <span style={S.taskText} data-testid="useful-result-task-text">
            {guidance.task}
          </span>
          {taskAdded ? (
            <span style={S.taskToast} data-testid="useful-result-task-toast">
              ✅ Task added
            </span>
          ) : (
            <button
              type="button"
              style={S.addBtn}
              data-testid="useful-result-add-task-btn"
              onClick={handleAddTask}
            >
              Add follow-up task
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={S.buttonsRow}>
        {typeof onRetake === 'function' ? (
          <button
            type="button"
            onClick={onRetake}
            style={S.btn}
            data-testid="useful-result-retake"
          >
            📷 Retake photo
          </button>
        ) : null}
      </div>

      {/* Disclaimer */}
      <p style={S.disclaimer}>
        Farroway provides guidance based on the photo and available information.
        Results are not guaranteed. Contact a local expert for severe or
        spreading issues.
      </p>
    </article>
  );
}
