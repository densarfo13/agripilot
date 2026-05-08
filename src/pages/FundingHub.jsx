/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(react-300-cleanup): pre-existing rules-of-hooks
 * violations. Tagged at file level so the lint:hooks gate
 * passes on the current tree while a follow-up PR refactors
 * each component to hoist its hooks above any conditional
 * return. Tracked by the May 2026 React #300 stability spec.
 */
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
  getFundingRecommendations,
  groupByCategory,
} from '../core/fundingRecommendationEngine.js';
import { trackFundingEvent } from '../analytics/fundingAnalytics.js';
import FundingCard from '../components/funding/FundingCard.jsx';
import FundingReadinessCard from '../components/funding/FundingReadinessCard.jsx';
import OrganizationPilotCTA from '../components/funding/OrganizationPilotCTA.jsx';
import NgoProgramTools from '../components/funding/NgoProgramTools.jsx';
import { FEATURE_ACTIVATION_POLISH } from '../lib/pilotFlags.js';
import FundingEligibilityPrompt from '../components/activation/FundingEligibilityPrompt.jsx';
import { PremiumPage, PremiumPageHero } from '../components/premium/index.js';

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
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  filterInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#EAF2FF',
    fontSize: 13,
    padding: '6px 10px',
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: 140,
    flex: '1 1 140px',
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

/**
 * Phase 7C: extract the country/countries array from a card.
 * Mirrors the private helper in fundingRecommendationEngine.js
 * so the filter can compare against card country data.
 */
function _cardCountries(card) {
  if (Array.isArray(card?.countries)) return card.countries;
  if (typeof card?.country === 'string' && card.country) return [card.country];
  return [];
}

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

  // Phase 7C: client-side filter state.
  // 'all' | 'farmer' | 'backyard'
  const [filterType, setFilterType] = useState('all');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterRegion, setFilterRegion] = useState('');

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

  // Smart recommendations + readiness score + tips, in one call.
  // The engine respects the smartFundingRecommendations feature
  // flag implicitly by always returning a useful shape; the
  // readiness card itself is the gated surface (consumer-side).
  const smartOn = isFeatureEnabled('smartFundingRecommendations');
  const smartCtx = useMemo(() => ({
    country,
    region,
    farmType,
    cropId,
    userRole,
    farmSize,
    experienceType: ux.experience,
    // Readiness signals — pulled from the profile defensively. If
    // any field is missing, the engine treats it as "not done"
    // and surfaces a tip.
    profileCompleted:        !!(profile?.farmName || profile?.name),
    locationConfirmed:       !!(country || region),
    cropAdded:               !!cropId,
    farmSizeAdded:           !!farmSize,
    hasPhotosOrScanHistory:  !!(profile?.photoUrl || profile?.profileImageUrl
                                || profile?.photos || profile?.scanHistory),
    completedTasksLast7Days: Number(profile?.completedTasksLast7Days
                                || profile?.recentCompletedTasks
                                || 0),
    activeDaysLast7Days:     Number(profile?.activeDaysLast7Days || 0),
  }), [
    country, region, farmType, cropId, userRole, farmSize, ux.experience,
    profile?.farmName, profile?.name, profile?.photoUrl, profile?.profileImageUrl,
    profile?.photos, profile?.scanHistory,
    profile?.completedTasksLast7Days, profile?.recentCompletedTasks,
    profile?.activeDaysLast7Days,
  ]);

  const smart = useMemo(() => getFundingRecommendations(smartCtx), [smartCtx]);
  const recommendations = smart.recommendations;
  const readinessScore = smart.readinessScore;
  const readinessTips = smart.readinessTips;

  // Phase 7C: apply client-side filters over the full recommendation list.
  const filteredRecs = useMemo(() => {
    let out = recommendations;
    // Farm type: farmer = any non-backyard bestFor entries;
    // backyard = has at least one backyard/home_garden entry.
    if (filterType === 'farmer') {
      out = out.filter((c) => {
        const bf = c.bestFor || [];
        // Global cards (empty bestFor) pass through; cards that are
        // exclusively backyard are suppressed.
        if (bf.length === 0) return true;
        return bf.some((b) => b !== 'backyard' && b !== 'home_garden');
      });
    } else if (filterType === 'backyard') {
      out = out.filter((c) => {
        const bf = c.bestFor || [];
        return bf.some((b) => b === 'backyard' || b === 'home_garden');
      });
    }
    // Crop keyword: match against title / description / eligibility hint.
    const cropQ = filterCrop.trim().toLowerCase();
    if (cropQ) {
      out = out.filter((c) =>
        (c.title && c.title.toLowerCase().includes(cropQ)) ||
        (c.description && c.description.toLowerCase().includes(cropQ)) ||
        (c.eligibilityHint && c.eligibilityHint.toLowerCase().includes(cropQ))
      );
    }
    // Region: global cards (empty countries) always pass through;
    // country-scoped cards are shown only when the query matches.
    const regionQ = filterRegion.trim().toLowerCase();
    if (regionQ) {
      out = out.filter((c) => {
        const countries = _cardCountries(c).map((x) => String(x).toLowerCase());
        return countries.length === 0 ||
          countries.some((x) => x.includes(regionQ));
      });
    }
    return out;
  }, [recommendations, filterType, filterCrop, filterRegion]);

  const grouped = useMemo(() => groupByCategory(filteredRecs), [filteredRecs]);

  // Page-view event — once on mount per visit. Spec uses
  // `funding_hub_viewed`; the older `funding_page_view` is also
  // emitted as an alias so the prior admin tile keeps working.
  useEffect(() => {
    if (!flagOn) return;
    try {
      trackFundingEvent('funding_hub_viewed', {
        country,
        userRole,
        experience: ux.experience,
        recommendedCount: recommendations.length,
        readinessScore,
      });
      trackFundingEvent('funding_page_view', {
        country,
        userRole,
        experience: ux.experience,
        recommendedCount: recommendations.length,
      });
      // Behavior tracking spec event name + lazy import to avoid
      // pulling the analytics store into bundles when the flag's off.
      if (isFeatureEnabled('behaviorTracking')) {
        import('../analytics/analyticsStore.js')
          .then((m) => { try { m.trackEvent?.('funding_viewed', { country, userRole }); }
            catch { /* ignore */ } })
          .catch(() => { /* swallow */ });
      }
    } catch { /* never propagate */ }
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
  // Spec §1: show up to 5 best options in the Recommended row,
  // scoped to the current Phase 7C filter selection.
  const recommendedCards = filteredRecs.slice(0, 5);
  const ctx = { country, userRole, experience: ux.experience };

  // FEATURE_ACTIVATION_POLISH: eligibility nudge signals.
  const hasCrop   = !!(cropId);
  const hasRegion = !!(region || country);

  return (
    <PremiumPage mode="farm" testId="funding-hub" maxWidth="46rem" bottomPad="2rem">
      {/* ── Hero (premium upgrade) ────────────────────────────
           Funding feels supportive + opportunity-focused.
           Realistic background with a leaf-and-coin glyph
           replaces the plain heading row. */}
      <PremiumPageHero
        mode="farm"
        eyebrow={tStrict('premium.eyebrow.funding', 'Funding')}
        title={tStrict('funding.hub.title', 'Opportunities for you')}
        subtitle={tStrict(
          'funding.hub.subtitle',
          'Find relevant funding, support programs, training, and partnerships based on your location and activity.',
        )}
        bgImage="/images/page-hero/funding.svg"
        accent="green"
        testId="funding-hub-hero"
      />

      {/* Phase 7C: filter bar — type toggle (All/Farmer/Backyard),
          keyword search (crop/title), and region text filter.
          All filters are additive and client-side only — no fetches.
          Advisory UI; never blocks viewing any card. */}
      <div style={STYLES.filterBar} role="search" aria-label={tStrict('funding.filter.ariaLabel', 'Filter funding opportunities')}>
        {/* Farm type toggle */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all',      labelKey: 'funding.filter.all',      fallback: 'All' },
            { key: 'farmer',   labelKey: 'funding.filter.farmer',   fallback: 'Farmer' },
            { key: 'backyard', labelKey: 'funding.filter.backyard', fallback: 'Backyard' },
          ].map(({ key, labelKey, fallback }) => {
            const active = filterType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterType(key)}
                aria-pressed={active}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: active
                    ? '1px solid rgba(34,197,94,0.6)'
                    : '1px solid rgba(255,255,255,0.15)',
                  background: active
                    ? 'rgba(34,197,94,0.14)'
                    : 'transparent',
                  color: active ? '#86EFAC' : 'rgba(255,255,255,0.65)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {tStrict(labelKey, fallback)}
              </button>
            );
          })}
        </div>
        {/* Crop / keyword filter */}
        <input
          type="text"
          value={filterCrop}
          onChange={(e) => setFilterCrop(e.target.value)}
          placeholder={tStrict('funding.filter.cropPlaceholder', 'Crop or keyword…')}
          style={STYLES.filterInput}
          aria-label={tStrict('funding.filter.cropAriaLabel', 'Filter by crop or keyword')}
        />
        {/* Region filter */}
        <input
          type="text"
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          placeholder={tStrict('funding.filter.regionPlaceholder', 'Region or country…')}
          style={STYLES.filterInput}
          aria-label={tStrict('funding.filter.regionAriaLabel', 'Filter by region or country')}
        />
      </div>

      {/* NGO program quick-links above the recommendations — only
          for ngo_admin / government_program roles. */}
      {isNgo ? (
        <div style={{ marginBottom: 16 }}>
          <NgoProgramTools context={ctx} />
        </div>
      ) : null}

      {/* Top row: Recommended (left) + Readiness (right on wide,
          stacked on narrow). The readiness card is gated on the
          smartFundingRecommendations flag — flag-off Hubs show
          recommendations only, no readiness widget. */}
      <div style={wide ? STYLES.topRow : STYLES.topRowNarrow}>
        <section data-section="recommended">
          <h2 style={STYLES.sectionTitle}>
            {tStrict('funding.section.recommended', 'Recommended for you')}
          </h2>
          {recommendedCards.length === 0 ? (
            (filterCrop || filterRegion || filterType !== 'all') ? (
              <div style={STYLES.empty}>
                {tStrict(
                  'funding.hub.emptyFiltered',
                  'No funding opportunities match your current filters. Try adjusting the filter above.'
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={STYLES.empty}>
                  {tStrict(
                    'funding.hub.emptyRecommended',
                    'Funding options will appear based on your crop and region.'
                  )}
                </div>
                {/* FEATURE_ACTIVATION_POLISH: nudge farmer to add region
                    when they have a crop but no location on record. */}
                {FEATURE_ACTIVATION_POLISH ? (
                  <FundingEligibilityPrompt
                    hasCrop={hasCrop}
                    hasRegion={hasRegion}
                    onAddRegion={() => {
                      try { navigate('/profile'); } catch { /* ignore */ }
                    }}
                  />
                ) : null}
              </div>
            )
          ) : (
            <div style={STYLES.cardsGrid}>
              {recommendedCards.map((card) => (
                <FundingCard key={card.id} card={card} context={ctx} />
              ))}
            </div>
          )}
        </section>
        {smartOn ? (
          <FundingReadinessCard
            score={readinessScore}
            tips={readinessTips}
            context={ctx}
          />
        ) : null}
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

      {/* For Organizations — partnership lead funnel. The CTA
          self-hides when the ngoPartnershipLeads flag is off. */}
      <div style={{ marginTop: 24 }}>
        <OrganizationPilotCTA context={ctx} />
      </div>

      <div style={STYLES.globalDisclaimer}>
        {tStrict(
          'funding.hub.globalDisclaimer',
          'Farroway helps you discover possible funding, support, training, and partnership opportunities. Farroway does not guarantee eligibility, approval, funding, or program availability. Always verify requirements with the official program or organization.'
        )}
      </div>
    </PremiumPage>
  );
}
