/**
 * OnboardingReviewPanel \u2014 leaf component for the "Review your
 * first plan" panel that mounts above the Save button in
 * QuickGardenSetup + QuickFarmSetup. Brings the polished review-
 * screen copy from the legacy StepDailyPlanPreview into the
 * canonical onboarding path without needing a separate route or
 * step.
 *
 *   <OnboardingReviewPanel experience="garden" />
 *   <OnboardingReviewPanel experience="farm"   />
 *
 * What the user sees
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Eyebrow:   Your first plan is ready
 * Title:     Review your first plan
 * Subtitle:  You can change anything before continuing.
 * Tasks:     3 tiles, garden vs farm-aware
 *              Garden: Check your plant / Water only if soil is
 *                      dry / Scan if you see damage
 *              Farm:   Check your crop / Water only if soil is
 *                      dry / Scan if you see damage
 * Hint:      "Follow these steps today to keep your {plant|crop}
 *             healthy."
 *
 * Why this is a separate component
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Leaf module so QuickGardenSetup + QuickFarmSetup can mount it
 * without dragging the heavy daily-intelligence-engine import
 * the legacy StepDailyPlanPreview pulled in. No engine round-
 * trip; the 3 fallback tasks are static + experience-shaped \u2014
 * the user's actual personalised daily plan kicks in once they
 * land on /home.
 *
 * Strict-rule audit
 *   \u2022 Only imports React + tSafe. No engine, no I/O.
 *   \u2022 Inline styles only.
 *   \u2022 Never throws.
 *   \u2022 All visible text via tSafe with English fallbacks; the
 *     keys mirror what StepDailyPlanPreview used so existing
 *     translations.js entries continue to power both surfaces.
 */

import { useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const URGENCY_TONE = {
  high:   { background: 'rgba(239,68,68,0.10)',  borderColor: 'rgba(239,68,68,0.32)' },
  medium: { background: 'rgba(34,197,94,0.10)',  borderColor: 'rgba(34,197,94,0.32)' },
  low:    { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' },
};

function _tasksFor(experience) {
  const isGarden = String(experience || '').toLowerCase() === 'garden'
                || String(experience || '').toLowerCase() === 'backyard';
  const checkTitleKey = isGarden ? 'preview.title.checkPlant' : 'preview.title.checkCrop';
  const checkTitleEn  = isGarden ? 'Check your plant'         : 'Check your crop';
  const checkReasonKey = isGarden ? 'preview.reason.checkPlant' : 'preview.reason.checkCrop';
  const checkReasonEn  = isGarden
    ? 'Look for new growth or stress signs on the leaves.'
    : 'Walk the field and look for new growth or stress signs.';
  return [
    { id: 'review.check', urgency: 'medium',
      title:  tSafe(checkTitleKey, checkTitleEn),
      reason: tSafe(checkReasonKey, checkReasonEn) },
    { id: 'review.water', urgency: 'medium',
      title:  tSafe('preview.title.water', 'Water only if soil is dry'),
      reason: tSafe('preview.reason.water',
        'Touch the soil 5 cm down \u2014 water only if it feels dry.') },
    // Final Home + Review Copy Polish \u00a71 \u2014 scan prompt
    // re-shaped to the action-first question form. Garden
    // version says "Scan your plant", farm version "Scan your
    // crop" so the wording reflects what the user is growing.
    { id: 'review.scan',  urgency: 'low',
      title:  isGarden
        ? tSafe('preview.title.scanPlant',
            'See spots or damage? Scan your plant')
        : tSafe('preview.title.scanCrop',
            'See spots or damage? Scan your crop'),
      reason: tSafe('preview.reason.scan',
        'Take a photo of any spot or wilt and we\u2019ll suggest the next step.') },
  ];
}

/**
 * SummaryRow \u2014 one line in the "Your picks" summary block.
 *   Label (small)
 *   Value (bold)               [Change X]
 *
 * Render-300 hotfix (May 2026)
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Production farmers were hitting React error #300 ("Objects are
 * not valid as a React child") on the setup review screen and
 * landing on the RecoveryErrorBoundary card. Root cause class:
 * a caller passing an object (e.g. unflattened location, or a
 * `formatLocation` result that took an early-return code path
 * returning the input shape) into `value` slipped past the
 * existing `value || '\u2014'` short-circuit, because non-empty
 * objects are truthy.
 *
 * Defensive coercion: every prop is wrapped in `_str(\u2026)` which
 * stringifies safely. Bad input falls through to em-dash, never
 * throws. Strings keep their original render. The fix is purely
 * additive \u2014 happy-path output is identical.
 */
function _str(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Objects / arrays: best-effort stringify, but never crash.
  // We deliberately don't render JSON \u2014 a farmer-visible
  // "[object Object]" is bad, but a recovery boundary is worse.
  try { return String(v); } catch { return ''; }
}

function SummaryRow({ label, value, onChange, changeLabel, testid }) {
  const safeValue       = _str(value);
  const safeLabel       = _str(label);
  const safeChangeLabel = _str(changeLabel);
  return (
    <div style={S.summaryRow}>
      <div style={S.summaryRowText}>
        <span style={S.summaryRowLabel}>{safeLabel}</span>
        <span style={S.summaryRowValue}>{safeValue || '\u2014'}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        style={S.summaryRowBtn}
        data-testid={testid}
      >
        {safeChangeLabel}
      </button>
    </div>
  );
}

/**
 * scrollToAnchor(id) \u2014 scroll the matching DOM node into view.
 * Used by the "Change X" buttons to bring the user back to the
 * relevant form section without leaving the page.
 */
function scrollToAnchor(id) {
  if (!id || typeof document === 'undefined') return;
  try {
    const el = document.getElementById(id);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch { /* swallow */ }
}

export default function OnboardingReviewPanel({ experience, summary, onChangeStep, actions: dynamicActions }) {
  const isGarden = String(experience || '').toLowerCase() === 'garden'
                || String(experience || '').toLowerCase() === 'backyard';
  // Dynamic engine-generated actions take precedence when the
  // caller supplies them (firstPlanEngine output). Falls back
  // to the static garden/farm fallback list for legacy
  // callers. Cap at 3 entries so the review surface stays
  // scannable; the engine returns up to 5 in priority order
  // (inspection \u2192 watering \u2192 risk \u2192 growth \u2192 scan).
  const tasks = (Array.isArray(dynamicActions) && dynamicActions.length > 0)
    ? dynamicActions.slice(0, 3).map((a, i) => ({
        id:     `engine.${a && a.type ? a.type : 'task'}.${i}`,
        urgency: a && a.type === 'risk' ? 'high'
               : a && a.type === 'scan' ? 'low'
               : 'medium',
        title:  String((a && a.text) || ''),
        reason: String((a && a.detail) || ''),
      }))
    : _tasksFor(experience);
  // Final Home + Review Copy Polish \u00a71 \u2014 the
  // "Follow these steps today to keep your plant/crop healthy."
  // hint paragraph was removed. Spec \u00a72 forbids long paragraphs;
  // the title already carries the action-first framing, so the
  // hint was redundant noise above the task tiles.

  // Merge-spec \u00a73 \u2014 "Your picks" summary block. When the
  // caller passes a `summary` object we render a compact list
  // of the user's selections + a Change button per row that
  // scrolls back to the corresponding form section. The buttons
  // never leave the page; the form is single-screen so a smooth
  // scroll is enough.
  const safeSummary = summary && typeof summary === 'object' ? summary : null;
  const showSummary = !!safeSummary;
  // Final Home + Review Copy Polish \u00a73 \u2014 the "Want to change
  // anything?" affordance is now COLLAPSED by default. The
  // user sees a small "Edit setup" button; tapping it expands
  // the per-field Change buttons. Collapsing the section lets
  // the daily plan tiles dominate the surface, matching the
  // "move user forward, not backward" intent of spec \u00a74.
  const [editOpen, setEditOpen] = useState(false);

  return (
    <section style={S.wrap} data-testid="onboarding-review-panel" data-experience={isGarden ? 'garden' : 'farm'}>
      <span style={S.eyebrow}>
        {tSafe('onboarding.planReadyEyebrow', 'Your first plan is ready')}
      </span>
      {/* Final Home + Review Copy Polish \u00a71 \u2014 the title now
          reads "Here's what to do today", which is the same
          message the legacy subtitle was carrying. The
          subtitle is dropped to remove the redundancy and
          tighten the visual hierarchy (spec \u00a72). */}
      <h3 style={S.title}>
        {tSafe('onboarding.review.title', 'Here\u2019s what to do today')}
      </h3>

      {/* Merge-spec \u00a73 + Final Home + Review Copy Polish \u00a73 \u2014
          Your picks block. Collapsed by default behind a small
          "Edit setup" toggle so the daily plan tiles dominate
          the surface. When the user wants to change something
          they tap the toggle and the per-field Change buttons
          expand inline. */}
      {showSummary ? (
        <div style={S.summary} data-testid="onboarding-review-summary">
          <div style={S.summaryHeaderRow}>
            <span style={S.summaryTitle}>
              {tSafe('onboarding.review.editPrompt', 'Want to change anything?')}
            </span>
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              style={S.editToggle}
              aria-expanded={editOpen}
              data-testid="onboarding-review-edit-toggle"
            >
              {editOpen
                ? tSafe('onboarding.review.hideEditSetup', 'Hide edit')
                : tSafe('onboarding.review.editSetup',     'Edit setup')}
            </button>
          </div>
          {editOpen ? (
          <div data-testid="onboarding-review-edit-panel">
          {/* Each Change button jumps the user back to the
              corresponding step. The parent passes onChangeStep
              when the form is multi-step (state-based jump);
              otherwise we fall back to the same-page scroll
              anchor. Stability-patch \u00a74 \u2014 the multi-step
              setup forms now drive jumps via setSubStep so
              the user lands on a real Pick-X / Location screen
              instead of scrolling within a stacked form. */}
          {safeSummary.plant != null ? (
            <SummaryRow
              label={tSafe('onboarding.review.changePlant', 'Plant')}
              value={safeSummary.plant}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('plant')
                : scrollToAnchor(safeSummary.plantAnchor || 'review-plant'))}
              changeLabel={tSafe('onboarding.review.changePlantBtn', 'Change plant')}
              testid="onboarding-review-change-plant"
            />
          ) : null}
          {safeSummary.crop != null ? (
            <SummaryRow
              label={tSafe('onboarding.review.changeCropLabel', 'Crop')}
              value={safeSummary.crop}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('crop')
                : scrollToAnchor(safeSummary.cropAnchor || 'review-crop'))}
              changeLabel={tSafe('onboarding.review.changeCrop', 'Change crop')}
              testid="onboarding-review-change-crop"
            />
          ) : null}
          {safeSummary.location != null ? (
            <SummaryRow
              label={tSafe('onboarding.review.locationLabel', 'Location')}
              value={safeSummary.location}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('location')
                : scrollToAnchor(safeSummary.locationAnchor || 'review-location'))}
              changeLabel={tSafe('onboarding.review.changeLocation', 'Change location')}
              testid="onboarding-review-change-location"
            />
          ) : null}
          {safeSummary.growingSetup != null ? (
            <SummaryRow
              label={tSafe('garden.growingSetup.label', 'Growing setup')}
              value={safeSummary.growingSetup}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('growingSetup')
                : scrollToAnchor(safeSummary.growingSetupAnchor || 'review-growing-setup'))}
              changeLabel={tSafe('onboarding.review.changeGrowingSetup', 'Change growing setup')}
              testid="onboarding-review-change-growing-setup"
            />
          ) : null}
          {/* Onboarding-polish patch \u00a72 \u2014 garden size now lives
              on its own sub-step. The review row points at it so
              the user can edit garden size without scrolling
              past growing-setup first. */}
          {safeSummary.gardenSize != null ? (
            <SummaryRow
              label={tSafe('onboarding.gardenSize.label', 'Garden size')}
              value={safeSummary.gardenSize}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('gardenSize')
                : scrollToAnchor(safeSummary.gardenSizeAnchor || 'review-garden-size'))}
              changeLabel={tSafe('onboarding.review.changeGardenSize', 'Change garden size')}
              testid="onboarding-review-change-garden-size"
            />
          ) : null}
          {safeSummary.farmSize != null ? (
            <SummaryRow
              label={tSafe('onboarding.farmSize.title', 'Farm size')}
              value={safeSummary.farmSize}
              onChange={() => (typeof onChangeStep === 'function'
                ? onChangeStep('farmSize')
                : scrollToAnchor(safeSummary.farmSizeAnchor || 'review-farm-size'))}
              changeLabel={tSafe('onboarding.review.changeFarmSize', 'Change farm size')}
              testid="onboarding-review-change-farm-size"
            />
          ) : null}
          </div>
          ) : null}
        </div>
      ) : null}

      <ul style={S.list}>
        {tasks.map((t, i) => (
          <li
            key={t.id}
            style={{ ...S.row, ...(URGENCY_TONE[t.urgency] || URGENCY_TONE.low) }}
            data-testid={`onboarding-review-task-${i}`}
          >
            {/* Render-300 hotfix \u2014 same defensive coercion the
                SummaryRow uses. If an upstream engine ever
                returns an object as `title` / `reason` instead
                of a string, we render its stringified form
                instead of crashing the whole subtree. */}
            <p style={S.rowTitle}>{_str(t.title)}</p>
            <p style={S.rowReason}>{_str(t.reason)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#EAF2FF',
  },
  eyebrow: {
    fontSize: 11,
    color: '#86EFAC',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title:    { margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.3 },
  subtitle: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  hint: {
    margin: '6px 0 4px',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC',
    fontSize: 13,
    lineHeight: 1.45,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  rowTitle:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#EAF2FF' },
  rowReason: { margin: 0, fontSize: 12, color: '#9FB3C8', lineHeight: 1.4 },

  // "Your picks" summary block (merge-spec \u00a73).
  summary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.18)',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  // Final Home + Review Copy Polish \u00a73 \u2014 the row holding the
  // collapsed prompt + the Edit setup toggle. Flex space-between
  // so the prompt sits on the left and the toggle on the right
  // without each line wrapping.
  summaryHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Same calm-pill style the Change buttons use so the toggle
  // visually belongs to the same family.
  editToggle: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.08)',
    color: '#86EFAC',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
  },
  summaryRowText: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  summaryRowLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  summaryRowValue: {
    fontSize: 13,
    color: '#EAF2FF',
    fontWeight: 700,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summaryRowBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.08)',
    color: '#86EFAC',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
    flex: '0 0 auto',
  },
};
