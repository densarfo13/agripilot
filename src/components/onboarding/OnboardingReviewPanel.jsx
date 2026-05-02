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
    { id: 'review.scan',  urgency: 'low',
      title:  tSafe('preview.title.scan', 'Scan if you see damage'),
      reason: tSafe('preview.reason.scan',
        'Take a photo of any spot or wilt and we\u2019ll suggest the next step.') },
  ];
}

/**
 * SummaryRow \u2014 one line in the "Your picks" summary block.
 *   Label (small)
 *   Value (bold)               [Change X]
 * The value is rendered as-is so the caller controls
 * formatting (capitalisation, translation, etc.).
 */
function SummaryRow({ label, value, onChange, changeLabel, testid }) {
  return (
    <div style={S.summaryRow}>
      <div style={S.summaryRowText}>
        <span style={S.summaryRowLabel}>{label}</span>
        <span style={S.summaryRowValue}>{value || '\u2014'}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        style={S.summaryRowBtn}
        data-testid={testid}
      >
        {changeLabel}
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
  const hint = isGarden
    ? tSafe('onboarding.newFarmerHint.garden',
        'Follow these steps today to keep your plant healthy.')
    : tSafe('onboarding.newFarmerHint.farm',
        'Follow these steps today to keep your crop healthy.');

  // Merge-spec \u00a73 \u2014 "Your picks" summary block. When the
  // caller passes a `summary` object we render a compact list
  // of the user's selections + a Change button per row that
  // scrolls back to the corresponding form section. The buttons
  // never leave the page; the form is single-screen so a smooth
  // scroll is enough.
  const safeSummary = summary && typeof summary === 'object' ? summary : null;
  const showSummary = !!safeSummary;

  return (
    <section style={S.wrap} data-testid="onboarding-review-panel" data-experience={isGarden ? 'garden' : 'farm'}>
      <span style={S.eyebrow}>
        {tSafe('onboarding.planReadyEyebrow', 'Your first plan is ready')}
      </span>
      <h3 style={S.title}>
        {tSafe('onboarding.review.title', 'Your plan is ready')}
      </h3>
      <p style={S.subtitle}>
        {tSafe('onboarding.review.subtitle',
          'Here\u2019s what to do today.')}
      </p>

      {/* Merge-spec \u00a73 \u2014 Your picks. Garden experience always
          renders Plant + Location + Growing setup; farm renders
          Crop + Location + Farm size. The Change buttons scroll
          to the relevant form section. */}
      {showSummary ? (
        <div style={S.summary} data-testid="onboarding-review-summary">
          <span style={S.summaryTitle}>
            {tSafe('onboarding.review.editPrompt', 'Want to change anything?')}
          </span>
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

      <p style={S.hint}>{hint}</p>
      <ul style={S.list}>
        {tasks.map((t, i) => (
          <li
            key={t.id}
            style={{ ...S.row, ...(URGENCY_TONE[t.urgency] || URGENCY_TONE.low) }}
            data-testid={`onboarding-review-task-${i}`}
          >
            <p style={S.rowTitle}>{t.title}</p>
            <p style={S.rowReason}>{t.reason}</p>
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
