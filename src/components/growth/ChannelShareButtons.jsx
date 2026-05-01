/**
 * ChannelShareButtons — explicit WhatsApp / Facebook / SMS / Copy
 * buttons for sharing scan results.
 *
 * Spec coverage (User acquisition §2)
 *   • Share: WhatsApp, Facebook, SMS
 *
 * Why per-channel
 *   The existing `ScanShareButton` uses the OS share sheet via
 *   `navigator.share`, which routes well on mobile but lands on
 *   clipboard on desktop. Per-channel buttons make the intent
 *   explicit and let analytics partition by channel cleanly.
 *
 * Channel URLs
 *   WhatsApp : https://wa.me/?text=…
 *   Facebook : https://www.facebook.com/sharer/sharer.php?u=…
 *               (FB sharer ignores the text param; URL only)
 *   SMS      : sms:?body=…   (mobile only — opens default app)
 *   Copy     : clipboard fallback always available
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides when `userAcquisition` flag is off.
 *   • Each click fires `share_clicked` (with channel) and
 *     `share_completed` once the navigation / clipboard write
 *     resolves.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { buildInviteUrl, recordInvite } from '../../growth/referralStore.js';

const S = {
  row: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  whatsapp: {
    background: 'rgba(37,211,102,0.14)',
    border: '1px solid rgba(37,211,102,0.45)',
    color: '#25D366',
  },
  facebook: {
    background: 'rgba(24,119,242,0.14)',
    border: '1px solid rgba(24,119,242,0.45)',
    color: '#7DA8F0',
  },
  sms: {
    background: 'rgba(168,85,247,0.14)',
    border: '1px solid rgba(168,85,247,0.45)',
    color: '#D8B4FE',
  },
  copiedTag: {
    color: '#86EFAC',
    fontWeight: 800,
  },
};

function _isMobile() {
  try {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
  } catch { return false; }
}

function _safeOpen(url) {
  try {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
  } catch { /* swallow */ }
  return false;
}

/**
 * @param {object} props
 * @param {string} [props.text]    full share text (without URL).
 *                                  We append the invite URL.
 * @param {string} [props.context] analytics tag (e.g. 'scan_result')
 * @param {object} [props.style]
 */
export default function ChannelShareButtons({
  text = '',
  context = 'scan_result',
  style,
}) {
  useTranslation();
  const flagOn = isFeatureEnabled('userAcquisition');
  const [copied, setCopied] = useState(false);
  const isMobile = _isMobile();

  const inviteUrl = (() => {
    try { return buildInviteUrl(); } catch { return ''; }
  })();
  const fullText = text
    ? `${String(text).trim()} ${inviteUrl}`.trim()
    : inviteUrl;

  const fire = useCallback((channel, completed) => {
    try {
      trackEvent('share_clicked', { kind: context, channel });
      if (completed) trackEvent('share_completed', { kind: context, channel });
    } catch { /* swallow */ }
    try { recordInvite({ channel }); }
    catch { /* swallow */ }
  }, [context]);

  const handleWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    const ok = _safeOpen(url);
    fire('whatsapp', ok);
  }, [fullText, fire]);

  const handleFacebook = useCallback(() => {
    // Facebook sharer ignores text param; just open with URL.
    const target = inviteUrl || (typeof window !== 'undefined' ? window.location.href : 'https://farroway.app');
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(target)}`;
    const ok = _safeOpen(url);
    fire('facebook', ok);
  }, [inviteUrl, fire]);

  const handleSms = useCallback(() => {
    const url = `sms:?body=${encodeURIComponent(fullText)}`;
    let ok = false;
    try {
      if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
        window.location.assign(url);
        ok = true;
      }
    } catch { /* swallow */ }
    fire('sms', ok);
  }, [fullText, fire]);

  const handleCopy = useCallback(async () => {
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
        ok = true;
        setCopied(true);
      }
    } catch { /* swallow */ }
    fire('copy', ok);
  }, [fullText, fire]);

  if (!flagOn) return null;

  return (
    <div
      style={{ ...S.row, ...(style || null) }}
      data-testid="growth-channel-share"
    >
      <button
        type="button"
        onClick={handleWhatsApp}
        style={{ ...S.btn, ...S.whatsapp }}
        data-testid="growth-share-whatsapp"
      >
        <span aria-hidden="true">{'\uD83D\uDCAC'}</span>
        <span>{tStrict('growth.channels.whatsapp', 'WhatsApp')}</span>
      </button>
      <button
        type="button"
        onClick={handleFacebook}
        style={{ ...S.btn, ...S.facebook }}
        data-testid="growth-share-facebook"
      >
        <span aria-hidden="true">{'\uD83D\uDC65'}</span>
        <span>{tStrict('growth.channels.facebook', 'Facebook')}</span>
      </button>
      {isMobile ? (
        <button
          type="button"
          onClick={handleSms}
          style={{ ...S.btn, ...S.sms }}
          data-testid="growth-share-sms"
        >
          <span aria-hidden="true">{'\u2709\uFE0F'}</span>
          <span>{tStrict('growth.channels.sms', 'SMS')}</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleCopy}
        style={S.btn}
        data-testid="growth-share-copy"
      >
        <span aria-hidden="true">{copied ? '\u2714' : '\uD83D\uDCCB'}</span>
        <span style={copied ? S.copiedTag : null}>
          {copied
            ? tStrict('common.copied', 'Copied')
            : tStrict('common.copy', 'Copy link')}
        </span>
      </button>
    </div>
  );
}
