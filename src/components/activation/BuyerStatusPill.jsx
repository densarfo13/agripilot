/**
 * BuyerStatusPill — FEATURE_ACTIVATION_POLISH buyer interest status chip.
 *
 * Maps internal interest status values to farmer-friendly labels:
 *
 *   interested / pending  → 🟡 Pending
 *   contacted / negotiating → 🔵 Needs response
 *   sold / accepted         → 🟢 Approved
 *   declined                → 🔴 Declined
 *
 * Rules
 * ─────
 *   • Pure presentational — no hooks, no I/O, never throws.
 *   • Inline styles only.
 *   • Exported alongside the `activationStatusLabel()` helper so
 *     other components can get the label string without rendering
 *     the chip.
 */

// ─── Status mapping ───────────────────────────────────────────────

const STATUS_MAP = Object.freeze({
  // Buyer placed interest, farmer hasn't responded yet.
  interested: { label: 'Pending',        color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  border: 'rgba(252,211,77,0.35)', dot: '🟡' },
  pending:    { label: 'Pending',        color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  border: 'rgba(252,211,77,0.35)', dot: '🟡' },
  // Farmer contacted buyer but awaiting a conclusive reply.
  contacted:   { label: 'Needs response', color: '#7DD3FC', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', dot: '🔵' },
  negotiating: { label: 'Needs response', color: '#7DD3FC', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', dot: '🔵' },
  // Deal agreed / listing marked sold.
  sold:     { label: 'Approved', color: '#86EFAC', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)', dot: '🟢' },
  accepted: { label: 'Approved', color: '#86EFAC', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)', dot: '🟢' },
  approved: { label: 'Approved', color: '#86EFAC', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)', dot: '🟢' },
  // Farmer declined this buyer interest.
  declined: { label: 'Declined', color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', dot: '🔴' },
});

const _DEFAULT = Object.freeze(
  { label: 'Pending', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)', border: 'rgba(252,211,77,0.35)', dot: '🟡' }
);

function _resolve(status) {
  return STATUS_MAP[String(status || 'interested').toLowerCase()] || _DEFAULT;
}

// ─── Exported helper ─────────────────────────────────────────────

/**
 * activationStatusLabel(status) → string
 * Returns the farmer-friendly label string for a status value.
 * Safe for unknown/null inputs — falls back to "Pending".
 */
export function activationStatusLabel(status) {
  return _resolve(status).label;
}

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.03em',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
};

// ─── Component ───────────────────────────────────────────────────

/**
 * BuyerStatusPill
 *
 * @param {object}  props
 * @param {string}  props.status     — raw interest status string
 * @param {boolean} [props.showDot]  — prepend an emoji indicator (default false)
 * @param {object}  [props.style]    — additional inline style overrides
 */
export default function BuyerStatusPill({ status, showDot = false, style }) {
  const meta = _resolve(status);
  return (
    <span
      style={{
        ...S.pill,
        color:      meta.color,
        background: meta.bg,
        border:     `1px solid ${meta.border}`,
        ...style,
      }}
      data-testid="buyer-status-pill"
      data-status={String(status || 'interested')}
    >
      {showDot ? <span aria-hidden="true">{meta.dot} </span> : null}
      {meta.label}
    </span>
  );
}
