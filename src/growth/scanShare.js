/**
 * scanShare.js — share helper for scan results.
 *
 * Spec coverage (User growth §1, §4)
 *   • Allow users to share scan results
 *   • Tracking: shares
 *
 * Strategy
 *   • Prefers `navigator.share` (Web Share API) when available —
 *     surfaces the OS share sheet so a farmer can route to
 *     WhatsApp / SMS / email in one tap.
 *   • Falls back to `navigator.clipboard.writeText` and returns
 *     `{ ok: true, channel: 'copy' }` so the caller can show a
 *     "Copied" toast.
 *   • Final fallback: returns `{ ok: false }` so the caller can
 *     surface an error gracefully.
 *
 * Strict-rule audit
 *   • Never throws — every async path is try/catch wrapped.
 *   • Emits `share_clicked` on tap and `share_completed` once the
 *     share / copy actually resolves.
 */

import { trackEvent } from '../analytics/analyticsStore.js';
import { buildInviteUrl } from './referralStore.js';

/**
 * shareScanResult({ result, lang? }) → Promise<{
 *   ok:      boolean,
 *   channel: 'web_share' | 'copy' | 'noop',
 * }>
 *
 *   `result` is the scan result object — we use its `issue` /
 *   `disease` / `confidence` fields if present.
 */
export async function shareScanResult({ result = {}, lang = 'en' } = {}) {
  const issue = String(
    result?.issue || result?.disease || result?.diagnosis || '',
  ).trim();
  const confidence = Number(result?.confidence);
  const headline = issue
    ? `Possible issue: ${issue}`
    : 'Plant scan from Farroway';
  const conf = Number.isFinite(confidence) && confidence > 0 && confidence <= 1
    ? ` (${Math.round(confidence * 100)}% confidence)`
    : '';
  const inviteUrl = buildInviteUrl();
  const text = `${headline}${conf}. Scanned with Farroway. Try it: ${inviteUrl}`;

  try {
    trackEvent('share_clicked', {
      kind:    'scan_result',
      issue:   issue || null,
      hasUrl:  true,
    });
  } catch { /* swallow */ }

  // Web Share API path.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: 'Farroway scan',
        text,
        url:   inviteUrl,
      });
      try {
        trackEvent('share_completed', { kind: 'scan_result', channel: 'web_share' });
      } catch { /* swallow */ }
      return { ok: true, channel: 'web_share' };
    }
  } catch (err) {
    // User cancelled or the share sheet failed; fall through to
    // clipboard rather than swallowing silently.
    if (err && err.name === 'AbortError') {
      return { ok: false, channel: 'web_share' };
    }
  }

  // Clipboard fallback.
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      try {
        trackEvent('share_completed', { kind: 'scan_result', channel: 'copy' });
      } catch { /* swallow */ }
      return { ok: true, channel: 'copy' };
    }
  } catch { /* swallow */ }

  // Suppress unused-var warning when the lang param goes unused.
  void lang;
  return { ok: false, channel: 'noop' };
}

export default { shareScanResult };
