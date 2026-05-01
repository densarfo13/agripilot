/**
 * ProfileCompletionPrompt — "ask for more info later" card on
 * the farmer Home tab.
 *
 * Spec coverage (Onboarding optimisation §6)
 *   • Ask for more info later — surfaces the deferred fields
 *     (farm size + crop stage) once the user has had a moment
 *     of value.
 *
 * When it shows
 *   • The user has an active farm (so they've at least done
 *     minimal setup).
 *   • At least one of `farmSize` / `cropStage` is missing.
 *   • The user has not dismissed the prompt this session.
 *   • `onboardingV2` flag is on.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 *   • Routes to `/farm/new` for the full-form upgrade path so
 *     the existing AdaptiveFarmSetup flow handles the actual
 *     edit. We never re-implement form state here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const DISMISS_KEY = 'farroway_profile_completion_dismissed';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  card: {
    background: 'rgba(252,211,77,0.10)',
    border: '1px solid rgba(252,211,77,0.40)',
    borderRadius: 14,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    margin: '0 0 12px',
  },
  icon: { fontSize: 24, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 800, color: '#FDE68A' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#FCD34D',
    color: '#0B1D34',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function ProfileCompletionPrompt({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('onboardingV2');
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch { return false; }
  });
  const viewedRef = useRef(false);

  const farm = useMemo(() => _readActiveFarm(), []);

  const missingFields = useMemo(() => {
    if (!farm) return [];
    const out = [];
    const hasFarmSize = Boolean(farm.farmSize) || Boolean(farm.gardenSizeCategory);
    const hasStage    = Boolean(farm.cropStage) || Boolean(farm.plantingStatus);
    if (!hasFarmSize) out.push('farmSize');
    if (!hasStage)    out.push('cropStage');
    return out;
  }, [farm]);

  const eligible = flagOn
    && !dismissed
    && farm
    && missingFields.length > 0;

  // Once-per-mount view event for funnel measurement.
  useEffect(() => {
    if (!eligible) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try { trackEvent('profile_completion_view', { missing: missingFields }); }
    catch { /* swallow */ }
  }, [eligible, missingFields]);

  const handleStart = useCallback(() => {
    try { trackEvent('profile_completion_click', { missing: missingFields }); }
    catch { /* swallow */ }
    try { navigate('/farm/new'); }
    catch { /* swallow */ }
  }, [navigate, missingFields]);

  const handleDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('profile_completion_dismiss', { missing: missingFields }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [missingFields]);

  if (!eligible) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="profile-completion-prompt"
      data-missing={missingFields.join(',')}
    >
      <span style={S.icon} aria-hidden="true">{'\u270F\uFE0F'}</span>
      <div style={S.body}>
        <span style={S.title}>
          {tStrict('onb.complete.title', 'Add a few more details')}
        </span>
        <span style={S.copy}>
          {tStrict('onb.complete.copy',
            'Sharing your farm size and crop stage gives us sharper daily tips. Takes a minute.')}
        </span>
        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleStart}
            style={S.primary}
            data-testid="profile-completion-start"
          >
            {tStrict('onb.complete.cta', 'Add details')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={S.ghost}
            data-testid="profile-completion-dismiss"
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        </div>
      </div>
    </section>
  );
}
