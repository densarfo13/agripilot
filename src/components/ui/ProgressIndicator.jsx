/**
 * ProgressIndicator — single-bar progress primitive.
 *
 *   <ProgressIndicator value={2} max={3}
 *                      label="2 of 3 done today" />
 *   <ProgressIndicator percent={75} label="Almost done" />
 *
 * Two API shapes (caller picks whichever reads naturally):
 *   • value + max   → component computes percent
 *   • percent       → component uses the value directly
 *
 * Spec coverage (Component System §1 + §2)
 *   • single purpose (progress display only — no labels for
 *     state derivation, no auto-streak resolution; that's
 *     HomeProgressBar's job which has retention-store
 *     dependencies)
 *   • reusable across surfaces — onboarding stepper,
 *     completion bars, scan-progress UIs
 *   • mode-aware — green-only fill (reinforcement; never
 *     warns) per Core Product Signal §3 + §7
 *
 * Strict-rule audit
 *   • Pure presentational — never throws.
 *   • Self-clamps percent to 0..100.
 *   • Renders label only when supplied.
 */

import { COLORS, SPACING, TYPOGRAPHY } from '../../ui/styleGuide.js';

function _percentFromProps({ value, max, percent }) {
  if (Number.isFinite(percent)) {
    return Math.max(0, Math.min(100, Math.round(percent)));
  }
  const v = Number(value);
  const m = Number(max);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
}

export default function ProgressIndicator({
  value,
  max,
  percent,
  label,
  testId,
}) {
  const pct = _percentFromProps({ value, max, percent });
  return (
    <div
      style={STYLES.wrap}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
      data-testid={testId}
    >
      {label ? (
        <span style={STYLES.label}>{label}</span>
      ) : null}
      <div style={STYLES.track} aria-hidden="true">
        <div style={{ ...STYLES.fill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STYLES = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.xs + 2,
    width: '100%',
  },
  label: {
    fontSize:   TYPOGRAPHY.caption.size,
    fontWeight: TYPOGRAPHY.caption.weight,
    color:      COLORS.ink,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: COLORS.good,
    transition: 'width 240ms ease',
  },
};
