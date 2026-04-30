/**
 * StepDailyPlanPreview — Step 6 of Simple Onboarding.
 *
 * Generates a real DailyPlan from the in-progress profile so
 * the farmer's first impression of the app is the surface
 * they'll use every day. The preview is read-only — no
 * "Mark done" wiring; the real plan kicks in once they tap
 * "Go to Home".
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

export default function StepDailyPlanPreview({ value, onComplete, busy }) {
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

  return (
    <section style={S.wrap} data-testid="onboarding-step-preview">
      <span style={S.eyebrow}>
        {tSafe('onboarding.planReadyEyebrow', 'Your first plan is ready')}
      </span>
      <h1 style={S.title}>
        {tSafe('onboarding.planReady',
          plan.summary || 'Here is what to do today')}
      </h1>

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
