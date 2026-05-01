/**
 * ReadinessBadge — "You are 80% ready" pill + low-score nudge.
 *
 * Spec coverage (Funding upgrade §2)
 *   • Display: "You are {n}% ready"
 *   • If < 60 → show "Complete your profile to improve your chances"
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational — never reads storage / engine itself.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { readinessBand } from '../../funding/applicationReadiness.js';

const TONES = {
  high:   { color: '#86EFAC', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.45)' },
  medium: { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.35)' },
  low:    { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)' },
};

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    alignSelf: 'flex-start',
  },
  bar: {
    height: 6,
    background: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 220ms ease-out',
  },
  nudge: {
    margin: 0,
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 1.5,
  },
};

export default function ReadinessBadge({ score = 0, showNudge = true, style }) {
  useTranslation();

  const n = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const band = readinessBand(n);
  const tone = TONES[band];

  return (
    <div style={{ ...S.wrap, ...(style || null) }} data-testid="funding-readiness-badge" data-band={band}>
      <span style={{
        ...S.pill,
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}>
        {tStrict('funding.readiness.label', 'You are {percent}% ready')
          .replace('{percent}', String(n))}
      </span>
      <div style={S.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={n}>
        <div style={{ ...S.barFill, width: `${n}%`, background: tone.color }} />
      </div>
      {showNudge && band === 'low' ? (
        <p style={S.nudge} data-testid="funding-readiness-nudge">
          {tStrict(
            'funding.readiness.lowNudge',
            'Complete your profile to improve your chances.'
          )}
        </p>
      ) : null}
    </div>
  );
}
