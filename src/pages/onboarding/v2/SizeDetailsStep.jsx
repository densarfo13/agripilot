/**
 * SizeDetailsStep — step 5. The ONE screen that branches on
 * mode:
 *   • backyard → "Where are you growing?" with 3 options
 *                (pots / raised bed / backyard soil) + optional
 *                approximate area
 *   • farm     → "How big is your farm?" with 3 size bands +
 *                optional exact size + acre/hectare toggle
 *
 * The step ID stays the same so back-navigation + resume logic
 * are simple; only the content changes.
 */

import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const BACKYARD_OPTIONS = [
  { id: 'pots',          emoji: '🪴', k: 'onboardingV2.sizeDetails.backyard.pots',   f: 'Pots / containers' },
  { id: 'raised_bed',    emoji: '🌿', k: 'onboardingV2.sizeDetails.backyard.raised', f: 'Raised bed' },
  { id: 'backyard_soil', emoji: '🌾', k: 'onboardingV2.sizeDetails.backyard.soil',   f: 'Backyard soil' },
];

const FARM_OPTIONS = [
  { id: 'small',  emoji: '🌱', k: 'onboardingV2.sizeDetails.farm.small',  f: 'Small — less than 2 acres' },
  { id: 'medium', emoji: '🌾', k: 'onboardingV2.sizeDetails.farm.medium', f: 'Medium — 2 to 10 acres' },
  { id: 'large',  emoji: '🚜', k: 'onboardingV2.sizeDetails.farm.large',  f: 'Large — 10+ acres' },
];

export default function SizeDetailsStep({
  state = {}, patch = () => {}, t = null,
  onBack = null, onNext = null, mode = null,
}) {
  const effectiveMode = mode || state.mode || 'farm';
  const details = state.sizeDetails || {};

  const title  = resolve(t,
    effectiveMode === 'backyard'
      ? 'onboardingV2.sizeDetails.backyard.title'
      : 'onboardingV2.sizeDetails.farm.title',
    effectiveMode === 'backyard' ? 'Where are you growing?' : 'How big is your farm?');
  const helper = resolve(t,
    effectiveMode === 'backyard'
      ? 'onboardingV2.sizeDetails.backyard.helper'
      : 'onboardingV2.sizeDetails.farm.helper',
    effectiveMode === 'backyard'
      ? 'This changes what crops and tasks we suggest.'
      : 'This changes task scale and planning recommendations.');

  const isBackyard = effectiveMode === 'backyard';
  const options    = isBackyard ? BACKYARD_OPTIONS : FARM_OPTIONS;
  const selectedId = isBackyard ? details.spaceType : details.sizeBand;

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.SIZE_DETAILS}
      t={t}
      title={title}
      helper={helper}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!selectedId}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {options.map((opt) => {
          const selected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => patch({
                sizeDetails: isBackyard
                  ? { spaceType: opt.id }
                  : { sizeBand:  opt.id },
              })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12,
                border: `2px solid ${selected ? '#1b5e20' : '#e0e0e0'}`,
                background: selected ? '#f1f8e9' : '#fff',
                fontSize: 16, fontWeight: 600, color: '#263238',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.emoji}</span>
              {resolve(t, opt.k, opt.f)}
            </button>
          );
        })}
      </div>

      {isBackyard && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 20 }}>
          <span style={{ fontSize: 13, color: '#546e7a', fontWeight: 600 }}>
            {resolve(t, 'onboardingV2.sizeDetails.backyard.approx',
              'Approximate growing space (optional)')}
          </span>
          <input
            type="text"
            value={details.approxArea || ''}
            onChange={(e) => patch({ sizeDetails: { approxArea: e.target.value || null } })}
            placeholder="e.g. 5 m² or 3 pots"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cfd8dc', fontSize: 15 }}
          />
        </label>
      )}

      {!isBackyard && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#546e7a', fontWeight: 600 }}>
            {resolve(t, 'onboardingV2.sizeDetails.farm.exactLabel',
              'Enter exact size (optional)')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min="0" step="0.1"
              value={details.exactSize?.value || ''}
              onChange={(e) => patch({ sizeDetails: {
                exactSize: {
                  value: e.target.value === '' ? null : Number(e.target.value),
                  unit: details.exactSize?.unit || 'acre',
                },
              }})}
              placeholder="0"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #cfd8dc', fontSize: 15 }}
            />
            <select
              value={details.exactSize?.unit || 'acre'}
              onChange={(e) => patch({ sizeDetails: {
                exactSize: {
                  value: details.exactSize?.value ?? null,
                  unit: e.target.value,
                },
              }})}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cfd8dc', fontSize: 15 }}
            >
              <option value="acre">
                {resolve(t, 'onboardingV2.sizeDetails.farm.unit.acre', 'Acres')}
              </option>
              <option value="hectare">
                {resolve(t, 'onboardingV2.sizeDetails.farm.unit.hectare', 'Hectares')}
              </option>
            </select>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
