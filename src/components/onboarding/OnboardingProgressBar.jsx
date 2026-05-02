/**
 * OnboardingProgressBar \u2014 leaf component for the onboarding
 * progress strip. Single horizontal bar that fills as the user
 * moves through the flow; replaces "Step X of Y" scary number
 * (clean-onboarding spec \u00a75).
 *
 *   <OnboardingProgressBar value={3} total={4} />
 *
 * Why this lives in its own file
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Originally exported from FastFlow.jsx, which imports a stack
 * of heavier modules (i18n strict translator, locale-detection
 * banner, recommendation engine, localStore). When QuickGarden /
 * QuickFarm setup forms imported the progress bar, they pulled
 * that whole tree along with it, increasing the chance of a
 * circular / mid-load failure that surfaces as a render crash
 * via RecoveryErrorBoundary. Splitting the bar into a leaf
 * module keeps the import graph simple and the crash surface
 * minimal: this file imports nothing.
 *
 * Strict-rule audit
 *   \u2022 No imports beyond React. No I/O. No tStrict.
 *   \u2022 Inline styles only.
 *   \u2022 Never throws.
 *   \u2022 ARIA-labelled progress role with aria-valuemin/max/now so
 *     screen readers announce the position.
 */

export default function OnboardingProgressBar({ value, total }) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeValue = Math.max(0, Math.min(safeTotal, Number(value) || 0));
  const pct = Math.round((safeValue / safeTotal) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeValue}
      data-testid="onboarding-progress"
      style={{
        width: '100%',
        height: 4,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.10)',
        overflow: 'hidden',
        margin: '4px 0 8px',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: '#22C55E',
          transition: 'width 240ms ease',
        }}
      />
    </div>
  );
}
