/**
 * shareCard.js — orchestrate Garden Mode share-card publishing.
 *
 *   import { shareCard } from '../lib/share/shareCard.js';
 *
 *   const result = await shareCard({
 *     title:    'Balcony Tomato',
 *     text:     'Steady care makes a difference.',
 *     url:      'https://farroway.app',
 *     hashtag:  '#FarrowayGarden',
 *   });
 *
 * Behavior chain (fastest available wins):
 *   1. navigator.share({title, text, url})        — native mobile sheet
 *   2. navigator.clipboard.writeText(message)     — copy to clipboard
 *   3. Returns { ok:false, reason:'unsupported' } — caller can show
 *                                                    a "copy this" UI
 *
 * Strict-rule audit (spec §8 social safety)
 *   • OPT-IN ONLY — caller decides when to call this; the function
 *     never auto-fires on Home render.
 *   • IMAGE-BASED — text + URL are the public payload; we never
 *     include phone/email/exact GPS in the message.
 *   • STRIPPED — the text passed in is left as-is (caller already
 *     wrote a calm message via pickCaption); we add no metadata.
 *   • Never throws — every code path resolves to a result object.
 *   • Returns telemetry-friendly result for analytics.
 */

const RESULT_OK_NATIVE    = Object.freeze({ ok: true,  via: 'native'    });
const RESULT_OK_CLIPBOARD = Object.freeze({ ok: true,  via: 'clipboard' });
const RESULT_CANCELLED    = Object.freeze({ ok: false, via: 'native', reason: 'cancelled' });
const RESULT_UNSUPPORTED  = Object.freeze({ ok: false, reason: 'unsupported' });
const RESULT_FAILED       = Object.freeze({ ok: false, reason: 'failed' });

/**
 * shareCard(opts) → Promise<{ok, via?, reason?}>
 *
 * @param {object} opts
 * @param {string} opts.title      short title (plant nickname or milestone)
 * @param {string} opts.text       body text (encouragement caption)
 * @param {string} [opts.url]      optional canonical URL (e.g. farroway.app)
 * @param {string} [opts.hashtag]  optional hashtag appended to text
 */
export async function shareCard(opts) {
  const safe = (opts && typeof opts === 'object') ? opts : {};
  const title   = _str(safe.title);
  const text    = _str(safe.text);
  const url     = _str(safe.url);
  const hashtag = _str(safe.hashtag);

  // Compose payload. Hashtag appended only when caller supplied one;
  // never invent one. URL appended to text fallback for clipboard
  // (Web Share API takes url separately).
  const fullText = [text, hashtag].filter(Boolean).join('  ');
  const clipboardPayload = [title, fullText, url].filter(Boolean).join('\n').trim();

  // ── 1. Native Web Share API ─────────────────────────────
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: title || undefined,
        text:  fullText || undefined,
        url:   url || undefined,
      });
      return RESULT_OK_NATIVE;
    } catch (err) {
      // AbortError = user dismissed the share sheet. Treat as cancelled
      // (not a failure) so we don't fall through to clipboard.
      const name = err && err.name;
      if (name === 'AbortError' || /abort|cancel/i.test(String(err?.message || ''))) {
        return RESULT_CANCELLED;
      }
      // Real error — fall through to the clipboard path.
    }
  }

  // ── 2. Clipboard fallback ────────────────────────────────
  if (typeof navigator !== 'undefined'
      && navigator.clipboard
      && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(clipboardPayload);
      return RESULT_OK_CLIPBOARD;
    } catch {
      return RESULT_FAILED;
    }
  }

  return RESULT_UNSUPPORTED;
}

/**
 * canShareNatively() — quick capability check the UI uses to choose
 * between "Share" and "Copy" button labels.
 */
export function canShareNatively() {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  } catch { return false; }
}

/**
 * canCopyToClipboard() — same idea for the secondary path.
 */
export function canCopyToClipboard() {
  try {
    return !!(typeof navigator !== 'undefined'
      && navigator.clipboard
      && typeof navigator.clipboard.writeText === 'function');
  } catch { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────

function _str(v) { return typeof v === 'string' ? v.trim() : ''; }

export const _internal = Object.freeze({
  RESULT_OK_NATIVE,
  RESULT_OK_CLIPBOARD,
  RESULT_CANCELLED,
  RESULT_UNSUPPORTED,
  RESULT_FAILED,
});
