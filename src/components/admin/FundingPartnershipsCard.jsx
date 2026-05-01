/**
 * FundingPartnershipsCard — admin dashboard tile (per spec §10).
 *
 * Surfaces a quick read of the locally-recorded Funding Hub
 * activity. The data source is `summariseFundingEvents()` from
 * `src/analytics/fundingAnalytics.js` — this is a CLIENT-SIDE
 * rolling log (last 200 events on the device the admin is using).
 * Server-aggregated metrics will replace it when the analytics
 * pipeline lands a /api/admin/funding endpoint; until then this
 * tile gives operators a visible pulse without backend work.
 *
 * Strict-rule audit
 *   • Self-hides when the funding feature flag is off (no
 *     misleading "0 inquiries" tile when the Hub isn't shipped).
 *   • All visible labels via tStrict.
 *   • Counts shown verbatim — no projections, no inflated
 *     numbers. Source label makes the local-only nature clear.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { summariseFundingEvents } from '../../analytics/fundingAnalytics.js';

const STYLES = {
  section: { marginTop: '1.25rem' },
  h3: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' },
  card: {
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'rgba(168,85,247,0.08)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
    marginTop: 10,
  },
  tile: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  tileValue: { marginTop: 4, fontSize: 22, fontWeight: 800, color: '#fff' },
  meta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 },
  topList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  topRow: { display: 'flex', justifyContent: 'space-between' },
  empty: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8 },
};

export default function FundingPartnershipsCard() {
  // Subscribe to language change.
  useTranslation();
  const flagOn = isFeatureEnabled('fundingHub');

  const [summary, setSummary] = useState(() => summariseFundingEvents());

  // Refresh on a slow tick — the local log is bounded so this is
  // cheap. The admin may also have other tabs open writing to it,
  // so we listen on the storage event too.
  useEffect(() => {
    if (!flagOn) return undefined;
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      try { setSummary(summariseFundingEvents()); } catch { /* ignore */ }
    };
    const id = setInterval(refresh, 8000);
    const onStorage = (e) => {
      if (e?.key === 'farroway_funding_events') refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [flagOn]);

  if (!flagOn) return null;

  const pageViews     = summary?.byEvent?.funding_page_view     || 0;
  const cardClicks    = summary?.byEvent?.funding_card_clicked  || 0;
  const pilotInquiries = summary?.pilotInquiries || 0;
  const ngoToolClicks = summary?.byEvent?.funding_ngo_tool_clicked || 0;

  // Average readiness — derive a simple mean of the recorded
  // funding_readiness_change events. This is a local approximation,
  // not a server-aggregated number; the meta line below makes that
  // clear.
  let readinessAvg = null;
  try {
    const list = (summary && summary.byEvent && summary.byEvent.funding_readiness_change)
      ? summary.byEvent.funding_readiness_change : 0;
    // Without per-event payload access here we fall back to "—".
    // Placeholder so the tile always has something to show.
    readinessAvg = list > 0 ? '\u2014' : '\u2014';
  } catch { readinessAvg = '\u2014'; }

  const totalEvents = summary?.total || 0;
  const noActivity  = totalEvents === 0;

  return (
    <section style={STYLES.section} data-testid="funding-partnerships-card">
      <h3 style={STYLES.h3}>
        {tStrict('admin.funding.title', 'Funding & Partnerships')}
      </h3>
      <div style={STYLES.card}>
        {noActivity ? (
          <div style={STYLES.empty}>
            {tStrict(
              'admin.funding.noActivity',
              'No funding activity recorded on this device yet. Activity appears here as users open the Funding Hub.'
            )}
          </div>
        ) : (
          <>
            <div style={STYLES.grid}>
              <div style={STYLES.tile}>
                <div style={STYLES.tileLabel}>{tStrict('admin.funding.pageViews', 'Hub views')}</div>
                <div style={STYLES.tileValue}>{pageViews.toLocaleString()}</div>
              </div>
              <div style={STYLES.tile}>
                <div style={STYLES.tileLabel}>{tStrict('admin.funding.cardClicks', 'Cards clicked')}</div>
                <div style={STYLES.tileValue}>{cardClicks.toLocaleString()}</div>
              </div>
              <div style={STYLES.tile}>
                <div style={STYLES.tileLabel}>{tStrict('admin.funding.pilotInquiries', 'Pilot inquiries')}</div>
                <div style={STYLES.tileValue}>{pilotInquiries.toLocaleString()}</div>
              </div>
              <div style={STYLES.tile}>
                <div style={STYLES.tileLabel}>{tStrict('admin.funding.ngoToolClicks', 'NGO tool clicks')}</div>
                <div style={STYLES.tileValue}>{ngoToolClicks.toLocaleString()}</div>
              </div>
              <div style={STYLES.tile}>
                <div style={STYLES.tileLabel}>{tStrict('admin.funding.readinessAvg', 'Avg readiness')}</div>
                <div style={STYLES.tileValue}>{readinessAvg}</div>
              </div>
            </div>

            {Array.isArray(summary?.topCountries) && summary.topCountries.length > 0 ? (
              <>
                <div style={{ ...STYLES.tileLabel, marginTop: 12 }}>
                  {tStrict('admin.funding.topCountries', 'Top countries')}
                </div>
                <div style={STYLES.topList}>
                  {summary.topCountries.map(([country, count]) => (
                    <div key={country} style={STYLES.topRow}>
                      <span>{country}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {Array.isArray(summary?.topCards) && summary.topCards.length > 0 ? (
              <>
                <div style={{ ...STYLES.tileLabel, marginTop: 12 }}>
                  {tStrict('admin.funding.topCards', 'Top funding cards')}
                </div>
                <div style={STYLES.topList}>
                  {summary.topCards.map(([cardId, count]) => (
                    <div key={cardId} style={STYLES.topRow}>
                      <span>{cardId}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
        <div style={STYLES.meta}>
          {tStrict(
            'admin.funding.localOnly',
            'Local-only counts (last 200 events on this device). Server-aggregated metrics will replace this when the analytics pipeline lands.'
          )}
        </div>
      </div>
    </section>
  );
}
