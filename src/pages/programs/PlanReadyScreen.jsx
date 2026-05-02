/**
 * PlanReadyScreen.jsx — first-login screen for NGO/program
 * farmers (NGO Onboarding spec §5).
 *
 *   <Route path="/program/welcome" element={<PlanReadyScreen />} />
 *
 * What the user sees
 * ──────────────────
 *   Title:    "Your farming plan is ready"
 *   Subtitle: "Your program has set this up for you."
 *   Below the header: the SAME Today's Plan card the
 *     individual farmer sees on /home, surfaced verbatim so
 *     the imported farmer's first interaction is reading the
 *     priority + tasks + scan CTA + Ask Farroway, not picking
 *     a country.
 *   Optional small link: "Edit my farm" → existing /edit-farm
 *     surface.
 *
 * Routing rule (§1)
 * ─────────────────
 * The route guard above this page (App.jsx) sends ngo /
 * program farmers HERE when they arrive at /home or /today
 * for the first time. Existing individual users keep their
 * /home destination.
 *
 * Strict-rule audit
 *   • Reads from existing stores only — no new I/O.
 *   • Falls back to the canonical Plan Ready copy when the
 *     program record can't be loaded (e.g. fresh install
 *     after an export/import).
 *   • Inline styles only.
 *   • All visible text via tSafe.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getFarmerSource } from '../../core/farmerSource.js';
import { getProgram } from '../../core/programs/programStore.js';
import { trackEvent } from '../../core/analytics.js';
import DailyPlanCard from '../../components/daily/DailyPlanCard.jsx';

const C = {
  bg:       '#0B1D34',
  card:     'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.10)',
  ink:      '#EAF2FF',
  inkSoft:  'rgba(255,255,255,0.65)',
  green:    '#22C55E',
  greenInk: '#062714',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '32px 16px 96px',
    boxSizing: 'border-box',
    maxWidth: 560,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 4,
  },
  title:    { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 14, color: C.inkSoft, lineHeight: 1.45 },
  programTag: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 600,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    padding: '4px 10px',
    borderRadius: 999,
  },
  editLink: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: '#9FB3C8',
    fontSize: 13,
    textAlign: 'center',
    padding: 8,
    textDecoration: 'underline',
  },
};

export default function PlanReadyScreen() {
  useTranslation();
  const navigate = useNavigate();

  const source  = React.useMemo(() => {
    try { return getFarmerSource(); } catch { return null; }
  }, []);
  const program = React.useMemo(() => {
    if (!source || !source.programId) return null;
    try { return getProgram(source.programId); } catch { return null; }
  }, [source]);

  // NGO Onboarding spec §8 — fire daily_plan_viewed once per
  // mount with the program / org IDs auto-attached by the
  // analytics service. We don't gate on FEATURE_DAILY_INTELLIGENCE
  // because this surface is reached only by program farmers.
  React.useEffect(() => {
    try {
      trackEvent('daily_plan_viewed', {
        screen: 'plan_ready',
      });
    } catch { /* swallow */ }
  }, []);

  // Build the farm-shape input DailyPlanCard expects from the
  // program defaults so the engine produces a real plan even
  // BEFORE a full farm record exists. The card itself
  // tolerates missing fields and falls through to the spec's
  // §8 fallback path when a field is null.
  const farm = React.useMemo(() => {
    const p = program || {};
    return {
      id:              source && source.farmerId ? `program_${source.farmerId}` : 'program_farmer',
      farmType:        'small_farm',
      crop:            p.cropFocus || null,
      cropLabel:       p.cropFocus || null,
      country:         p.country   || null,
      region:          p.region    || null,
      sizeCategory:    p.defaultFarmSize || 'unknown',
      farmSize:        null,
      sizeUnit:        null,
    };
  }, [program, source]);

  const programName = (program && program.programName) || null;

  return (
    <main
      style={S.page}
      data-testid="program-plan-ready"
      data-source={source ? source.source : 'unknown'}
    >
      <div style={S.hero}>
        {programName ? (
          <span style={S.programTag} data-testid="program-tag">
            {programName}
          </span>
        ) : null}
        <h1 style={S.title} data-testid="program-plan-ready-title">
          {tSafe('program.planReady.title', 'Your farming plan is ready')}
        </h1>
        <p style={S.subtitle}>
          {tSafe('program.planReady.subtitle',
            'Your program has set this up for you.')}
        </p>
      </div>

      {/* Reuse the canonical Today's Plan surface so the user
          sees the same engine output an individual farmer
          would see. Includes priority, tasks, scan CTA,
          progress, streak, etc. */}
      <DailyPlanCard farm={farm} weather={null} weatherStale={false} />

      <button
        type="button"
        onClick={() => { try { navigate('/edit-farm'); } catch { /* ignore */ } }}
        style={S.editLink}
        data-testid="program-edit-farm"
      >
        {tSafe('program.planReady.editFarm', 'Edit my farm')}
      </button>
    </main>
  );
}
