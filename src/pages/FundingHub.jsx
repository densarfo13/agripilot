/**
 * FundingHub — region- and role-aware funding directory at /funding.
 *
 * Position
 * ────────
 * Coexists with the existing per-farm matcher at /opportunities
 * (`src/funding/*` + `src/pages/Opportunities.jsx`). Different
 * shape, different intent: the matcher scores live opportunities
 * for a specific farm; the Hub curates programs by country + role.
 *
 * Sections (per spec §5)
 *   1. Recommended for you   ← top 6 from recommendation engine
 *   2. Government programs   ← category === 'government'
 *   3. NGO / nonprofit       ← category === 'ngo'
 *   4. Cooperative support   ← category === 'cooperative'
 *   5. Training & extension  ← category === 'training'
 *   6. Partnership ops       ← category === 'partnership'
 *
 * The Apply Readiness Checklist sits in a sidebar on wide
 * screens, above the recommendations on narrow screens.
 *
 * NGO / government_program roles also see the NgoProgramTools
 * panel near the top.
 *
 * Strict-rule audit
 *   • Reads through `useProfile()` (no new fetches).
 *   • Renders nothing crash-worthy when profile / region is missing.
 *   • All visible chrome via tStrict; card data is plain English
 *     program names (real third-party programs).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { resolveRegionUX } from '../core/regionUXEngine.js';
import {
  recommendFundingPrograms,
  groupByCategory,
} from '../core/fundingRecommendationEngine.js';
import { trackFundingEvent } from '../analytics/fundingAnalytics.js';
import FundingCard from '../components/funding/FundingCard.jsx';
import ApplyReadinessChecklist from '../components/funding/ApplyReadinessChecklist.jsx';
import NgoProgramTools from '../components/funding/NgoProgramTools.jsx';

const NGO_ROLES = new Set(['ngo_admin', 'government_program']);

const SECTION_ORDER = [
  { key: 'government',  labelKey: 'funding.section.government',  fallback: 'Government programs' },
  { key: 'ngo',         labelKey: 'funding.section.ngo',         fallback: 'NGO / nonprofit support' },
  { key: 'cooperative', labelKey: 'funding.section.cooperative', fallback: 'Cooperative support' },
  { key: 'training',    labelKey: 'funding.section.training',    fallback: 'Training & extension services' },
  { key: 'partnership', labelKey: 'funding.section.partnership', fallback: 'Partnership opportunities' },
];

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '20px 16px 96px',
    maxWidth: 1180,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 },
  topRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
    gap: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  topRowNarrow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    margin: '24px 0 12px',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  empty: {
    padding: '20px 16px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.10)',
    borderRadius: 14,
  },
  globalDisclaimer: {
    marginTop: 24,
    padding: '12px 14px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.32)',
    borderRadius: 10,
    lineHeight: 1.5,
  },
  flagOff: {
    padding: '24px 20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
};

function _useViewportWide(threshold = 880) {
  const [wide, setWide] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= threshold;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWide(window.innerWidth >= threshold);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [threshold]);
  return wide;
}

/**
 * Coerce the V1 zustand role / V2 profile role into the funding
 * userRole tags. Falls back to 'farmer' when nothing is set.
 */
function _resolveFundingRole({ profile, authRole }) {
  // Caller may pass an explicit role override (e.g. via query
  // string); otherwise infer from profile + auth.
  if (profile && profile.fundingRole) return profile.fundingRole;
  if (authRole) {
    if (authRole === 'institutional_admin' || authRole === 'super_admin') return 'ngo_admin';
    if (authRole === 'reviewer' || authRole === 'field_officer') return 'extension_partner';
  }
  // Backyard hint when farmType matches.
  const farmType = String(profile?.farmType || '').toLowerCase();
  if (farmType === 'backyard' || farmType === 'home_garden') return 'backyard_grower';
  return 'farmer';
}

export default function FundingHub() {
  const navigate = useNavigate();
  // Subscribe to language change so chrome refreshes on flip.
  useTranslation();

  let profile = null;
  let authRole = null;
  try {
    const ctx = useProfile();
    profile = ctx?.profile || null;
  } catch { profile = null; }
  try {
    // The auth user role is read via the existing zustand store
    // at the top of App.jsx; we don't reach into it here to keep
    // the page safely renderable in isolation. Instead, use the
    // profile.role hint if present.
    authRole = profile?.role || profile?.authRole || null;
  } catch { authRole = null; }

  const wide = _useViewportWide();
  const flagOn = isFeatureEnabled('fundingHub');

  const country = profile?.country || profile?.countryCode || null;
  const region  = profile?.region || null;
  const farmType = profile?.farmType || profile?.type || null;
  // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
  const cropId  = profile?.crop || null;
  const farmSize = profile?.landSizeHectares || profile?.farmSize || null;
  const userRole = _resolveFundingRole({ profile, authRole });

  // Resolve the experience even when the regionUxSystem flag is
  // off — funding routing only needs the experience tag, not the
  // banner. This lets the Hub work independently of the region
  // banner rollout.
  const ux = useMemo(() => resolveRegionUX({
    detectedCountry: country,
    detectedRegion:  region,
    farmType,
  }), [country, region, farmType]);

  // Recommendation list. Memoised on the inputs so a parent
  // re-render doesn't re-score the catalog.
  const recommendations = useMemo(() => recommendFundingPrograms({
    country,
    region,
    farmType,
    cropId,
    userRole,
    farmSize,
    experienceType: ux.experience,
    limit: 12,
  }), [country, region, farmType, cropId, userRole, farmSize, ux.experience]);

  const grouped = useMemo(() => groupByCategory(recommendations), [recommendations]);

  // Page-view event — once on mount per visit.
  useEffect(() => {
    if (!flagOn) return;
    try {
      trackFundingEvent('funding_page_view', {
        country,
        userRole,
        experience: ux.experience,
        recommendedCount: recommendations.length,
      });
    } catch { /* never propagate */ }
    // We intentionally fire only once on mount — re-firing on
    // every state change inflates the analytics signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn]);

  if (!flagOn) {
    return (
      <main style={STYLES.page} data-screen="funding-hub" data-flag="off">
        <h1 style={STYLES.title}>
          {tStrict('funding.hub.title', 'Funding & Support')}
        </h1>
        <div style={{ ...STYLES.flagOff, marginTop: 16 }}>
          {tStrict(
            'funding.hub.flagOff',
            'The Funding Hub is being rolled out gradually. Check back soon.'
          )}
          <div style={{ marginTop: 10 }}>
            <a
              href="/dashboard"
              onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}
              style={{ color: '#22C55E', textDecoration: 'underline' }}
            >
              {tStrict('common.back', 'Back')}
            </a>
          </div>
        </div>
      </main>
    );
  }

  const isNgo = NGO_ROLES.has(userRole);
  const recommendedCards = recommendations.slice(0, 6);
  const ctx = { country, userRole, experience: ux.experience };

  return (
    <main style={STYLES.page} data-screen="funding-hub" data-flag="on" data-experience={ux.experience}>
      <div style={STYLES.header}>
        <div>
          <h1 style={STYLES.title}>
            {tStrict('funding.hub.title', 'Funding & Support')}
          </h1>
          <p style={STYLES.subtitle}>
            {tStrict(
              'funding.hub.subtitle',
              'Programs and partners that may fit your farm and country. Verify each option with the official program before applying.'
            )}
          </p>
        </div>
      </div>

      {/* Top row: Recommended (left) + Readiness (right on wide,
          stacked on narrow). NGO tools mount above when applicable. */}
      {isNgo ? (
        <div style={{ marginBottom: 16 }}>
          <NgoProgramTools context={ctx} />
        </div>
      ) : null}

      <div style={wide ? STYLES.topRow : STYLES.topRowNarrow}>
        <section data-section="recommended">
          <h2 style={STYLES.sectionTitle}>
            {tStrict('funding.section.recommended', 'Recommended for you')}
          </h2>
          {recommendedCards.length === 0 ? (
            <div style={STYLES.empty}>
              {tStrict(
                'funding.hub.emptyRecommended',
                'No tailored matches yet. Add your country, crop, and farm size to get better recommendations.'
              )}
            </div>
          ) : (
            <div style={STYLES.cardsGrid}>
              {recommendedCards.map((card) => (
                <FundingCard key={card.id} card={card} context={ctx} />
              ))}
            </div>
          )}
        </section>
        <ApplyReadinessChecklist
          farm={profile}
          tasks={null}
          impactData={profile?.impactData || null}
          context={ctx}
        />
      </div>

      {/* Categorised sections — show only buckets that have cards. */}
      {SECTION_ORDER.map((sec) => {
        const cards = grouped.get(sec.key) || [];
        if (cards.length === 0) return null;
        return (
          <section key={sec.key} data-section={sec.key}>
            <h2 style={STYLES.sectionTitle}>
              {tStrict(sec.labelKey, sec.fallback)}
            </h2>
            <div style={STYLES.cardsGrid}>
              {cards.map((card) => (
                <FundingCard key={card.id} card={card} context={ctx} />
              ))}
            </div>
          </section>
        );
      })}

      <div style={STYLES.globalDisclaimer}>
        {tStrict(
          'funding.hub.globalDisclaimer',
          'Farroway shows publicly-available program information. We do not guarantee funding. Always verify requirements with the official program before applying.'
        )}
      </div>
    </main>
  );
}
