/**
 * MatchChips — inline "Why this fits you" chip group for FundingCard.
 *
 * Spec coverage (Funding screen V2 §2)
 *   • match crop
 *   • match region
 *   • match experience level
 *
 * Renders three chips with one of three tones:
 *   match    → green   ("Crop matches", "Region matches", …)
 *   open     → grey    ("All crops welcome", …)
 *   mismatch → amber   ("Other crops only", …)  (kept soft, never red)
 *   null     → grey    ("Crop unknown", …)
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational. Reads nothing — caller passes `card`
 *     and `profile`; this component delegates match logic to the
 *     existing `calculateApplicationReadiness` helper so the chip
 *     status and the modal readiness number always agree.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { calculateApplicationReadiness } from '../../funding/applicationReadiness.js';

const TONES = {
  match:    { bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.45)',  color: '#86EFAC' },
  open:     { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.78)' },
  mismatch: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.32)', color: '#FDE68A' },
  unknown:  { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.7)' },
};

const S = {
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 12, lineHeight: 1 },
};

function _toneFor(status) {
  if (status === 'match')    return TONES.match;
  if (status === 'mismatch') return TONES.mismatch;
  if (status === 'open')     return TONES.open;
  return TONES.unknown;
}

function _iconFor(status) {
  if (status === 'match')    return '\u2714';   // check
  if (status === 'mismatch') return '\u2022';   // dot
  if (status === 'open')     return '\u2022';   // dot
  return '\u2022';
}

function _resolveChip(prefix, status, fallbackMatch, fallbackOpen, fallbackMismatch, fallbackUnknown) {
  const key = `funding.matchChip.${prefix}.${status || 'unknown'}`;
  const fallback = (() => {
    if (status === 'match')    return fallbackMatch;
    if (status === 'open')     return fallbackOpen;
    if (status === 'mismatch') return fallbackMismatch;
    return fallbackUnknown;
  })();
  return tStrict(key, fallback);
}

/**
 * @param {object} props
 * @param {object} props.card
 * @param {object} [props.profile]
 * @param {object} [props.style]
 */
export default function MatchChips({ card = {}, profile = {}, style }) {
  useTranslation();

  const matches = useMemo(() => {
    try {
      return calculateApplicationReadiness({ card, profile }).matches || {};
    } catch { return {}; }
  }, [card, profile]);

  const cropLabel = _resolveChip(
    'crop', matches.crop,
    'Crop matches',  'All crops welcome', 'Other crops targeted',  'Crop unknown',
  );
  const regionLabel = _resolveChip(
    'region', matches.country,
    'Region matches', 'Available worldwide', 'Other regions targeted', 'Region unknown',
  );
  const expLabel = _resolveChip(
    'experience', matches.experience,
    'Fits your farm type', 'All farm types welcome', 'Other farm types targeted', 'Farm type unknown',
  );

  const chips = [
    { id: 'crop',       status: matches.crop,       label: cropLabel   },
    { id: 'region',     status: matches.country,    label: regionLabel },
    { id: 'experience', status: matches.experience, label: expLabel    },
  ];

  return (
    <div style={{ ...S.group, ...(style || null) }} data-testid="funding-match-chips">
      <span style={S.label}>
        {tStrict('funding.matchChip.heading', 'Why this fits you')}
      </span>
      <div style={S.row}>
        {chips.map((c) => {
          const tone = _toneFor(c.status);
          return (
            <span
              key={c.id}
              style={{
                ...S.chip,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                color: tone.color,
              }}
              data-testid={`funding-match-chip-${c.id}`}
              data-status={c.status || 'unknown'}
            >
              <span style={S.icon} aria-hidden="true">{_iconFor(c.status)}</span>
              <span>{c.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
