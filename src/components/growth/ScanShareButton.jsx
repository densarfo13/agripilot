/**
 * ScanShareButton — share-this-scan CTA mounted on ScanResultCard.
 *
 * Spec coverage (User growth §1, §4)
 *   • allow users to share results
 *   • tracking: shares (handled by scanShare.js)
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws — share helper is wrapped.
 *   • Self-hides when `userGrowth` flag is off.
 *   • Self-hides when neither `navigator.share` nor
 *     `navigator.clipboard` is available.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { shareScanResult } from '../../growth/scanShare.js';
import { useToast, ToastContainer } from '../intelligence/Toast.jsx';

const S = {
  cta: {
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.45)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flex: '0 0 auto',
  },
  ctaActive: { opacity: 0.7, cursor: 'wait' },
  icon: { fontSize: 14, lineHeight: 1 },
};

function _shareSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share === 'function') return true;
    if (navigator.clipboard?.writeText) return true;
    return false;
  } catch { return false; }
}

export default function ScanShareButton({ result, lang = 'en', style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('userGrowth');
  const supported = _shareSupported();
  const [busy, setBusy] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await shareScanResult({ result, lang });
      if (out && out.ok && out.channel === 'copy') {
        try {
          showToast(
            tStrict('growth.share.copied',
              'Link copied \u2014 paste it in WhatsApp or SMS.'),
            'success',
          );
        } catch { /* swallow */ }
      }
    } catch { /* swallow */ }
    setBusy(false);
  }, [busy, result, lang, showToast]);

  if (!flagOn || !supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        style={{ ...S.cta, ...(busy ? S.ctaActive : null), ...(style || null) }}
        data-testid="scan-share-button"
      >
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDCE4'}</span>
        <span>
          {busy
            ? tStrict('growth.share.busy', 'Sharing\u2026')
            : tStrict('growth.share.cta', 'Share result')}
        </span>
      </button>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
