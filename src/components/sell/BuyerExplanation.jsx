/**
 * BuyerExplanation — single calm line + sub-text reassuring the
 * farmer that buyers will reach them through Farroway.
 *
 * Spec coverage (Sell screen V2 §4)
 *   • "Buyers will contact you through Farroway"
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Inline styles only.
 *   • Pure presentational.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const S = {
  panel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#E5F4EC',
  },
  icon:  { fontSize: 18, lineHeight: 1, flex: '0 0 auto' },
  body:  { display: 'flex', flexDirection: 'column', gap: 2 },
  title: { fontSize: 13, fontWeight: 700, color: '#fff' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
};

export default function BuyerExplanation({ style }) {
  useTranslation();
  return (
    <div style={{ ...S.panel, ...(style || null) }} data-testid="sell-buyer-explanation">
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDD12'}</span>
      <span style={S.body}>
        <span style={S.title}>
          {tStrict('sell.buyerExplanation.title',
            'Buyers will contact you through Farroway')}
        </span>
        <span style={S.copy}>
          {tStrict('sell.buyerExplanation.copy',
            'Your phone number stays private until you choose a buyer.')}
        </span>
      </span>
    </div>
  );
}
