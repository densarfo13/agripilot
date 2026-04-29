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
import { useAuth } from '../context/AuthContext.jsx';
import { getActiveFundingOpportunities, FUNDING_EVENTS }
  from '../funding/fundingStore.js';
import { matchFundingForFarm } from '../funding/fundingMatcher.js';
// Spec §3 (now un-deferred): My Applications data source.
// fundingApplicationStore is the canonical store for buyer-side
// interest records — read-only here; nothing on this page mutates
// the store.
import {
  getFarmerInterests, saveFundingInterest, findInterest, INTEREST_STATUS,
} from '../funding/fundingApplicationStore.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';
import { ArrowRight } from '../components/icons/lucide.jsx';

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
  const { user } = useAuth() || {};
  // Same pattern FundingOpportunityDetail uses to identify the
  // current farmer — falls through gracefully when offline / no
  // session (returns []).
  const farmerId = user?.sub || profile?.userId || null;

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

  // My Applications — join the farmer's stored interests to the
  // opportunity title so we can render `{title} — {status}` rows
  // without a network call. Re-runs only when the farmerId
  // changes; status updates from elsewhere will surface on the
  // next mount (acceptable for a read-only summary surface).
  const myApplications = useMemo(() => {
    if (!farmerId) return [];
    let interests;
    try { interests = getFarmerInterests(farmerId); }
    catch { interests = []; }
    if (!Array.isArray(interests) || interests.length === 0) return [];
    const opps = getActiveFundingOpportunities() || [];
    const byId = new Map(opps.map((o) => [o.id, o]));
    return interests.map((i) => ({
      id:           i.id,
      opportunityId:i.opportunityId,
      title:        byId.get(i.opportunityId)?.title
                    || tSafe('funding.app.unknownOpportunity', 'Funding opportunity'),
      status:       i.status || INTEREST_STATUS.INTERESTED,
      updatedAt:    i.updatedAt || i.createdAt || 0,
    })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId]);

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
          <>
            {/* Priority card — the highest-scoring match is
                promoted to a prominent card with Apply Now /
                Request Help / Save for later buttons (matches
                the funding spec §3 visual ref). The remaining
                matches render as a compact list below, capped
                at 3 per spec to keep the screen "max 1-2 cards
                visible". Same data, same routes — visual only. */}
            <PriorityOpportunityCard
              match={matches[0]}
              farmerId={farmerId}
              farmId={activeFarm?.id || profile?.farmId || null}
            />

            {matches.length > 1 && (
              <section
                style={S.otherSection}
                data-testid="opportunities-other"
              >
                <h2 style={S.otherTitle}>
                  {tSafe('funding.otherOpportunities', 'Other Opportunities')}
                </h2>
                <ul style={S.otherList}>
                  {matches.slice(1, 4).map((m) => (
                    <li key={m.opportunity.id}>
                      <OpportunityListRow match={m} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Spec §3: My Applications. Read-only join of stored
            interests × active opportunities. Always renders a
            section (with an empty-state line when there are no
            applications) so the farmer sees the slot's intent. */}
        <MyApplicationsSection items={myApplications} />
      </div>
    </main>
  );
}

/* ─── My Applications (read-only summary) ──────────── */

function MyApplicationsSection({ items }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <section
      style={S.otherSection}
      data-testid="opportunities-my-applications"
    >
      <h2 style={S.otherTitle}>
        {tSafe('funding.myApplications.title', 'My applications')}
      </h2>
      {list.length === 0 ? (
        <div
          style={appStyles.empty}
          data-testid="opportunities-my-applications-empty"
        >
          {tSafe('funding.myApplications.empty', 'No applications yet')}
        </div>
      ) : (
        <ul style={S.otherList}>
          {list.map((a) => (
            <li key={a.id}>
              <Link
                to={`/opportunities/${a.opportunityId}`}
                style={appStyles.row}
                data-testid={`opportunities-my-app-${a.id}`}
              >
                <span style={appStyles.label}>{a.title}</span>
                <span style={appStyles.status} data-status={a.status}>
                  {_statusLabel(a.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Map INTEREST_STATUS values to localised labels. Each status
// gets a short, farmer-readable string. Keys live under
// `funding.myApplications.status.*`.
function _statusLabel(status) {
  switch (status) {
    case INTEREST_STATUS.INTERESTED:
      return tSafe('funding.myApplications.status.interested',           'Interested');
    case INTEREST_STATUS.ASSISTANCE_REQUESTED:
      return tSafe('funding.myApplications.status.assistanceRequested',  'Help requested');
    case INTEREST_STATUS.APPLIED:
      return tSafe('funding.myApplications.status.applied',              'Applied');
    case INTEREST_STATUS.CONTACTED:
      return tSafe('funding.myApplications.status.contacted',            'Contacted');
    default:
      return tSafe('funding.myApplications.status.unknown',              'Pending');
  }
}

/* ─── Priority card (top match) ────────────────────────
   Promotes match[0] to a dedicated card matching the visual
   reference: title, benefit, deadline, why-matched bullets,
   Apply Now (primary green) + Request Help (secondary navy).
   Both buttons route through /opportunities/:id so the existing
   detail-page Apply / Mark Applied flow remains the source of
   truth. The `?intent=help` query is set on Request Help so the
   detail page can surface a help affordance once wired. */

function PriorityOpportunityCard({ match, farmerId, farmId }) {
  const { opportunity: o, reasons } = match;

  // F-spec §3 "Save for later": secondary action that records the
  // farmer's interest at INTERESTED status without leaving the
  // page. Confirms inline via a 4-second toast so the farmer
  // sees the save took effect. Initial state checks the store so
  // a previously-saved opportunity shows "Saved" instead of the
  // active CTA on subsequent visits.
  const initialSaved = React.useMemo(() => {
    if (!farmerId) return false;
    try {
      const existing = findInterest({ farmerId, opportunityId: o.id });
      return Boolean(existing);
    } catch { return false; }
  }, [farmerId, o.id]);
  const [saved, setSaved] = React.useState(initialSaved);
  const [savedToast, setSavedToast] = React.useState(false);

  const deadlineLabel = o.deadline
    ? new Date(o.deadline).toLocaleDateString(undefined,
        { month: 'short', day: 'numeric', year: 'numeric' })
    : tSafe('funding.deadlineRolling', 'Rolling — no deadline');

  function handleClick(intent) {
    try {
      safeTrackEvent(FUNDING_EVENTS.CLICKED, {
        opportunityId: o.id, type: o.opportunityType,
        from: 'priority', intent,
      });
    } catch { /* ignore */ }
  }

  function handleSaveForLater() {
    if (saved) return;
    try {
      saveFundingInterest({
        farmerId, farmId,
        opportunityId: o.id,
        status: INTEREST_STATUS.INTERESTED,
      });
      setSaved(true);
      setSavedToast(true);
      // Hide toast after a beat — the persistent "Saved" pill on
      // the button is the durable signal.
      setTimeout(() => setSavedToast(false), 4000);
      try {
        safeTrackEvent(FUNDING_EVENTS.CLICKED, {
          opportunityId: o.id, type: o.opportunityType,
          from: 'priority', intent: 'save',
        });
      } catch { /* ignore */ }
    } catch { /* never throw from a save click */ }
  }

  return (
    <article
      style={priorityStyles.card}
      data-testid={`opportunity-priority-${o.id}`}
    >
      <h2 style={priorityStyles.title}>{o.title}</h2>

      {o.benefit && (
        <p style={priorityStyles.benefit}>{o.benefit}</p>
      )}

      <p style={priorityStyles.deadline}>
        {tSafe('funding.deadline', 'Deadline')}: {deadlineLabel}
      </p>

      {Array.isArray(reasons) && reasons.length > 0 && (
        <ul style={priorityStyles.reasonList}>
          {reasons.slice(0, 3).map((r) => (
            <li key={r} style={priorityStyles.reasonItem}>
              <span aria-hidden="true">✓</span> {r}
            </li>
          ))}
        </ul>
      )}

      {/* What-to-expect — three bullet lines that set honest
          expectations BEFORE the farmer taps Apply. Trust-safe
          per spec §6: explicitly says "approval not guaranteed". */}
      <div style={priorityStyles.expect}>
        <p style={priorityStyles.expectLabel}>
          {tSafe('funding.whatToExpect', 'What to expect')}
        </p>
        <ul style={priorityStyles.expectList}>
          <li style={priorityStyles.expectItem}>
            <span aria-hidden="true">•</span>
            {tSafe('funding.whatToExpect.application',
              'Application required')}
          </li>
          <li style={priorityStyles.expectItem}>
            <span aria-hidden="true">•</span>
            {tSafe('funding.whatToExpect.review',
              'Review by organization')}
          </li>
          <li style={priorityStyles.expectItem}>
            <span aria-hidden="true">•</span>
            {tSafe('funding.whatToExpect.notGuaranteed',
              'Approval not guaranteed')}
          </li>
        </ul>
      </div>

      <div style={priorityStyles.btnRow}>
        <Link
          to={`/opportunities/${o.id}?intent=apply`}
          onClick={() => handleClick('apply')}
          style={{ ...priorityStyles.btn, ...priorityStyles.btnPrimary }}
          data-testid={`opportunity-priority-apply-${o.id}`}
        >
          {tSafe('funding.applyNow', 'Apply Now')}
        </Link>
        <Link
          to={`/opportunities/${o.id}?intent=help`}
          onClick={() => handleClick('help')}
          style={{ ...priorityStyles.btn, ...priorityStyles.btnSecondary }}
          data-testid={`opportunity-priority-help-${o.id}`}
        >
          {tSafe('funding.requestHelp', 'Request Help')}
        </Link>
      </div>

      {/* Secondary "Save for later" — ghost button so it doesn't
          compete with the primary CTAs. Disabled (and labelled
          "Saved") once the farmer has saved this opportunity. */}
      <button
        type="button"
        onClick={handleSaveForLater}
        disabled={saved}
        style={{
          ...priorityStyles.saveBtn,
          ...(saved ? priorityStyles.saveBtnSaved : {}),
        }}
        data-testid={`opportunity-priority-save-${o.id}`}
        aria-pressed={saved ? 'true' : 'false'}
      >
        {saved
          ? tSafe('funding.saved', 'Saved')
          : tSafe('funding.saveForLater', 'Save for later')}
      </button>

      {savedToast && (
        <p
          style={priorityStyles.savedToast}
          role="status"
          aria-live="polite"
          data-testid="opportunity-priority-saved-toast"
        >
          {tSafe('funding.savedToast',
            'Saved to your applications. Open it any time to apply.')}
        </p>
      )}
    </article>
  );
}

/* ─── List row (secondary matches) ─────────────────────
   Compact one-line entry — title on the left, ArrowRight on
   the right. Tap routes to the existing detail page; same
   analytics event as the full card click. */

function OpportunityListRow({ match }) {
  const { opportunity: o } = match;

  function handleClick() {
    try {
      safeTrackEvent(FUNDING_EVENTS.CLICKED, {
        opportunityId: o.id, type: o.opportunityType,
        from: 'list_row',
      });
    } catch { /* ignore */ }
  }

  return (
    <Link
      to={`/opportunities/${o.id}`}
      onClick={handleClick}
      style={rowStyles.row}
      data-testid={`opportunity-row-${o.id}`}
    >
      <span style={rowStyles.label}>{o.title}</span>
      <span style={rowStyles.arrow} aria-hidden="true">
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}

/* ─── Card (legacy — kept for any external caller) ───── */

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

const priorityStyles = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 14,
    padding: '1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.85rem',
  },
  title: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: C.white,
    lineHeight: 1.3,
  },
  benefit: {
    margin: 0,
    fontSize: '0.9rem',
    color: C.lightGreen,
  },
  deadline: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
  },
  reasonList: {
    listStyle: 'none',
    margin: '0.15rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
  },
  reasonItem: {
    display: 'inline-flex',
    gap: '0.35rem',
  },
  btnRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  btn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.625rem 1rem',
    borderRadius: 10,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    minHeight: 44,
  },
  btnPrimary: {
    background: '#22C55E',
    color: C.white,
    border: '1px solid #16A34A',
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
  },
  btnSecondary: {
    background: '#1A3B5D',
    color: C.white,
    border: '1px solid #1F3B5C',
  },
  // What-to-expect block — calm, neutral container so it reads
  // as informational, not as another CTA.
  expect: {
    marginTop: '0.4rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '0.5rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  expectLabel: {
    margin: 0,
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  expectList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  expectItem: {
    display: 'inline-flex',
    gap: '0.4rem',
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem',
    lineHeight: 1.45,
  },
  // Save-for-later — ghost button under the primary CTA pair.
  // Same min-height for tap target; muted styling so it doesn't
  // compete with Apply Now.
  saveBtn: {
    marginTop: '0.4rem',
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.78)',
    borderRadius: 10,
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 38,
  },
  saveBtnSaved: {
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.40)',
    color: '#86EFAC',
    cursor: 'default',
  },
  savedToast: {
    margin: '0.4rem 0 0',
    padding: '0.4rem 0.65rem',
    borderRadius: 8,
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.30)',
    color: '#86EFAC',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
};

const rowStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '0.7rem 0.9rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 10,
    color: C.white,
    fontSize: '0.875rem',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  label: {
    color: C.white,
    fontSize: '0.875rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  arrow: {
    color: 'rgba(255,255,255,0.5)',
    display: 'inline-flex',
    flex: '0 0 auto',
  },
};

// My Applications section — slim list rows + neutral empty state.
const appStyles = {
  empty: {
    padding: '0.7rem 0.9rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.875rem',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '0.7rem 0.9rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 10,
    color: '#fff',
    textDecoration: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  status: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    flex: '0 0 auto',
  },
};

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
  otherSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  otherTitle: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 600,
  },
  otherList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
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
