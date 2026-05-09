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

// Sell refinement spec \u00A73 (May 2026) \u2014 replace "Low Trust" /
// "Medium Trust" negative wording with calm progression copy.
// Farmers should never feel the app is calling them untrusted.
// All three live tones now read as positive milestones; the
// numeric score is hidden so the bar is qualitative, not a
// public score.
const TONES = {
  high: {
    bg:     'rgba(94,142,94,0.14)',
    border: 'rgba(94,142,94,0.36)',
    color:  '#3F6A3F',
    label:  'Verified seller',
  },
  medium: {
    bg:     'rgba(212,163,95,0.16)',
    border: 'rgba(212,163,95,0.42)',
    color:  '#7A5A28',
    label:  'Verification in progress',
  },
  low: {
    bg:     'rgba(212,163,95,0.10)',
    border: 'rgba(212,163,95,0.32)',
    color:  '#7A5A28',
    label:  'Buyer visibility improves with complete listings',
  },
  building: {
    bg:     'rgba(31,41,51,0.05)',
    border: 'rgba(31,41,51,0.14)',
    color:  '#667085',
    label:  'Verification in progress',
  },
};

const TOOLTIP = 'Buyer visibility grows as you complete listings and respond promptly.';

export default function TrustScoreBadge({ score, level, building, size = 'sm' }) {
  const key  = building ? 'building' : (level in TONES ? level : 'building');
  const tone = TONES[key];
  // Positive label only \u2014 score number is no longer surfaced
  // to the farmer (refinement spec \u00A73). Internal analytics +
  // the underlying engine still receive `score` via props.
  const text = tone.label;
  // suppress lint: score is intentionally unused in the visible
  // label per the refinement spec; kept on the prop signature
  // so call sites + analytics dashboards stay unchanged.
  void score;

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
