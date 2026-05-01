/**
 * SellPromptCard — onboarding-conversion CTA.
 *
 * Spec coverage (User growth §3, §4)
 *   §3 prompt users to sell produce
 *   §4 tracking: sell_prompt_view / sell_prompt_click
 *
 * When it shows
 *   • The user has a farm (profile.farmId or active farm).
 *   • The user has NOT yet listed any produce — i.e. zero rows
 *     in `farroway_market_listings` owned by their farmerId.
 *   • The user has shown some activity (an engagement completion
 *     in the last 30 days OR an active farm) so the prompt
 *     doesn't slap a brand-new install on first open.
 *
 * Self-suppression
 *   • Returns null when `userGrowth` flag is off.
 *   • Returns null after the user dismisses (per-session).
 *   • Returns null when conditions aren't met.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure read-aggregator on storage; never throws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const DISMISS_KEY = 'farroway_sell_prompt_dismissed';

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _hasRecentActivity() {
  try {
    const completions = _safeReadJsonArray('farroway_engagement_history');
    return completions.some((c) => {
      const t = Date.parse(c?.completedAt || '');
      return Number.isFinite(t) && t >= Date.now() - 30 * 86_400_000;
    });
  } catch { return false; }
}

function _hasOwnedListings(farmerId) {
  if (!farmerId) return false;
  try {
    const listings = _safeReadJsonArray('farroway_market_listings');
    return listings.some((l) =>
      l && String(l.farmerId || '') === String(farmerId));
  } catch { return false; }
}

const S = {
  card: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  icon: { fontSize: 26, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 800 },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    background: '#22C55E',
    color: '#0B1D34',
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
};

/**
 * @param {object} props
 * @param {object} [props.profile]
 * @param {object} [props.activeFarm]
 * @param {string} [props.farmerId]
 * @param {object} [props.style]
 */
export default function SellPromptCard({
  profile,
  activeFarm,
  farmerId,
  style,
}) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('userGrowth');
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch { return false; }
  });

  const fid = String(farmerId
    || profile?.userId
    || profile?.farmerId
    || activeFarm?.farmerId
    || '');

  const eligible = useMemo(() => {
    const hasFarm = Boolean(profile?.farmId || activeFarm?.id);
    if (!hasFarm) return false;
    if (_hasOwnedListings(fid)) return false;     // already converted
    return _hasRecentActivity() || hasFarm;       // bias toward active users
  }, [profile, activeFarm, fid]);

  const handleStart = useCallback(() => {
    try {
      trackEvent('sell_prompt_click', {
        source: 'home_growth',
        farmerId: fid || null,
      });
    } catch { /* swallow */ }
    try { navigate('/sell'); }
    catch { /* swallow */ }
  }, [navigate, fid]);

  const handleDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('sell_prompt_dismiss', { source: 'home_growth' }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, []);

  // Once-per-mount view event for funnel measurement. Lives in
  // a useEffect — firing analytics during render is a React rules
  // violation that triggers minified error #300 if the analytics
  // pipeline ever causes a setState in another component.
  const viewedRef = useRef(false);
  const visible = flagOn && !dismissed && eligible;
  useEffect(() => {
    if (!visible) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try { trackEvent('sell_prompt_view', { source: 'home_growth' }); }
    catch { /* swallow */ }
  }, [visible]);

  if (!visible) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="growth-sell-prompt"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
      <div style={S.body}>
        <span style={S.title}>
          {tStrict('growth.sellPrompt.title', 'Ready to sell your harvest?')}
        </span>
        <span style={S.copy}>
          {tStrict('growth.sellPrompt.copy',
            'List your produce on Farroway \u2014 buyers nearby will be notified.')}
        </span>
        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleStart}
            style={S.primary}
            data-testid="growth-sell-prompt-cta"
          >
            {tStrict('market.createListing', 'List my produce')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={S.ghost}
            data-testid="growth-sell-prompt-dismiss"
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        </div>
      </div>
    </section>
  );
}
