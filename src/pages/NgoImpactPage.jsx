/**
 * NgoImpactPage — dedicated NGO funding & impact surface.
 *
 *   <Route path="/ngo/impact" element={<NgoImpactPage />} />
 *
 * Composes:
 *   * <FundingImpact />   — donor-ready impact summary + CSV
 *   * <MarketActivity />  — listings + buyer-interest activity
 *
 * The combined-into-NGOMapDashboard variant renders the same
 * components inline so an operator landing on the map gets
 * the same data without leaving the page.
 *
 * Strict-rule audit
 *   * Local-first: works against `marketStore` + the local
 *     event log when the backend is unavailable. Hosts that
 *     fetch server data can pass `summary` / `events` /
 *     `farms` / `risks` in via context or props.
 *   * No farmer PII surfaced — both child components show
 *     counts only.
 *   * Branded layout: navy gradient + green accents, mobile
 *     first single-column.
 */

import React from 'react';
import FundingImpact   from '../components/ngo/FundingImpact.jsx';
import MarketActivity  from '../components/ngo/MarketActivity.jsx';
import BrandLogo       from '../components/BrandLogo.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import { tSafe } from '../i18n/tSafe.js';

const C = FARROWAY_BRAND.colors;

export default function NgoImpactPage() {
  return (
    <main style={S.page} data-testid="ngo-impact-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <p style={S.tagline}>{FARROWAY_BRAND.tagline}</p>
          <h1 style={S.h1}>
            {tSafe('impact.pageTitle',
              'Funding, impact & market activity')}
          </h1>
          <p style={S.lead}>
            {tSafe('impact.pageLead',
              'Track program performance, generate donor-ready reports, and watch market activity in one place.')}
          </p>
        </header>

        <FundingImpact testId="ngo-impact-funding" />
        <MarketActivity testId="ngo-impact-market" />
      </div>
    </main>
  );
}

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
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    alignItems: 'flex-start',
  },
  tagline: {
    margin: 0, color: C.lightGreen, fontSize: '0.875rem',
    fontWeight: 700,
  },
  h1: {
    margin: '0.4rem 0 0',
    fontSize: '1.5rem', fontWeight: 800,
    letterSpacing: '-0.01em', color: C.white,
  },
  lead: {
    margin: 0, color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9375rem', maxWidth: '38rem',
  },
};
