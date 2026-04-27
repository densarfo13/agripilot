/**
 * Pricing — demo-friendly pricing surface. Mounts at /pricing.
 *
 * Reads the central pricing config + calculator. Lets the visitor
 * scrub through preset tier sizes (DEMO_TIERS) and shows the
 * monthly + annual cost, with a clear "minimum contract" callout
 * when the floor kicks in.
 *
 * Strict rules respected:
 *   * pure presentational - no API calls, no localStorage write
 *   * never crashes on bad input - calculator coerces everything
 *     through Number()
 *   * additive route - mounting is opt-in
 *   * inline styles to match the rest of the codebase
 */

import React, { useState } from 'react';
import {
  PRICING, CURRENCY, DEMO_TIERS,
} from '../config/pricing.js';
import {
  priceBreakdown, calculateNGOCost,
} from '../utils/pricingCalculator.js';
import { tSafe } from '../i18n/tSafe.js';

function fmtMoney(n) {
  try {
    return `${CURRENCY.symbol}${new Intl.NumberFormat().format(n || 0)}`;
  } catch {
    return `${CURRENCY.symbol}${n || 0}`;
  }
}

export default function Pricing() {
  const [farmers, setFarmers] = useState(1000);
  const breakdown = priceBreakdown(farmers);

  return (
    <main style={S.page} data-testid="pricing-page">
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.h1}>{tSafe('pricing.title', 'Pricing')}</h1>
          <p style={S.subtitle}>
            {tSafe(
              'pricing.subtitle',
              'Simple per-farmer pricing for NGOs. Contact us for enterprise.',
            )}
          </p>
        </header>

        {/* ─── NGO tier ─────────────────────────────────────── */}
        <section style={S.card} data-testid="pricing-ngo-card">
          <span style={S.tier}>{tSafe('pricing.tier.ngo', 'NGO')}</span>
          <div style={S.priceRow}>
            <span style={S.priceBig}>{fmtMoney(PRICING.NGO.perFarmer)}</span>
            <span style={S.priceUnit}>
              {' / '}
              {tSafe('pricing.perFarmerMonth', 'farmer / month')}
            </span>
          </div>
          <p style={S.minNote}>
            {tSafe('pricing.min', 'Minimum')}{' '}
            <strong>{fmtMoney(PRICING.NGO.minContract)}</strong>{' / '}
            {tSafe('pricing.month', 'month')}
          </p>

          <div style={S.calc}>
            <label htmlFor="pricing-farmer-count" style={S.calcLabel}>
              {tSafe('pricing.calc.label', 'Programme size')}
            </label>
            <div style={S.tierRow} role="tablist" aria-label="presets">
              {DEMO_TIERS.map((tier) => {
                const active = tier.farmers === farmers;
                return (
                  <button
                    type="button"
                    key={tier.label}
                    onClick={() => setFarmers(tier.farmers)}
                    style={{ ...S.tierBtn, ...(active ? S.tierBtnActive : null) }}
                    role="tab"
                    aria-selected={active}
                  >
                    {tier.label}
                    <span style={S.tierBtnSub}>
                      {new Intl.NumberFormat().format(tier.farmers)}
                    </span>
                  </button>
                );
              })}
            </div>
            <input
              id="pricing-farmer-count"
              type="number"
              min={0}
              step={50}
              value={farmers}
              onChange={(e) => setFarmers(Math.max(0, Number(e.target.value) || 0))}
              style={S.calcInput}
              data-testid="pricing-farmer-count"
            />
          </div>

          <div style={S.summary}>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>
                {tSafe('pricing.summary.farmers', 'Farmers')}
              </span>
              <strong style={S.summaryVal}>
                {new Intl.NumberFormat().format(breakdown.farmers)}
              </strong>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>
                {tSafe('pricing.summary.monthly', 'Monthly cost')}
              </span>
              <strong style={S.summaryValBig}>
                {fmtMoney(breakdown.monthlyCost)}
              </strong>
            </div>
            <div style={S.summaryRow}>
              <span style={S.summaryLabel}>
                {tSafe('pricing.summary.annual', 'Annual cost')}
              </span>
              <strong style={S.summaryVal}>
                {fmtMoney(breakdown.annualCost)}
              </strong>
            </div>
            {breakdown.flooredAtMin && (
              <p style={S.flooredNote}>
                {tSafe(
                  'pricing.summary.minNote',
                  'Roster below the minimum — billed at the floor.',
                )}
              </p>
            )}
          </div>
        </section>

        {/* ─── Enterprise tier ──────────────────────────────── */}
        <section style={S.cardEnterprise} data-testid="pricing-enterprise-card">
          <span style={S.tierEnterprise}>
            {tSafe('pricing.tier.enterprise', 'Enterprise')}
          </span>
          <div style={S.priceRow}>
            <span style={S.priceBig}>
              {tSafe('pricing.contactSales', 'Custom')}
            </span>
          </div>
          <p style={S.minNote}>
            {tSafe(
              'pricing.enterprise.note',
              'Custom features, integration, SLAs.',
            )}{' '}
            {tSafe('pricing.enterprise.from', 'From')}{' '}
            <strong>
              {fmtMoney(PRICING.ENTERPRISE.indicativeFrom)}
            </strong>
            {' / '}{tSafe('pricing.month', 'month')}
          </p>
        </section>
      </div>
    </main>
  );
}

// Re-export the calculator for any caller that wants to render
// pricing inline without mounting the page.
export { calculateNGOCost };

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.5rem 0 6rem',
  },
  container: {
    maxWidth: '40rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  h1: { fontSize: '1.625rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  subtitle: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  card: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  cardEnterprise: {
    background: 'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(15,32,52,0.9) 100%)',
    border: '1px solid rgba(124,58,237,0.45)',
    borderRadius: '20px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  tier: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#22C55E',
  },
  tierEnterprise: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#C4B5FD',
  },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: '0.5rem' },
  priceBig: { fontSize: '2rem', fontWeight: 800, color: '#EAF2FF' },
  priceUnit: { fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)' },
  minNote: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)',
  },
  calc: {
    marginTop: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  calcLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  tierRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  tierBtn: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0.5rem 0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  tierBtnActive: {
    background: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.55)',
    color: '#DCFCE7',
  },
  tierBtnSub: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    marginTop: '0.125rem',
  },
  calcInput: {
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '0.625rem 0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    outline: 'none',
  },
  summary: {
    marginTop: '0.5rem',
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.75rem',
  },
  summaryLabel: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)' },
  summaryVal:    { fontSize: '0.9375rem', fontWeight: 700, color: '#EAF2FF' },
  summaryValBig: { fontSize: '1.25rem',   fontWeight: 800, color: '#22C55E' },
  flooredNote: {
    margin: '0.25rem 0 0',
    fontSize: '0.75rem',
    color: '#FCD34D',
    fontStyle: 'italic',
  },
};
