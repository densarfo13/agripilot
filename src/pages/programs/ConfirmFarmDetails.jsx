/**
 * ConfirmFarmDetails.jsx — incomplete-NGO-data fallback
 * (NGO Onboarding spec §6).
 *
 *   <Route path="/program/confirm" element={<ConfirmFarmDetails />} />
 *
 * Spec rule (§6)
 * ──────────────
 * When the imported farmer's context is missing required
 * fields (no crop OR no country), don't dump them into full
 * individual onboarding. Show this 1\u20132 question lightweight
 * confirmation surface, then continue to /home (Today's Plan).
 *
 *   Title:    "Confirm your farm details"
 *   Subtitle: "Just two quick questions."
 *   Q1:       "Which crop are you growing?"   (skipped if known)
 *   Q2:       "Where is your farm?"           (skipped if known)
 *   CTA:      "Continue to today's plan"
 *
 * The user is NEVER routed back to the full /onboarding flow
 * unless they explicitly tap "Restart setup" from the
 * recovery boundary (out of scope here).
 *
 * Strict-rule audit
 *   • All visible text via tSafe.
 *   • Inline styles only.
 *   • Persists answers via the canonical stores (locationStore
 *     + farroway_active_farm) so the rest of the app picks
 *     them up immediately.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getFarmerSource } from '../../core/farmerSource.js';
import { getProgram } from '../../core/programs/programStore.js';
import { saveLocation } from '../../utils/locationStore.js';
import { trackEvent } from '../../core/analytics.js';

const C = {
  ink:      '#EAF2FF',
  inkSoft:  'rgba(255,255,255,0.65)',
  card:     'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.10)',
  green:    '#22C55E',
  greenInk: '#062714',
  red:      '#EF4444',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '32px 16px 96px',
    boxSizing: 'border-box',
    maxWidth: 520,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title:    { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 14, color: C.inkSoft, lineHeight: 1.45 },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: C.inkSoft,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(0,0,0,0.32)',
    border: `1px solid ${C.border}`,
    color: C.ink,
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 15,
    fontFamily: 'inherit',
    minHeight: 44,
  },
  saveBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: C.green,
    color: C.greenInk,
    border: 'none',
    padding: '14px 20px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    minHeight: 48,
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
};

export default function ConfirmFarmDetails() {
  useTranslation();
  const navigate = useNavigate();

  const source  = React.useMemo(() => {
    try { return getFarmerSource(); } catch { return null; }
  }, []);
  const program = React.useMemo(() => {
    if (!source || !source.programId) return null;
    try { return getProgram(source.programId); } catch { return null; }
  }, [source]);

  // Pre-fill from program defaults so the user only has to
  // supply what's actually missing. They can still edit
  // everything; pre-filled fields are not locked.
  const [crop, setCrop]       = React.useState(() => (program && program.cropFocus) || '');
  const [country, setCountry] = React.useState(() => (program && program.country)   || '');
  const [region, setRegion]   = React.useState(() => (program && program.region)    || '');

  // Determine which questions are NEEDED. If the program
  // already supplied the field AND we're not asking the user
  // to override, that question is hidden.
  const needsCrop     = !crop.trim();
  const needsLocation = !country.trim();

  const canContinue = !!crop.trim() && !!country.trim();

  function handleContinue() {
    if (!canContinue) return;
    // Persist the user-confirmed fields into the canonical
    // stores. The locationStore mirror lets any future
    // surface read country / region without walking the
    // active farm row.
    try { saveLocation({ country: country.trim(), region: region.trim() }); }
    catch { /* swallow */ }
    // Stamp the active-farm row with the confirmed bits so
    // dailyPlanEngine + DailyPlanCard pick up the crop +
    // location on the next render.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('farroway_active_farm', JSON.stringify({
          farmType:        'small_farm',
          crop:            crop.trim() || null,
          cropLabel:       crop.trim() || null,
          country:         country.trim() || null,
          region:          region.trim() || null,
          sizeCategory:    (program && program.defaultFarmSize) || 'unknown',
          // Mark that the active farm came from a program
          // confirmation; admin surfaces can group on this
          // later.
          source:          (source && source.source) || 'ngo',
          programId:       (source && source.programId) || null,
          organizationId:  (source && source.organizationId) || null,
        }));
      }
    } catch { /* swallow */ }
    // Spec §8 — farmer_activated event fires once the
    // program farmer has confirmed enough to land on Today's
    // Plan. The analytics service auto-attaches programId +
    // organizationId from the active source.
    try { trackEvent('farmer_activated', { confirmed: { crop: !!crop, country: !!country } }); }
    catch { /* swallow */ }
    try { navigate('/program/welcome', { replace: true }); }
    catch { /* ignore */ }
  }

  return (
    <main
      style={S.page}
      data-testid="program-confirm"
      data-needs-crop={needsCrop ? 'true' : 'false'}
      data-needs-location={needsLocation ? 'true' : 'false'}
    >
      <div>
        <h1 style={S.title}>
          {tSafe('program.confirm.title', 'Confirm your farm details')}
        </h1>
        <p style={S.subtitle}>
          {tSafe('program.confirm.subtitle', 'Just two quick questions.')}
        </p>
      </div>

      {needsCrop ? (
        <section style={S.card}>
          <span style={S.label}>
            {tSafe('program.confirm.cropQuestion', 'Which crop are you growing?')}
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoComplete="off"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            style={S.input}
            data-testid="program-confirm-crop"
            maxLength={60}
          />
        </section>
      ) : null}

      {needsLocation ? (
        <section style={S.card}>
          <span style={S.label}>
            {tSafe('program.confirm.locationQuestion', 'Where is your farm?')}
          </span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoComplete="country-name"
            placeholder={tSafe('onboarding.selectCountry', 'Select country')}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={S.input}
            data-testid="program-confirm-country"
            maxLength={60}
          />
          <input
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoComplete="address-level1"
            placeholder={tSafe('onboarding.enterRegion', 'Enter region or state')}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={S.input}
            data-testid="program-confirm-region"
            maxLength={60}
          />
        </section>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        style={canContinue ? S.saveBtn : { ...S.saveBtn, ...S.saveBtnDisabled }}
        data-testid="program-confirm-continue"
      >
        {tSafe('program.confirm.continueCta', 'Continue to today\u2019s plan')}
      </button>
    </main>
  );
}
