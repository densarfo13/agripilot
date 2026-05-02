/**
 * StepDailyPlanPreview \u2014 Step 6 of Simple Onboarding.
 *
 * Generates a real DailyPlan from the in-progress profile so
 * the farmer's first impression of the app is the surface
 * they'll use every day.
 *
 * Review-step spec (back + edit control)
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Title is now "Review your plan" (was "Here is what to do
 * today") with a helper line beneath: "You can change anything
 * before continuing." Below the action list a small "Edit your
 * setup" panel lists three jump-back options:
 *   \u2022 Change crop           \u2192 onEditStep('crop')
 *   \u2022 Change location       \u2192 onEditStep('location')
 *   \u2022 Change growing setup  \u2192 onEditStep('growingSetup')
 * The parent OnboardingFlow maps each key to the right step
 * number; pre-edit data is preserved (the parent only flips the
 * step pointer, the profile state is untouched). The "Go to
 * Home" CTA stays as the primary action so the user can confirm
 * without making changes.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { generateDailyPlan } from '../core/dailyIntelligenceEngine.js';
import VoiceLauncher from '../components/voice/VoiceLauncher.jsx';
import PhotoLauncher from '../components/photo/PhotoLauncher.jsx';

const URGENCY_TONE = {
  high:   { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.32)' },
  medium: { background: 'rgba(34,197,94,0.10)',  borderColor: 'rgba(34,197,94,0.32)' },
  low:    { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' },
};

export default function StepDailyPlanPreview({ value, onComplete, busy, onEditStep }) {
  const navigate = useNavigate();

  // Build a temporary farm shape the daily engine understands.
  const previewFarm = React.useMemo(() => ({
    id:           value.activeFarmId || 'preview-farm',
    farmName:     value.farmName || tSafe('daily.farmFallback', 'Your farm'),
    crop:         value.cropId,
    cropType:     value.cropId,
    plantingDate: value.plantingDate || null,
    country:      value.country || null,
    state:        value.region  || null,
  }), [value]);

  const plan = React.useMemo(
    () => generateDailyPlan({ farm: previewFarm, weather: null }),
    [previewFarm],
  );

  // Spec §7 fallback action set when the engine can't fill 3
  // slots (e.g. crop unknown / unfamiliar).
  const fallbackActions = [
    {
      id: 'preview.checkCrop',
      title: tSafe('voice.todayTasks', 'Check your crop today'),
      reason: tSafe('preview.reason.checkCrop',
        'Walk the field and look for new growth or stress signs.'),
      urgency: 'medium',
    },
    {
      id: 'preview.water',
      title: tSafe('preview.title.water', 'Water only if soil is dry'),
      reason: tSafe('preview.reason.water',
        'Touch the soil 5 cm down — water only if it feels dry.'),
      urgency: 'medium',
    },
    {
      id: 'preview.ask',
      title: tSafe('preview.title.ask', 'Ask Farroway if you are unsure'),
      reason: tSafe('preview.reason.ask',
        'Tap the mic on Home and ask any question in your language.'),
      urgency: 'low',
    },
  ];

  const actions = (plan.actions && plan.actions.length >= 3)
    ? plan.actions.slice(0, 3)
    : (() => {
        const seen = new Set((plan.actions || []).map((a) => a.id));
        const out = [...(plan.actions || [])];
        for (const a of fallbackActions) {
          if (out.length >= 3) break;
          if (!seen.has(a.id)) out.push(a);
        }
        return out.slice(0, 3);
      })();

  // Review-step spec \u2014 wire each "Edit your setup" button to
  // the parent's step-pointer setter. When `onEditStep` is not
  // provided (legacy callers), the panel renders read-only-style
  // buttons that no-op so the layout doesn't break.
  function handleEdit(key) {
    if (typeof onEditStep === 'function') {
      try { onEditStep(key); } catch { /* swallow */ }
    }
  }

  return (
    <section style={S.wrap} data-testid="onboarding-step-preview">
      <span style={S.eyebrow}>
        {tSafe('onboarding.planReadyEyebrow', 'Your first plan is ready')}
      </span>
      {/* Review-step spec \u2014 title replaces "Here is what to do
          today" with a clearer review framing. Helper text sits
          immediately under so the user knows nothing is locked
          in yet. */}
      <h1 style={S.title}>
        {tSafe('onboarding.review.title', 'Review your plan')}
      </h1>
      <p style={S.helperText}>
        {tSafe('onboarding.review.helper',
          'You can change anything before continuing.')}
      </p>

      {value.farmerType === 'new' && (
        <p style={S.newFarmerNote}>
          {tSafe('onboarding.newFarmerHint',
            'Start simple. Do these actions first.')}
        </p>
      )}

      <ul style={S.actionList}>
        {actions.map((a, i) => (
          <li
            key={a.id || i}
            style={{
              ...S.actionRow,
              ...(URGENCY_TONE[a.urgency] || URGENCY_TONE.low),
            }}
            data-testid={`onboarding-preview-action-${i}`}
          >
            <p style={S.actionTitle}>{a.title}</p>
            {a.reason && <p style={S.actionReason}>{a.reason}</p>}
          </li>
        ))}
      </ul>

      {plan.alerts && plan.alerts.length > 0 && (
        <p style={S.alertText} data-testid="onboarding-preview-alert">
          {plan.alerts[0].message}
        </p>
      )}

      {/* Review-step spec \u2014 "Edit your setup" panel. Each button
          jumps the parent flow back to the relevant step,
          preserving the in-flight profile state. The parent
          maps the string keys to step numbers so this component
          stays decoupled from the step taxonomy. */}
      {typeof onEditStep === 'function' ? (
        <div style={S.editPanel} data-testid="onboarding-edit-setup">
          <span style={S.editPanelTitle}>
            {tSafe('onboarding.review.editTitle', 'Edit your setup')}
          </span>
          <button
            type="button"
            onClick={() => handleEdit('crop')}
            style={S.editBtn}
            data-testid="onboarding-edit-crop"
          >
            {tSafe('onboarding.review.changeCrop', 'Change crop')}
          </button>
          <button
            type="button"
            onClick={() => handleEdit('location')}
            style={S.editBtn}
            data-testid="onboarding-edit-location"
          >
            {tSafe('onboarding.review.changeLocation', 'Change location')}
          </button>
          <button
            type="button"
            onClick={() => handleEdit('growingSetup')}
            style={S.editBtn}
            data-testid="onboarding-edit-growing-setup"
          >
            {tSafe('onboarding.review.changeGrowingSetup', 'Change growing setup')}
          </button>
        </div>
      ) : null}

      <div style={S.cta}>
        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          style={{ ...S.btn, ...S.btnPrimary }}
          data-testid="onboarding-go-home"
        >
          {busy
            ? tSafe('common.saving', 'Saving\u2026')
            : tSafe('onboarding.goHome', 'Go to Home')}
        </button>
        <div style={S.shortcuts}>
          <VoiceLauncher variant="chip" />
          <PhotoLauncher
            variant="chip"
            farmId={value.activeFarmId || null}
            cropId={value.cropId || null}
          />
        </div>
      </div>
    </section>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  eyebrow: {
    fontSize: '0.6875rem', color: '#86EFAC',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  title: {
    margin: 0, fontSize: '1.25rem', fontWeight: 700,
    color: '#EAF2FF', lineHeight: 1.35,
  },
  // Review-step spec \u2014 helper line under the title so the user
  // knows they can still change things before continuing.
  helperText: {
    margin: '-0.25rem 0 0',
    fontSize: '0.875rem',
    color: '#9FB3C8',
    lineHeight: 1.45,
  },
  // Review-step spec \u2014 "Edit your setup" panel.
  editPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.18)',
  },
  editPanelTitle: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  editBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    minHeight: 44,
    textAlign: 'left',
  },
  newFarmerNote: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC',
    fontSize: '0.8125rem',
  },
  actionList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  actionRow: {
    padding: '0.625rem 0.75rem',
    borderRadius: 12,
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  actionTitle: { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#EAF2FF' },
  actionReason: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  alertText: {
    margin: 0,
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: '0.8125rem',
  },
  cta: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' },
  btn: {
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
  },
  btnPrimary: { background: '#22C55E', color: '#062714' },
  shortcuts: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
};
