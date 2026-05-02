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

export default function OnboardingReviewPanel({ experience }) {
  const isGarden = String(experience || '').toLowerCase() === 'garden'
                || String(experience || '').toLowerCase() === 'backyard';
  const tasks = _tasksFor(experience);
  const hint = isGarden
    ? tSafe('onboarding.newFarmerHint.garden',
        'Follow these steps today to keep your plant healthy.')
    : tSafe('onboarding.newFarmerHint.farm',
        'Follow these steps today to keep your crop healthy.');

  return (
    <section style={S.wrap} data-testid="onboarding-review-panel" data-experience={isGarden ? 'garden' : 'farm'}>
      <span style={S.eyebrow}>
        {tSafe('onboarding.planReadyEyebrow', 'Your first plan is ready')}
      </span>
      <h3 style={S.title}>
        {tSafe('onboarding.review.title', 'Review your first plan')}
      </h3>
      <p style={S.subtitle}>
        {tSafe('onboarding.review.helper',
          'You can change anything before continuing.')}
      </p>
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
};
