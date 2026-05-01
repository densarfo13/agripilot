/**
 * WaitlistNudgeCard — calm "no demand yet" alternative to the
 * MarketplaceNudgeCard.
 *
 * Spec coverage (Robust journey §5, §7)
 *   §5 Handle no demand: notify later, suggest boost.
 *   §7 Prevent empty states — always show a suggestion or action.
 *
 * When it shows
 *   • The user has an active farm with a primary crop.
 *   • There is NO buyer demand for that crop yet.
 *   • The user has not yet listed an active listing for it.
 *   • Not session-dismissed.
 *   • `journeyResilience` flag is on.
 *
 * Behaviour
 *   • Two soft CTAs:
 *     – "Notify me when buyers search" — stamps a watch flag so
 *        the user can be re-prompted when demand picks up.
 *     – "Boost listing" — routes to /sell where the boost CTA
 *        lives.
 *
 * Storage
 *   farroway_demand_watchlist : Array<{ crop, country, region, stampedAt }>
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { getDemandForCrop } from '../../market/marketDemand.js';
import { getActiveListings } from '../../market/marketStore.js';

const WATCH_KEY = 'farroway_demand_watchlist';
const DISMISS_KEY = 'farroway_waitlist_nudge_dismissed';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _readWatchlist() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeWatchlist(rows) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WATCH_KEY, JSON.stringify(rows.slice(-50)));
  } catch { /* swallow */ }
}

const S = {
  card: {
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.40)',
    borderRadius: 14,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    margin: '0 0 12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  icon: { fontSize: 24, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 800, color: '#7DD3FC' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#0EA5E9',
    color: '#0B1D34',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 800,
  },
};

export default function WaitlistNudgeCard({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('journeyResilience');
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch { return false; }
  });
  const [stamped, setStamped] = useState(false);
  const viewedRef = useRef(false);

  const farm    = useMemo(() => _readActiveFarm(), []);
  const crop    = String(farm?.crop || farm?.plantId || '').trim();
  const country = String(farm?.country || '').trim();
  const region  = String(farm?.region || '').trim();

  const eligible = useMemo(() => {
    if (!flagOn || dismissed || !crop) return false;
    let demand = null;
    try { demand = getDemandForCrop({ crop, country, region }); }
    catch { demand = null; }
    if (demand && (demand.count || 0) > 0) return false; // demand path
    // Suppress if the user already has an active listing for the crop.
    let listings = [];
    try { listings = getActiveListings() || []; } catch { listings = []; }
    const alreadyListed = listings.some((l) =>
      l && l.farmId === farm?.id
        && String(l.crop || '').toLowerCase() === crop.toLowerCase()
        && String(l.status || '').toUpperCase() === 'ACTIVE');
    return !alreadyListed;
  }, [flagOn, dismissed, crop, country, region, farm]);

  useEffect(() => {
    if (!eligible) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try { trackEvent('waitlist_nudge_view', { crop }); }
    catch { /* swallow */ }
  }, [eligible, crop]);

  const handleNotify = useCallback(() => {
    const rows = _readWatchlist();
    rows.push({
      crop,
      country: country || null,
      region:  region  || null,
      stampedAt: new Date().toISOString(),
    });
    _writeWatchlist(rows);
    try { trackEvent('waitlist_notify_me', { crop }); }
    catch { /* swallow */ }
    setStamped(true);
  }, [crop, country, region]);

  const handleBoost = useCallback(() => {
    try { trackEvent('waitlist_boost_clicked', { crop }); }
    catch { /* swallow */ }
    try { navigate('/sell'); }
    catch { /* swallow */ }
  }, [crop, navigate]);

  const handleDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('waitlist_nudge_dismiss', { crop }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [crop]);

  if (!eligible) return null;

  const cropLabel = crop.charAt(0).toUpperCase() + crop.slice(1);

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="waitlist-nudge-card"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDD52'}</span>
      <div style={S.body}>
        <span style={S.title}>
          {tStrict('journey.waitlist.title',
            'No buyers searching for {crop} yet').replace('{crop}', cropLabel)}
        </span>
        <span style={S.copy}>
          {tStrict('journey.waitlist.copy',
            'We\u2019ll notify you the moment demand picks up. You can also boost a listing now to get visibility while it\u2019s quiet.')}
        </span>
        {stamped ? (
          <span style={S.successPill} data-testid="waitlist-stamped">
            <span aria-hidden="true">{'\u2714'}</span>
            <span>
              {tStrict('journey.waitlist.stamped',
                'You\u2019ll be notified')}
            </span>
          </span>
        ) : (
          <div style={S.rowBtns}>
            <button
              type="button"
              onClick={handleNotify}
              style={S.primary}
              data-testid="waitlist-notify"
            >
              {tStrict('journey.waitlist.notify', 'Notify me')}
            </button>
            <button
              type="button"
              onClick={handleBoost}
              style={S.ghost}
              data-testid="waitlist-boost"
            >
              {tStrict('journey.waitlist.boost', 'Boost a listing')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={S.ghost}
              data-testid="waitlist-dismiss"
            >
              {tStrict('common.notNow', 'Not now')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
