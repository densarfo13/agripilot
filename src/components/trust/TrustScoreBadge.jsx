/**
 * TrustScoreBadge — Phase 7B: coloured pill showing seller trust level.
 *
 *   <TrustScoreBadge score={72} level="high" building={false} />
 *   <TrustScoreBadge building={true} />     ← neutral "Building…" state
 *
 * States:
 *   building=true       → grey  "Building trust score…"
 *   level="high"  (≥70) → green "High Trust · 72"
 *   level="medium"(40+) → amber "Medium Trust · 55"
 *   level="low"   (<40) → red   "Low Trust · 25"
 *
 * Tooltip (spec §UI):
 *   "Based on activity, responsiveness, and recent transactions"
 *   Delivered via native `title` attribute — zero JS, accessible.
 *
 * Props:
 *   score    {number|null}
 *   level    {'high'|'medium'|'low'|null}
 *   building {boolean}
 *   size     {'sm'|'md'}   (default 'sm')
 *
 * Rules:
 *   • Advisory only. Never gates actions.
 *   • No Redux / context coupling.
 *   • Never throws.
 */

const TONES = {
  high: {
    bg:     'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
    color:  '#86EFAC',
    label:  'High Trust',
  },
  medium: {
    bg:     'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    color:  '#FDE68A',
    label:  'Medium Trust',
  },
  low: {
    bg:     'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.35)',
    color:  '#FCA5A5',
    label:  'Low Trust',
  },
  building: {
    bg:     'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.16)',
    color:  'rgba(255,255,255,0.42)',
    label:  'Building trust score\u2026',
  },
};

const TOOLTIP = 'Based on activity, responsiveness, and recent transactions';

export default function TrustScoreBadge({ score, level, building, size = 'sm' }) {
  const key  = building ? 'building' : (level in TONES ? level : 'building');
  const tone = TONES[key];
  const text = building || key === 'building'
    ? tone.label
    : `${tone.label} \u00B7 ${Number.isFinite(Number(score)) ? Math.round(Number(score)) : '\u2014'}`;

  return (
    <span
      data-testid="trust-score-badge"
      data-level={building ? 'building' : (level || 'building')}
      data-building={String(!!building)}
      title={building ? undefined : TOOLTIP}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        padding:      size === 'md' ? '3px 10px' : '2px 8px',
        borderRadius: 999,
        background:   tone.bg,
        border:       `1px solid ${tone.border}`,
        color:        tone.color,
        fontSize:     size === 'md' ? 12 : 11,
        fontWeight:   700,
        lineHeight:   1.6,
        letterSpacing: 0.2,
        cursor:        building ? 'default' : 'help',
        whiteSpace:    'nowrap',
        userSelect:    'none',
      }}
    >
      {text}
    </span>
  );
}
