/**
 * RegionBanner — non-blocking top banner that explains the
 * current region UX state to the farmer.
 *
 * Spec port note
 * ──────────────
 * The design doc was authored with Tailwind utility classes
 * (`bg-amber-50`, `text-amber-900`, …). This codebase does NOT
 * ship Tailwind — every other UI component uses inline `style`
 * objects + a small set of global classes in `src/index.css`.
 * Inline styles match that convention; output is visually
 * equivalent to the Tailwind reference (warm amber pill, dismiss
 * button on the right).
 *
 * Visible text
 * ────────────
 * The banner accepts EITHER:
 *   • `messageKey`       — i18n key resolved via the strict
 *                           translator (preferred path; never
 *                           leaks English in non-English UIs)
 *   • `message`          — already-translated string (for tests
 *                           or call sites that resolved the key
 *                           themselves)
 * The dismiss button is keyed under `regionUx.banner.dismiss`.
 *
 * Behaviour
 * ─────────
 *   • Renders nothing when neither prop is non-empty.
 *   • Calls `onDismiss` once when the user clicks Dismiss; the
 *     parent persists the choice (e.g. via localStorage keyed
 *     on the country) and re-renders the page without the banner.
 *   • Never throws; defensive `try / catch` around the click handler.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const STYLES = {
  wrap: {
    width: '100%',
    background: 'rgba(245,158,11,0.14)',
    borderBottom: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    padding: '10px 16px',
    fontSize: 13,
    lineHeight: 1.4,
  },
  inner: {
    maxWidth: '64rem',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  message: { margin: 0, flex: 1 },
  emoji:   { marginRight: 6 },
  btn: {
    flexShrink: 0,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 8,
    border: '1px solid rgba(245,158,11,0.45)',
    background: 'rgba(245,158,11,0.10)',
    color: '#FDE68A',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
};

export default function RegionBanner({
  messageKey = '',
  message = '',
  onDismiss = null,
}) {
  // Re-render on language change so the resolved text stays in
  // sync with the active UI language.
  useTranslation();

  const text = message || (messageKey ? tStrict(messageKey, '') : '');
  if (!text) return null;

  const dismissLabel = tStrict('regionUx.banner.dismiss', 'Dismiss');

  const handleDismiss = (e) => {
    try { e?.stopPropagation?.(); } catch { /* ignore */ }
    if (typeof onDismiss === 'function') {
      try { onDismiss(); } catch { /* never propagate */ }
    }
  };

  return (
    <div style={STYLES.wrap} role="status" aria-live="polite" data-testid="region-banner">
      <div style={STYLES.inner}>
        <p style={STYLES.message}>
          <span aria-hidden="true" style={STYLES.emoji}>🌍</span>
          {text}
        </p>
        {onDismiss ? (
          <button
            type="button"
            onClick={handleDismiss}
            style={STYLES.btn}
            data-testid="region-banner-dismiss"
            aria-label={dismissLabel}
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
