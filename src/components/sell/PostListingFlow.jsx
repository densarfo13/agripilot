/**
 * PostListingFlow — 3-step explainer shown right after a listing
 * is created.
 *
 * Spec coverage (Sell screen V2 §5)
 *   • buyers see listing
 *   • user gets notified
 *   • user chooses buyer
 *
 * Position
 *   The existing success card in Sell.jsx already says "Listing
 *   live". This component renders just under that card, walking
 *   the farmer through what happens next so they know the flow
 *   is not finished after submission.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Inline styles only.
 *   • Pure presentational.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const STEPS = [
  {
    icon: '\uD83D\uDC65',
    titleKey: 'sell.postListing.step1.title',
    titleFallback: 'Buyers see your listing',
    bodyKey: 'sell.postListing.step1.body',
    bodyFallback: 'Your produce is now visible to buyers nearby.',
  },
  {
    icon: '\uD83D\uDD14',
    titleKey: 'sell.postListing.step2.title',
    titleFallback: 'You get a notification',
    bodyKey: 'sell.postListing.step2.body',
    bodyFallback: 'When a buyer is interested, we ping you in Farroway.',
  },
  {
    icon: '\uD83E\uDD1D',
    titleKey: 'sell.postListing.step3.title',
    titleFallback: 'You choose a buyer',
    bodyKey: 'sell.postListing.step3.body',
    bodyFallback: 'Pick the offer that suits you. Then connect.',
  },
];

const S = {
  panel: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  icon: { fontSize: 22, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 700, color: '#fff' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
};

export default function PostListingFlow({ style }) {
  useTranslation();
  return (
    <section
      style={{ ...S.panel, ...(style || null) }}
      data-testid="sell-post-listing-flow"
    >
      <h3 style={S.heading}>
        {tStrict('sell.postListing.title', 'What happens next')}
      </h3>
      <div style={S.list}>
        {STEPS.map((step, idx) => (
          <div
            key={step.titleKey}
            style={S.row}
            data-testid={`sell-post-listing-step-${idx + 1}`}
          >
            <span style={S.icon} aria-hidden="true">{step.icon}</span>
            <span style={S.body}>
              <span style={S.title}>{tStrict(step.titleKey, step.titleFallback)}</span>
              <span style={S.copy}>{tStrict(step.bodyKey, step.bodyFallback)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
