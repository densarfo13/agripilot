/**
 * Opportunities — farmer-facing funding & support discovery
 * page.
 *
 *   <Route path="/opportunities" element={<Opportunities />} />
 *
 * Spec contract (Funding Layer, § 5)
 *   * Title: "Funding & Support"
 *   * Subtitle: "Programs that may support your farm."
 *   * One card per matched opportunity with: title, type
 *     badge, benefit, deadline, why-matched, source, CTA.
 *   * Empty state: "No matching opportunities yet. Check
 *     again later."
 *
 * Trust + compliance audit (per spec § 13)
 *   * Wording is conservative throughout:
 *       "May qualify"
 *       "Check requirements before applying"
 *       "Matches your region" (not "you qualify")
 *       "Currently active" (not "approved")
 *   * Every card carries the source name + verified badge.
 *     Sample (demo) entries also show a SAMPLE pill so a
 *     farmer never mistakes the seed for a real program.
 *   * The "Learn More" link opens the source URL in a new
 *     tab AND fires FUNDING_OPPORTUNITY_CLICKED for ops
 *     analytics. Click does NOT submit any application —
 *     the farmer always confirms with the source first.
 */

import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { getActiveFundingOpportunities, FUNDING_EVENTS }
  from '../funding/fundingStore.js';
import { matchFundingForFarm } from '../funding/fundingMatcher.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

const TYPE_LABELS = Object.freeze({
  grant:         'Grant',
  subsidy:       'Subsidy',
  loan:          'Loan',
  training:      'Training',
  input_support: 'Input Support',
});

export default function Opportunities() {
  const { profile, farms } = useProfile();

  // Pick the active farm (same convention as Sell.jsx). The
  // matcher is tolerant of missing fields so we still get
  // sensible matches even when geo / crop is blank.
  const activeFarm = useMemo(() => {
    if (Array.isArray(farms) && farms.length) return farms[0];
    return profile || null;
  }, [farms, profile]);

  const matches = useMemo(() => {
    const opps = getActiveFundingOpportunities();
    return matchFundingForFarm(activeFarm, opps);
  }, [activeFarm]);

  // Fire FUNDING_OPPORTUNITY_VIEWED once + FUNDING_MATCH_SHOWN
  // once-per-match so ops can grep how many farmers saw what.
  useEffect(() => {
    try { safeTrackEvent(FUNDING_EVENTS.VIEWED, { matches: matches.length }); }
    catch { /* analytics never blocks */ }
    for (const m of matches) {
      try {
        safeTrackEvent(FUNDING_EVENTS.MATCH_SHOWN, {
          opportunityId: m.opportunity.id,
          score:         m.score,
        });
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length]);

  return (
    <main style={S.page} data-testid="opportunities-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.title}>
            {tSafe('funding.title', 'Funding & Support')}
          </h1>
          <p style={S.lead}>
            {tSafe('funding.subtitle',
              'Programs that may support your farm.')}
          </p>
          <p style={S.honesty}>
            {tSafe('funding.checkRequirements',
              'Check requirements before applying. Always contact the source to confirm eligibility.')}
          </p>
        </header>

        {matches.length === 0 ? (
          <div style={S.empty} data-testid="opportunities-empty">
            <span style={S.emptyIcon} aria-hidden="true">🌱</span>
            <p style={S.emptyText}>
              {tSafe('funding.noMatches',
                'No matching opportunities yet. Check again later.')}
            </p>
            <p style={S.emptyHint}>
              {tSafe('funding.noMatchesHint',
                'New programs are added regularly. Make sure your crop and region are set on your farm so we can match you.')}
            </p>
          </div>
        ) : (
          <ul style={S.grid} data-testid="opportunities-list">
            {matches.map((m) => (
              <li key={m.opportunity.id} style={S.tile}>
                <OpportunityCard match={m} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

/* ─── Card ────────────────────────────────────────────── */

function OpportunityCard({ match }) {
  const { opportunity: o, reasons } = match;

  const deadlineLabel = o.deadline
    ? new Date(o.deadline).toLocaleDateString(undefined,
        { month: 'short', day: 'numeric', year: 'numeric' })
    : tSafe('funding.deadlineRolling', 'Rolling — no deadline');

  function handleViewDetails() {
    // Surface-side log so ops can grep how many cards
    // converted from list → detail. Detail page fires its
    // own VIEWED event on mount.
    try {
      safeTrackEvent(FUNDING_EVENTS.CLICKED, {
        opportunityId: o.id, type: o.opportunityType,
        from: 'list',
      });
    } catch { /* ignore */ }
  }

  return (
    <article style={cardStyles.card}>
      <div style={cardStyles.headerRow}>
        <span style={cardStyles.typeBadge}>
          {TYPE_LABELS[o.opportunityType] || 'Program'}
        </span>
        {o.sample && (
          <span
            style={cardStyles.samplePill}
            title="Sample / demo entry — replace with a real opportunity before launch"
          >
            SAMPLE
          </span>
        )}
        {!o.sample && o.verified && (
          <span style={cardStyles.verifiedPill}>
            ✓ {tSafe('funding.verifiedSource', 'Verified source')}
          </span>
        )}
      </div>

      <h2 style={cardStyles.title}>{o.title}</h2>
      <p  style={cardStyles.desc}>{o.description}</p>

      {o.benefit && (
        <div style={cardStyles.benefit}>
          <span style={cardStyles.benefitLabel}>
            {tSafe('funding.benefit', 'Benefit')}
          </span>
          <span style={cardStyles.benefitVal}>{o.benefit}</span>
        </div>
      )}

      {/* Why matched — uses the matcher's reason strings.
          Wording is "matches your region", "supports your
          crop" — never "you qualify". */}
      {Array.isArray(reasons) && reasons.length > 0 && (
        <div style={cardStyles.reasons}>
          <p style={cardStyles.reasonsLabel}>
            {tSafe('funding.whyMatched', 'Why this matches')}
          </p>
          <ul style={cardStyles.reasonList}>
            {reasons.map((r) => (
              <li key={r} style={cardStyles.reasonItem}>
                <span style={cardStyles.reasonDot} aria-hidden="true">•</span>
                {r}
              </li>
            ))}
            <li style={cardStyles.mayQualify}>
              {tSafe('funding.mayQualify',
                'You may qualify — confirm with the source.')}
            </li>
          </ul>
        </div>
      )}

      <div style={cardStyles.metaRow}>
        <span style={cardStyles.meta}>
          📅 {tSafe('funding.deadline', 'Deadline')}: {deadlineLabel}
        </span>
        {o.sourceName && (
          <span style={cardStyles.meta}>
            🏛️ {tSafe('funding.source', 'Source')}: {o.sourceName}
          </span>
        )}
      </div>

      {/* Card CTA — always routes through the detail page so
          farmers see the full Apply / Request Help / Mark
          Applied flow before they leave Farroway. The detail
          page handles the actual external Apply Now click. */}
      <Link
        to={`/opportunities/${o.id}`}
        onClick={handleViewDetails}
        style={cardStyles.btn}
        data-testid={`opportunity-view-${o.id}`}
      >
        {tSafe('funding.viewDetails', 'View Details')} →
      </Link>
    </article>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const cardStyles = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
    height: '100%',
  },
  headerRow: { display: 'flex', alignItems: 'center',
               flexWrap: 'wrap', gap: '0.4rem' },
  typeBadge: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.15)',
    color: C.lightGreen,
    border: '1px solid rgba(34,197,94,0.40)',
  },
  samplePill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(245,158,11,0.18)',
    color: '#FCD34D',
    border: '1px solid rgba(245,158,11,0.45)',
  },
  verifiedPill: {
    fontSize: '0.6875rem', fontWeight: 800,
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  title: {
    margin: '0.15rem 0 0',
    fontSize: '1.0625rem', fontWeight: 800,
    color: C.white, lineHeight: 1.25,
    letterSpacing: '-0.005em',
  },
  desc: {
    margin: 0,
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.9375rem', lineHeight: 1.55,
  },
  benefit: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.20)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  benefitLabel: {
    color: C.lightGreen, fontSize: '0.6875rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  benefitVal: { color: C.white, fontWeight: 700,
                fontSize: '0.9375rem' },
  reasons: { display: 'flex', flexDirection: 'column',
             gap: '0.25rem' },
  reasonsLabel: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  reasonList: { listStyle: 'none', margin: 0, padding: 0,
                display: 'flex', flexDirection: 'column',
                gap: '0.15rem' },
  reasonItem: { color: 'rgba(255,255,255,0.85)',
                fontSize: '0.875rem', display: 'flex',
                alignItems: 'flex-start', gap: '0.4rem' },
  reasonDot:  { color: C.lightGreen, fontWeight: 800 },
  mayQualify: {
    marginTop: '0.25rem',
    color: '#FCD34D',
    fontSize: '0.8125rem',
    fontStyle: 'italic',
  },
  metaRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.65rem',
    color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem',
  },
  meta: { display: 'inline-flex', alignItems: 'center', gap: '0.25rem' },
  btn: {
    marginTop: '0.4rem',
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    border: 'none',
    background: C.green,
    color: C.white,
    fontSize: '0.9375rem', fontWeight: 800,
    cursor: 'pointer', textDecoration: 'none',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
};

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '64rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  header: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', gap: '0.5rem',
  },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 800,
           letterSpacing: '-0.01em', color: C.white },
  lead:  { margin: 0, color: 'rgba(255,255,255,0.7)',
           fontSize: '0.9375rem', maxWidth: '38rem' },
  honesty: {
    margin: '0.25rem 0 0',
    color: '#FCD34D', fontSize: '0.8125rem',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
  },
  grid: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'grid', gap: '0.85rem',
    gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
  },
  tile: { display: 'flex' },
  empty: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '2rem 1.25rem',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: '0.5rem',
  },
  emptyIcon: { fontSize: '2rem' },
  emptyText: { margin: 0, fontSize: '1rem', fontWeight: 700,
               color: C.white },
  emptyHint: { margin: 0, color: 'rgba(255,255,255,0.6)',
               fontSize: '0.875rem', maxWidth: '28rem' },
};
