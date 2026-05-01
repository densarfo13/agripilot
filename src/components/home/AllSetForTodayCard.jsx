/**
 * AllSetForTodayCard — empty-state shown on the home surface
 * when the farmer / backyard grower has no priority task for the
 * day (per final go-live spec §9).
 *
 *   import AllSetForTodayCard from '.../AllSetForTodayCard.jsx';
 *   {!todaysTask && <AllSetForTodayCard />}
 *
 * Visible strings:
 *   • Title  — "You're all set for today 🎉"
 *              key: home.tasks.allDone.title
 *   • CTA    — "Scan a plant"
 *              key: home.tasks.allDone.cta
 *
 * Strict-rule audit
 *   • All visible text via tStrict — no English bleed.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 *   • CTA routes to /scan (canonical scan surface).
 */

import { useNavigate } from 'react-router-dom';
import { tStrict } from '../../i18n/strictT.js';
import { useTranslation } from '../../i18n/index.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  card: {
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.28)',
    borderRadius: 14,
    padding: '18px 16px',
    margin: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 10,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 800, color: '#EAF2FF' },
  cta: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: '#22C55E',
    color: '#062714',
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 800,
    minHeight: 44,
  },
};

export default function AllSetForTodayCard({ style }) {
  // Subscribe so the card re-renders on language switch.
  useTranslation();
  const navigate = useNavigate();

  function handleScan() {
    try { trackEvent('home_all_set_scan_tap', {}); }
    catch { /* swallow */ }
    try { navigate('/scan'); }
    catch { /* swallow */ }
  }

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="home-all-set-card"
    >
      <h2 style={S.title}>
        {tStrict('home.tasks.allDone.title',
          'You\u2019re all set for today \uD83C\uDF89')}
      </h2>
      <button
        type="button"
        onClick={handleScan}
        style={S.cta}
        data-testid="home-all-set-scan"
      >
        {tStrict('home.tasks.allDone.cta', 'Scan a plant')}
      </button>
    </section>
  );
}
