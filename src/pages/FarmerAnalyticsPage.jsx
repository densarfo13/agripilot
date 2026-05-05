/**
 * FarmerAnalyticsPage — Phase 7D basic analytics page for farmers.
 *
 * Spec coverage (Phase 7D §farmer)
 *   • Tasks completed this week
 *   • Listings created (device-local)
 *   • Buyer interests received
 *   • Saved funding opportunities
 *   • Crop progress status
 *
 * Rules
 *   • Read-only — no writes, no mutations.
 *   • All data from localStorage via farmerAnalytics.js — no API calls.
 *   • Renders correctly offline.
 *   • If any data is missing, shows 0 / "—" instead of crashing.
 *
 * Security
 *   • Reads only this device's data; no cross-farmer aggregation.
 *   • No PII exposed — farmerId is not displayed.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 *   • Hooks called unconditionally (passes lint:hooks gate).
 */

import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import FarmerAnalyticsCards from '../components/analytics/FarmerAnalyticsCards.jsx';

// ─── Styles ──────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#EAF2FF',
    padding: '20px 16px 96px',
    maxWidth: 780,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  title: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: '#fff',
  },
  subtitle: {
    margin: '0 0 20px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  sectionLabel: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
  },
  notice: {
    marginTop: 20,
    padding: '10px 14px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    lineHeight: 1.5,
  },
};

// ─── Component ────────────────────────────────────────────────

export default function FarmerAnalyticsPage() {
  // Subscribe to language changes so all tStrict labels refresh on flip.
  useTranslation();

  return (
    <main
      style={S.page}
      data-screen="farmer-analytics"
      data-phase="7d"
    >
      <h1 style={S.title}>
        {tStrict('analytics.title', 'My Analytics')}
      </h1>
      <p style={S.subtitle}>
        {tStrict(
          'analytics.subtitle',
          'A read-only snapshot of your farming activity on this device.',
        )}
      </p>

      <p style={S.sectionLabel}>
        {tStrict('analytics.sectionActivity', 'Activity snapshot')}
      </p>

      {/* Phase 7D: the five farmer analytics cards.
          Never throws — each card falls back to 0 / "—" when
          the underlying store is empty or unavailable. */}
      <FarmerAnalyticsCards />

      <p style={S.notice}>
        {tStrict(
          'analytics.localNotice',
          'Data shown is from this device only. Sync when online for complete records.',
        )}
      </p>
    </main>
  );
}
