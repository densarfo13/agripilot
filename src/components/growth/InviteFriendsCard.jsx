/**
 * InviteFriendsCard — Home-mountable invite CTA + region-focused
 * messaging.
 *
 * Spec coverage (User growth §2, §4, §5)
 *   §2 invite friends, reward usage
 *   §4 tracking: invites, shares, new users
 *   §5 prioritize one location (regional copy variant)
 *
 * Behaviour
 *   • On mount, captures any incoming `?ref=CODE` URL parameter
 *     so a fresh install attributed to a referral is recorded
 *     before the user does anything else.
 *   • Generates this device's stable referral code on first
 *     render and surfaces an invite URL.
 *   • Three actions:
 *       Share    → web_share or clipboard fallback
 *       Copy     → clipboard direct
 *       Invited  → confirmation pill (post-action)
 *   • Region-focused message (§5): when the user's detected /
 *     stored country+region matches the configured pilot focus
 *     (default Greater Accra, Ghana), the card shows a locale-
 *     specific headline. Otherwise the generic invite copy
 *     renders.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides when `userGrowth` flag is off.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import {
  getMyReferralCode,
  buildInviteUrl,
  recordInvite,
  captureIncomingReferralFromURL,
  REFERRAL_CHANGED_EVENT,
} from '../../growth/referralStore.js';
import { getGrowthRegion, matchGrowthRegion } from '../../growth/growthRegion.js';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _readProfile() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_user_profile');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,197,94,0.10))',
    border: '1px solid rgba(168,85,247,0.42)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  headRow: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22, lineHeight: 1 },
  title: { margin: 0, fontSize: 15, fontWeight: 800 },
  copy:  { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.20)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#fff',
  },
  code: { fontWeight: 800, letterSpacing: '0.06em' },
  url:  { color: 'rgba(255,255,255,0.78)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#A855F7',
    color: '#0B1D34',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '1 1 0',
  },
  secondary: {
    appearance: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '1 1 0',
  },
  copiedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 800,
    color: '#86EFAC',
  },
};

export default function InviteFriendsCard({ style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('userGrowth');
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  // Spec §4 (new users): capture an incoming referral on first
  // mount so a fresh install attributed to a friend is recorded
  // and `signup_via_invite` fires before the user clicks anything.
  useEffect(() => {
    if (!flagOn) return;
    try { captureIncomingReferralFromURL(); }
    catch { /* swallow */ }
  }, [flagOn]);

  // Re-render on cross-component referral changes.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(REFERRAL_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(REFERRAL_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const code = useMemo(() => {
    try { return getMyReferralCode(); } catch { return ''; }
  }, []);
  const url = useMemo(() => {
    try { return buildInviteUrl(); } catch { return ''; }
  }, []);

  // Region focus (§5): pull the user's detected/stored location
  // and check it against the pilot focus.
  const regionMatch = useMemo(() => {
    const farm = _readActiveFarm();
    const profile = _readProfile();
    return matchGrowthRegion({
      country: farm?.country || profile?.country || '',
      region:  farm?.region  || profile?.region  || '',
    });
  }, []);
  const focus = useMemo(() => getGrowthRegion(), []);

  const handleShare = useCallback(async () => {
    if (!url) return;
    let channel = 'manual';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Farroway',
          text:  tStrict('growth.invite.shareText',
            'Try Farroway with me \u2014 simple daily plans for your farm.'),
          url,
        });
        channel = 'web_share';
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        channel = 'copy';
        setCopied(true);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    try { recordInvite({ channel }); }
    catch { /* swallow */ }
  }, [url]);

  const handleCopy = useCallback(async () => {
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* swallow */ }
    try { recordInvite({ channel: 'copy' }); }
    catch { /* swallow */ }
    setCopied(true);
  }, [url]);

  if (!flagOn) return null;

  // Region-focused headline (§5).
  const headline = (() => {
    if (regionMatch === 'match' && focus.region) {
      return tStrict(
        'growth.invite.titleRegionMatch',
        '{region} farmers are joining Farroway',
      ).replace('{region}', focus.region);
    }
    if (regionMatch === 'country_only' && focus.country) {
      return tStrict(
        'growth.invite.titleCountryMatch',
        'Farmers in {country} are joining Farroway',
      ).replace('{country}', focus.country);
    }
    return tStrict('growth.invite.titleGeneric', 'Invite a friend to Farroway');
  })();

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="growth-invite-card"
      data-region-match={regionMatch}
    >
      <div style={S.headRow}>
        <span style={S.icon} aria-hidden="true">{'\uD83C\uDF31'}</span>
        <h3 style={S.title}>{headline}</h3>
      </div>
      <p style={S.copy}>
        {tStrict('growth.invite.copy',
          'Share your code with a neighbour. When they use Farroway, both of you get rewarded.')}
      </p>
      <div style={S.codeRow} data-testid="growth-invite-code">
        <span style={S.code}>{code}</span>
        <span style={S.url}>{url}</span>
      </div>
      <div style={S.rowBtns}>
        <button
          type="button"
          onClick={handleShare}
          style={S.primary}
          data-testid="growth-invite-share"
        >
          {tStrict('growth.invite.share', 'Share invite')}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          style={S.secondary}
          data-testid="growth-invite-copy"
        >
          {copied ? (
            <span style={S.copiedTag}>
              <span aria-hidden="true">{'\u2714'}</span>
              <span>{tStrict('common.copied', 'Copied')}</span>
            </span>
          ) : tStrict('common.copy', 'Copy link')}
        </button>
      </div>
    </section>
  );
}
